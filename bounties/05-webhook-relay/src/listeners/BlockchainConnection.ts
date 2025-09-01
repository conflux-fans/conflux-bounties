import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import { IBlockchainConnection } from './interfaces';
import { BlockchainEvent } from '../types';
import { NetworkConfig } from '../types/config';

export class BlockchainConnection extends EventEmitter implements IBlockchainConnection {
  private provider: ethers.WebSocketProvider | null = null;
  private config: NetworkConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 2000; // Start with 2 seconds
  private maxReconnectDelay = 60000; // Max 60 seconds
  private isConnecting = false;
  private shouldReconnect = true;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private statusInterval: ReturnType<typeof setInterval> | null = null;
  
  // Enhanced monitoring capabilities from realtime-event-listener.js
  private startTime = Date.now();
  private blockCount = 0;
  private transactionCount = 0;
  private lastBlockNumber = 0;
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private blockMonitoringEnabled = false;
  private websocketState: number | null = null;
  private lastBlockTime: Date | null = null;
  private contractAddresses = new Set<string>(); // Track contracts we're monitoring

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
    this.connectionStatus = 'connecting';

    try {
      console.log('🚀 Starting Real-time Blockchain Connection');
      console.log('📡 Connecting to Conflux eSpace...');
      
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

      // Get initial block number and test connection
      this.lastBlockNumber = await this.provider.getBlockNumber();
      console.log(`✅ Connected! Current block: ${this.lastBlockNumber}`);

      this.reconnectAttempts = 0;
      this.isConnecting = false;
      this.connectionStatus = 'connected';
      this.lastBlockTime = new Date();

      // Start health monitoring
      this.startHealthMonitoring();

      // Start block monitoring if enabled
      if (this.blockMonitoringEnabled) {
        this.startBlockMonitoring();
      }

      // Start periodic status display (every 30 seconds)
      this.statusInterval = setInterval(() => {
        this.displayStatus();
      }, 30000);

      this.emit('connected');
      console.log(`🎧 Real-time blockchain connection is now active!`);
      console.log('⏰ Waiting for blocks and events...\n');
    } catch (error) {
      this.isConnecting = false;
      this.connectionStatus = 'error';
      console.error('💥 Failed to connect to blockchain:', (error as Error).message);
      this.emit('error', error);

      if (this.shouldReconnect) {
        await this.scheduleReconnect();
      }

      throw error;
    }
  }

  async disconnect(): Promise<void> {
    console.log('\n🛑 Stopping blockchain connection...');
    this.shouldReconnect = false;
    this.connectionStatus = 'disconnected';

    // Clear all intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }

    if (this.provider) {
      try {
        // Remove all listeners before destroying
        this.provider.removeAllListeners();
        console.log('📴 Removed all blockchain event listeners');
        await this.provider.destroy();
        console.log('📴 WebSocket connection closed');
      } catch (error) {
        console.error('Error during provider cleanup:', error);
      }
      this.provider = null;
    }
    this.emit('disconnected');
    console.log('✅ Blockchain connection stopped');
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

  // Enhanced monitoring methods from realtime-event-listener.js
  enableBlockMonitoring(): void {
    this.blockMonitoringEnabled = true;
    if (this.isConnected()) {
      this.startBlockMonitoring();
    }
  }

  disableBlockMonitoring(): void {
    this.blockMonitoringEnabled = false;
    if (this.provider) {
      this.provider.removeAllListeners('block');
    }
  }

  addContractToMonitor(contractAddress: string): void {
    this.contractAddresses.add(contractAddress.toLowerCase());
    console.log(`📋 Added contract ${contractAddress} to monitoring list`);
  }

  removeContractFromMonitor(contractAddress: string): void {
    this.contractAddresses.delete(contractAddress.toLowerCase());
    console.log(`📴 Removed contract ${contractAddress} from monitoring list`);
  }

  getConnectionStatus(): {
    status: string;
    uptime: number;
    blockCount: number;
    transactionCount: number;
    lastBlockNumber: number;
    websocketState: number | null;
    lastBlockTime: Date | null;
    monitoredContracts: number;
  } {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    return {
      status: this.connectionStatus,
      uptime,
      blockCount: this.blockCount,
      transactionCount: this.transactionCount,
      lastBlockNumber: this.lastBlockNumber,
      websocketState: this.provider?.websocket?.readyState || null,
      lastBlockTime: this.lastBlockTime,
      monitoredContracts: this.contractAddresses.size
    };
  }

  displayStatus(): void {
    const status = this.getConnectionStatus();
    const minutes = Math.floor(status.uptime / 60);
    const seconds = status.uptime % 60;
    
    console.log(`\n📊 Blockchain Connection Status:`);
    console.log(`   ⏰ Uptime: ${minutes}m ${seconds}s`);
    console.log(`   📡 Connection: ${status.status === 'connected' ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`   📦 Blocks processed: ${status.blockCount}`);
    console.log(`   📤 Transactions seen: ${status.transactionCount}`);
    console.log(`   🔢 Last block: ${status.lastBlockNumber}`);
    console.log(`   🌐 WebSocket state: ${this.getWebSocketStateText(status.websocketState)}`);
    console.log(`   📋 Monitoring: ${status.monitoredContracts} contracts`);
    
    if (status.lastBlockTime) {
      const timeSinceLastBlock = Math.floor((Date.now() - status.lastBlockTime.getTime()) / 1000);
      console.log(`   🕐 Last block: ${timeSinceLastBlock}s ago`);
    }
    console.log('');
  }

  private setupProviderEventHandlers(): void {
    if (!this.provider) return;

    // Enhanced WebSocket connection monitoring from realtime-event-listener.js
    if (this.provider.websocket) {
      const ws = this.provider.websocket as any; // Cast to any to handle WebSocket events

      ws.on('open', () => {
        console.log('✅ WebSocket connection opened');
        this.connectionStatus = 'connected';
        this.websocketState = 1; // OPEN
      });

      ws.on('close', (code: number, reason: string) => {
        console.log(`\n⚠️ WebSocket connection closed: ${code} - ${reason}`);
        this.connectionStatus = 'disconnected';
        this.websocketState = 3; // CLOSED
        this.provider = null;
        this.emit('disconnected');

        if (this.shouldReconnect) {
          console.log('🔄 Attempting to reconnect...');
          this.scheduleReconnect();
        }
      });

      ws.on('error', (error: Error) => {
        console.error(`\n❌ WebSocket error:`, error.message);
        this.connectionStatus = 'error';
        this.websocketState = null;
        this.emit('error', error);
      });

      // Track WebSocket state changes
      ws.on('connecting', () => {
        console.log('🔄 WebSocket connecting...');
        this.connectionStatus = 'connecting';
        this.websocketState = 0; // CONNECTING
      });
    }

    // Handle provider errors with enhanced logging
    this.provider.on('error', (error: Error) => {
      console.error('❌ Provider error:', error.message);
      this.connectionStatus = 'error';
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
    // Enhanced health monitoring with detailed connection status
    this.healthCheckInterval = setInterval(() => {
      if (!this.isConnected()) {
        console.warn('⚠️ Health check failed: Connection lost');
        console.log(`   📊 WebSocket state: ${this.getWebSocketStateText(this.websocketState)}`);
        console.log(`   🔄 Reconnect attempts: ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        this.emit('healthCheckFailed');

        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      } else {
        // Update WebSocket state
        this.websocketState = this.provider?.websocket?.readyState || null;
        
        // Check if we haven't received blocks recently (potential connection issue)
        if (this.lastBlockTime) {
          const timeSinceLastBlock = Date.now() - this.lastBlockTime.getTime();
          if (timeSinceLastBlock > 120000) { // 2 minutes without blocks
            console.warn(`⚠️ No blocks received for ${Math.floor(timeSinceLastBlock / 1000)}s - connection may be stale`);
          }
        }
      }
    }, 30000);
  }

  private startBlockMonitoring(): void {
    if (!this.provider) return;

    console.log('📦 Starting basic block monitoring...');
    
    this.provider.on('block', async (blockNumber: number) => {
      try {
        this.blockCount++;
        this.lastBlockNumber = blockNumber;
        this.lastBlockTime = new Date();

        // Get block with transaction count only
        const block = await this.provider!.getBlock(blockNumber, false); // false = don't fetch full transactions
        
        if (block && block.transactions && block.transactions.length > 0) {
          this.transactionCount += block.transactions.length;
          
          // Only log blocks with transactions occasionally to reduce noise
          if (blockNumber % 5 === 0 || block.transactions.length > 10) {
            console.log(`📦 Block ${blockNumber}: ${block.transactions.length} transactions`);
          }
          
          // Emit simplified block event for further processing
          this.emit('newBlock', {
            blockNumber,
            transactionCount: block.transactions.length,
            timestamp: this.lastBlockTime
          });
        } else if (block) {
          // Log empty blocks occasionally
          if (blockNumber % 20 === 0) {
            console.log(`📦 Block ${blockNumber} (empty)`);
          }
        }
      } catch (blockError) {
        console.error(`❌ Error processing block ${blockNumber}:`, (blockError as Error).message);
      }
    });
    
    console.log('✅ Basic block monitoring active');
  }



  private getWebSocketStateText(state: number | null): string {
    if (state === null) return 'N/A';
    
    switch (state) {
      case 0: return 'CONNECTING';
      case 1: return 'OPEN';
      case 2: return 'CLOSING';
      case 3: return 'CLOSED';
      default: return `UNKNOWN(${state})`;
    }
  }
}