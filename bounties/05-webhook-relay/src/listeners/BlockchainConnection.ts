import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import { IBlockchainConnection } from './interfaces';
import { BlockchainEvent } from '../types';
import { NetworkConfig } from '../types/config';

export class BlockchainConnection extends EventEmitter implements IBlockchainConnection {
  private provider: ethers.WebSocketProvider | null = null;
  private config: NetworkConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private isConnecting = false;
  private shouldReconnect = true;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: NetworkConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.isConnected()) {
      return;
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    try {
      // Use WebSocket URL if provided, otherwise fall back to RPC URL
      const url = this.config.wsUrl || this.config.rpcUrl;

      if (url.startsWith('ws://') || url.startsWith('wss://')) {
        this.provider = new ethers.WebSocketProvider(url, this.config.chainId);
      } else {
        throw new Error('WebSocket URL required for real-time event monitoring');
      }

      // Set up connection event handlers
      this.setupProviderEventHandlers();

      // Wait for connection to be established
      await this.waitForConnection();

      this.reconnectAttempts = 0;
      this.isConnecting = false;

      // Start health monitoring
      this.startHealthMonitoring();

      this.emit('connected');
      console.log(`Connected to Conflux eSpace at ${url}`);
    } catch (error) {
      this.isConnecting = false;
      this.emit('error', error);

      if (this.shouldReconnect) {
        await this.scheduleReconnect();
      }

      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.shouldReconnect = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.provider) {
      try {
        await this.provider.destroy();
      } catch (error) {
        console.error('Error during provider cleanup:', error);
      }
      this.provider = null;
    }

    this.emit('disconnected');
    console.log('Disconnected from Conflux eSpace');
  }

  isConnected(): boolean {
    return this.provider !== null && this.provider.websocket?.readyState === 1;
  }

  onEvent(callback: (event: BlockchainEvent) => void): void {
    this.on('blockchainEvent', callback);
  }

  getProvider(): ethers.WebSocketProvider | null {
    return this.provider;
  }

  private setupProviderEventHandlers(): void {
    if (!this.provider) return;

    // Handle WebSocket connection events
    if (this.provider.websocket) {
      const ws = this.provider.websocket as any; // Cast to any to handle WebSocket events

      ws.on('open', () => {
        console.log('WebSocket connection opened');
      });

      ws.on('close', (code: number, reason: string) => {
        console.log(`WebSocket connection closed: ${code} - ${reason}`);
        this.provider = null;
        this.emit('disconnected');

        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      });

      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      });
    }

    // Handle provider errors
    this.provider.on('error', (error: Error) => {
      console.error('Provider error:', error);
      this.emit('error', error);
    });
  }

  private async waitForConnection(): Promise<void> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    // Wait for WebSocket to be ready
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000); // 10 second timeout

      // Check if already connected
      if (this.provider?.websocket?.readyState === 1) {
        clearTimeout(timeout);
        resolve();
        return;
      }

      // Set up event listener for open event
      const checkConnection = () => {
        if (this.provider?.websocket?.readyState === 1) {
          clearTimeout(timeout);
          if (this.provider?.websocket) {
            (this.provider.websocket as any).removeListener('open', checkConnection);
          }
          resolve();
        }
      };

      if (this.provider?.websocket) {
        (this.provider.websocket as any).on('open', checkConnection);
      } else {
        clearTimeout(timeout);
        reject(new Error('WebSocket not available'));
      }
    });
  }

  private async scheduleReconnect(): Promise<void> {
    if (!this.shouldReconnect || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached. Giving up.');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

    setTimeout(async () => {
      if (this.shouldReconnect) {
        try {
          await this.connect();
        } catch (error) {
          console.error('Reconnection attempt failed:', error);
        }
      }
    }, delay);
  }

  private startHealthMonitoring(): void {
    // Check connection health every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      if (!this.isConnected()) {
        console.warn('Health check failed: Connection lost');
        this.emit('healthCheckFailed');

        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      }
    }, 30000);
  }
}