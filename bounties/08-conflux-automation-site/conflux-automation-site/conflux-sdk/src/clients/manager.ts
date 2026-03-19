/*
 * Copyright 2025 Conflux DevKit Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Client Manager - Unified orchestration layer for Conflux DevKit Node
// Manages both Core and EVM clients with health monitoring and network coordination

import { EventEmitter } from 'node:events';
import { createCoreClient } from '../clients/core.js';
import { createEspaceClient } from '../clients/evm.js';
import {
  defaultNetworkSelector,
  getChainConfig,
  isValidChainId,
} from '../config/chains.js';
import type {
  ChainType,
  ClientConfig,
  CoreClientInstance,
  EspaceClientInstance,
  HealthStatus,
  SupportedChainId,
} from '../types/index.js';

// Health check intervals (in milliseconds)
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds

/**
 * Client Manager Events
 */
export interface ClientManagerEvents {
  'client:ready': [{ type: ChainType; chainId: SupportedChainId }];
  'client:error': [
    { type: ChainType; chainId: SupportedChainId; error: Error },
  ];
  'client:health': [
    { type: ChainType; chainId: SupportedChainId; status: HealthStatus },
  ];
  'server:started': [
    { coreChainId: SupportedChainId; evmChainId: SupportedChainId },
  ];
  'server:stopped': [];
  'network:switched': [{ from: SupportedChainId; to: SupportedChainId }];
  'manager:ready': [];
  'manager:error': [{ error: Error }];
}

/**
 * Client Manager Configuration
 */
export interface ClientManagerConfig {
  /** Core Space client configuration */
  core: ClientConfig;
  /** eSpace client configuration */
  evm: ClientConfig;
  /** Enable automatic health monitoring */
  enableHealthMonitoring?: boolean;
  /** Health check interval in milliseconds */
  healthCheckInterval?: number;
  /** Health check timeout in milliseconds */
  healthCheckTimeout?: number;
}

/**
 * Client Manager Status
 */
export interface ClientManagerStatus {
  initialized: boolean;
  coreClient: {
    connected: boolean;
    chainId: SupportedChainId;
    health: HealthStatus;
    lastHealthCheck?: Date;
  };
  evmClient: {
    connected: boolean;
    chainId: SupportedChainId;
    health: HealthStatus;
    lastHealthCheck?: Date;
  };
  networkSelector: {
    currentChain: SupportedChainId;
    isLocalNode: boolean;
    lockedToLocal: boolean;
  };
}

/**
 * Unified Client Manager
 *
 * This is the main orchestration layer that manages:
 * - Core Space and eSpace client instances
 * - Local development server lifecycle
 * - Network switching and chain coordination
 * - Health monitoring and error recovery
 * - Event coordination between components
 *
 * Key Design Principles:
 * 1. **Dual Chain Support**: Manages both Core and eSpace clients simultaneously
 * 2. **Network Awareness**: Automatically switches to local chains when dev server runs
 * 3. **Health Monitoring**: Continuous health checks with automatic recovery
 * 4. **Event Coordination**: Unified event system for all components
 * 5. **Type Safety**: Full TypeScript support with proper error handling
 */
export class ClientManager extends EventEmitter<ClientManagerEvents> {
  private config: ClientManagerConfig;
  private coreClient: CoreClientInstance | null = null;
  private evmClient: EspaceClientInstance | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private networkSelectorUnsubscribe: (() => void) | null = null;
  private nodeRunningUnsubscribe: (() => void) | null = null;
  private initialized = false;

  constructor(config: ClientManagerConfig) {
    super();
    this.config = {
      enableHealthMonitoring: true,
      healthCheckInterval: HEALTH_CHECK_INTERVAL,
      healthCheckTimeout: HEALTH_CHECK_TIMEOUT,
      ...config,
    };
  }

  /**
   * Initialize the Client Manager
   * Sets up clients, server, and monitoring
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Set up network selector listeners
      this.setupNetworkListeners();

      // Initialize clients based on current network selection
      await this.initializeClients();

      // Start health monitoring if enabled
      if (this.config.enableHealthMonitoring) {
        this.startHealthMonitoring();
      }

      this.initialized = true;
      this.emit('manager:ready');
    } catch (error) {
      const managerError =
        error instanceof Error ? error : new Error(String(error));
      this.emit('manager:error', { error: managerError });
      throw managerError;
    }
  }

  /**
   * Gracefully shutdown the Client Manager
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      // Stop health monitoring
      this.stopHealthMonitoring();

      // Clean up network selector listeners
      if (this.networkSelectorUnsubscribe) {
        this.networkSelectorUnsubscribe();
        this.networkSelectorUnsubscribe = null;
      }

      if (this.nodeRunningUnsubscribe) {
        this.nodeRunningUnsubscribe();
        this.nodeRunningUnsubscribe = null;
      }

      // Clean up clients
      this.coreClient = null;
      this.evmClient = null;

      this.initialized = false;
      this.removeAllListeners();
    } catch (error) {
      const shutdownError =
        error instanceof Error ? error : new Error(String(error));
      this.emit('manager:error', { error: shutdownError });
      throw shutdownError;
    }
  }

  /**
   * Get current Core Space client
   */
  getCoreClient(): CoreClientInstance | null {
    return this.coreClient;
  }

  /**
   * Get current eSpace client
   */
  getEvmClient(): EspaceClientInstance | null {
    return this.evmClient;
  }

  /**
   * Get comprehensive status
   */
  getStatus(): ClientManagerStatus {
    const currentChainId = defaultNetworkSelector.getCurrentChainId();
    const currentChain = getChainConfig(currentChainId);

    return {
      initialized: this.initialized,
      coreClient: {
        connected: !!this.coreClient,
        chainId:
          currentChain.type === 'core'
            ? currentChainId
            : defaultNetworkSelector.getCorrespondingChainId() || 1,
        health: 'unknown', // TODO: Implement health status tracking
        lastHealthCheck: undefined,
      },
      evmClient: {
        connected: !!this.evmClient,
        chainId:
          currentChain.type === 'evm'
            ? currentChainId
            : defaultNetworkSelector.getCorrespondingChainId() || 71,
        health: 'unknown', // TODO: Implement health status tracking
        lastHealthCheck: undefined,
      },
      networkSelector: {
        currentChain: currentChainId,
        isLocalNode: defaultNetworkSelector.getNodeRunningStatus(),
        lockedToLocal: defaultNetworkSelector.isLockedToLocal(),
      },
    };
  }

  /**
   * Switch to a specific network
   * @param chainId - Target chain ID
   * @param force - Force switch even if node is running (for wallet operations)
   */
  async switchNetwork(chainId: SupportedChainId, force = false): Promise<void> {
    if (!isValidChainId(chainId)) {
      throw new Error(`Invalid chain ID: ${chainId}`);
    }

    const previousChainId = defaultNetworkSelector.getCurrentChainId();

    if (previousChainId === chainId) {
      return; // Already on this chain
    }

    // Attempt network switch
    defaultNetworkSelector.switchChain(chainId, force);

    // If switch was successful, reinitialize clients
    if (defaultNetworkSelector.getCurrentChainId() === chainId) {
      await this.initializeClients();
      this.emit('network:switched', { from: previousChainId, to: chainId });
    }
  }

  /**
   * Initialize or reinitialize client instances based on current network
   */
  private async initializeClients(): Promise<void> {
    const currentChainId = defaultNetworkSelector.getCurrentChainId();
    const currentChain = getChainConfig(currentChainId);

    try {
      // Always initialize both clients, but connect them to appropriate chains
      if (currentChain.type === 'core') {
        // Current selection is Core, get corresponding eSpace chain
        const evmChainId =
          defaultNetworkSelector.getCorrespondingChainId() || 71;

        this.coreClient = await createCoreClient({
          ...this.config.core,
          chainId: currentChainId,
        });

        this.evmClient = await createEspaceClient({
          ...this.config.evm,
          chainId: evmChainId,
        });
      } else {
        // Current selection is eSpace, get corresponding Core chain
        const coreChainId =
          defaultNetworkSelector.getCorrespondingChainId() || 1;

        this.coreClient = await createCoreClient({
          ...this.config.core,
          chainId: coreChainId,
        });

        this.evmClient = await createEspaceClient({
          ...this.config.evm,
          chainId: currentChainId,
        });
      }

      // Emit ready events
      this.emit('client:ready', {
        type: 'core' as ChainType,
        chainId: this.coreClient.publicClient.chainId as SupportedChainId,
      });
      this.emit('client:ready', {
        type: 'evm' as ChainType,
        chainId: this.evmClient.publicClient.chainId as SupportedChainId,
      });
    } catch (error) {
      const clientError =
        error instanceof Error ? error : new Error(String(error));
      this.emit('manager:error', { error: clientError });
      throw clientError;
    }
  }

  /**
   * Set up network selector event listeners
   */
  private setupNetworkListeners(): void {
    // Listen for chain changes
    this.networkSelectorUnsubscribe = defaultNetworkSelector.onChainChange(
      async (_chainId) => {
        try {
          await this.initializeClients();
        } catch (error) {
          const networkError =
            error instanceof Error ? error : new Error(String(error));
          this.emit('manager:error', { error: networkError });
        }
      }
    );

    // Listen for node running status changes
    this.nodeRunningUnsubscribe = defaultNetworkSelector.onNodeRunningChange(
      async (isRunning) => {
        if (isRunning) {
          // Node started - clients will be reinitialized by chain change event
        } else {
          // Node stopped - clients will be reinitialized by chain change event
        }
      }
    );
  }

  /**
   * Start health monitoring for all clients
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      return; // Already running
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval || HEALTH_CHECK_INTERVAL);

    // Perform initial health check
    setTimeout(() => this.performHealthChecks(), 1000);
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform health checks on all clients
   */
  private async performHealthChecks(): Promise<void> {
    const timeout = this.config.healthCheckTimeout || HEALTH_CHECK_TIMEOUT;

    // Check Core client health
    if (this.coreClient) {
      try {
        const healthPromise = this.checkCoreClientHealth();
        const result = await Promise.race([
          healthPromise,
          new Promise<HealthStatus>((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), timeout)
          ),
        ]);

        this.emit('client:health', {
          type: 'core' as ChainType,
          chainId: this.coreClient.publicClient.chainId as SupportedChainId,
          status: result,
        });
      } catch (error) {
        this.emit('client:error', {
          type: 'core' as ChainType,
          chainId: this.coreClient.publicClient.chainId as SupportedChainId,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    // Check eSpace client health
    if (this.evmClient) {
      try {
        const healthPromise = this.checkEvmClientHealth();
        const result = await Promise.race([
          healthPromise,
          new Promise<HealthStatus>((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), timeout)
          ),
        ]);

        this.emit('client:health', {
          type: 'evm' as ChainType,
          chainId: this.evmClient.publicClient.chainId as SupportedChainId,
          status: result,
        });
      } catch (error) {
        this.emit('client:error', {
          type: 'evm' as ChainType,
          chainId: this.evmClient.publicClient.chainId as SupportedChainId,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
  }

  /**
   * Check Core client health
   */
  private async checkCoreClientHealth(): Promise<HealthStatus> {
    if (!this.coreClient) {
      return 'disconnected';
    }

    try {
      // Simple health check - get latest block number
      await this.coreClient.publicClient.getBlockNumber();
      return 'healthy';
    } catch (_error) {
      return 'unhealthy';
    }
  }

  /**
   * Check eSpace client health
   */
  private async checkEvmClientHealth(): Promise<HealthStatus> {
    if (!this.evmClient) {
      return 'disconnected';
    }

    try {
      // Simple health check - get latest block number
      await this.evmClient.publicClient.getBlockNumber();
      return 'healthy';
    } catch (_error) {
      return 'unhealthy';
    }
  }
}

/**
 * Create a new Client Manager instance
 */
export function createClientManager(
  config: ClientManagerConfig
): ClientManager {
  return new ClientManager(config);
}

// Export types are already exported above
