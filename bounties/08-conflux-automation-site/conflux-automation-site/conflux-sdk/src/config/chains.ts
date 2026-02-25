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

// Centralized Chain Configuration
// Matches Hardhat configuration with consistent naming across all clients

import type { Chain as CiveChain } from 'cive';
import { defineChain } from 'cive/utils';
import type { Chain as ViemChain } from 'viem';
import { defineChain as defineEvmChain } from 'viem';

export type SupportedChainId = 1029 | 1 | 2029 | 1030 | 71 | 2030;

export interface ChainConfig {
  id: SupportedChainId;
  name: string;
  type: 'core' | 'evm';
  testnet: boolean;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: {
    default: {
      http: string[];
      webSocket?: string[];
    };
  };
  blockExplorers?: {
    default: {
      name: string;
      url: string;
    };
  };
  contracts?: {
    multicall3?: {
      address: `0x${string}`;
      blockCreated?: number;
    };
  };
}

// Core Space Chains (Conflux Protocol)
export const CORE_MAINNET: ChainConfig = {
  id: 1029,
  name: 'conflux-core',
  type: 'core',
  testnet: false,
  nativeCurrency: {
    name: 'Conflux',
    symbol: 'CFX',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://main.confluxrpc.com'],
      webSocket: ['wss://main.confluxrpc.com/ws'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ConfluxScan',
      url: 'https://confluxscan.io',
    },
  },
};

export const CORE_TESTNET: ChainConfig = {
  id: 1,
  name: 'conflux-core-testnet',
  type: 'core',
  testnet: true,
  nativeCurrency: {
    name: 'Conflux',
    symbol: 'CFX',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://test.confluxrpc.com'],
      webSocket: ['wss://test.confluxrpc.com/ws'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ConfluxScan Testnet',
      url: 'https://testnet.confluxscan.io',
    },
  },
};

export const CORE_LOCAL: ChainConfig = {
  id: 2029,
  name: 'conflux-core-local',
  type: 'core',
  testnet: true,
  nativeCurrency: {
    name: 'Conflux',
    symbol: 'CFX',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['http://localhost:12537'],
      webSocket: ['ws://localhost:12536'],
    },
  },
};

// EVM Space Chains (Ethereum Compatible)
export const EVM_MAINNET: ChainConfig = {
  id: 1030,
  name: 'conflux-espace',
  type: 'evm',
  testnet: false,
  nativeCurrency: {
    name: 'Conflux',
    symbol: 'CFX',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://evm.confluxrpc.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ConfluxScan eSpace',
      url: 'https://evm.confluxscan.net',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 62512243,
    },
  },
};

export const EVM_TESTNET: ChainConfig = {
  id: 71,
  name: 'conflux-espace-testnet',
  type: 'evm',
  testnet: true,
  nativeCurrency: {
    name: 'Conflux',
    symbol: 'CFX',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://evmtestnet.confluxrpc.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ConfluxScan eSpace Testnet',
      url: 'https://evmtestnet.confluxscan.net',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 117499050,
    },
  },
};

export const EVM_LOCAL: ChainConfig = {
  id: 2030,
  name: 'conflux-espace-local',
  type: 'evm',
  testnet: true,
  nativeCurrency: {
    name: 'Conflux',
    symbol: 'CFX',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['http://localhost:8545'],
    },
  },
};

// All supported chains
export const SUPPORTED_CHAINS: Record<SupportedChainId, ChainConfig> = {
  1029: CORE_MAINNET,
  1: CORE_TESTNET,
  2029: CORE_LOCAL,
  1030: EVM_MAINNET,
  71: EVM_TESTNET,
  2030: EVM_LOCAL,
};

// Chain utilities
export function getChainConfig(chainId: SupportedChainId): ChainConfig {
  const config = SUPPORTED_CHAINS[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return config;
}

export function isValidChainId(chainId: number): chainId is SupportedChainId {
  return chainId in SUPPORTED_CHAINS;
}

export function getCoreChains(): ChainConfig[] {
  return Object.values(SUPPORTED_CHAINS).filter(
    (chain) => chain.type === 'core'
  );
}

export function getEvmChains(): ChainConfig[] {
  return Object.values(SUPPORTED_CHAINS).filter(
    (chain) => chain.type === 'evm'
  );
}

export function getMainnetChains(): ChainConfig[] {
  return Object.values(SUPPORTED_CHAINS).filter((chain) => !chain.testnet);
}

export function getTestnetChains(): ChainConfig[] {
  return Object.values(SUPPORTED_CHAINS).filter((chain) => chain.testnet);
}

// Convert to native chain objects
export function toCiveChain(config: ChainConfig): CiveChain {
  if (config.type !== 'core') {
    throw new Error(`Cannot convert ${config.type} chain to Cive chain`);
  }

  return defineChain({
    id: config.id,
    name: config.name,
    nativeCurrency: config.nativeCurrency,
    rpcUrls: config.rpcUrls,
    blockExplorers: config.blockExplorers,
  });
}

export function toViemChain(config: ChainConfig): ViemChain {
  if (config.type !== 'evm') {
    throw new Error(`Cannot convert ${config.type} chain to Viem chain`);
  }

  return defineEvmChain({
    id: config.id,
    name: config.name,
    nativeCurrency: config.nativeCurrency,
    rpcUrls: config.rpcUrls,
    blockExplorers: config.blockExplorers,
    contracts: config.contracts,
  });
}

// Network selector utility with automatic local switching
export class NetworkSelector {
  private currentChainId: SupportedChainId;
  private previousChainId: SupportedChainId | null = null;
  private listeners: Set<(chainId: SupportedChainId) => void> = new Set();
  private nodeRunningListeners: Set<(isRunning: boolean) => void> = new Set();
  private isNodeRunning = false;
  private lockedToLocal = false;

  constructor(initialChainId: SupportedChainId = 1) {
    this.currentChainId = initialChainId;
  }

  getCurrentChain(): ChainConfig {
    return getChainConfig(this.currentChainId);
  }

  getCurrentChainId(): SupportedChainId {
    return this.currentChainId;
  }

  /**
   * Switch to a specific chain
   * @param chainId - Chain ID to switch to
   * @param force - Force switch even if node is running (for wallet operations)
   */
  switchChain(chainId: SupportedChainId, force = false): void {
    if (!isValidChainId(chainId)) {
      throw new Error(`Invalid chain ID: ${chainId}`);
    }

    // If node is running and we're trying to switch to non-local, only allow if forced
    if (this.isNodeRunning && !this.isLocalChain(chainId) && !force) {
      console.warn(
        `Cannot switch to chain ${chainId} while local node is running. Use force=true for wallet operations.`
      );
      return;
    }

    if (this.currentChainId !== chainId) {
      this.currentChainId = chainId;
      this.notifyListeners();
    }
  }

  /**
   * Called when local node starts - automatically switches to local chains
   */
  onNodeStart(
    coreChainId: SupportedChainId = 2029,
    evmChainId: SupportedChainId = 2030
  ): void {
    if (!this.isNodeRunning) {
      // Store previous chain for restoration later
      if (!this.isLocal()) {
        this.previousChainId = this.currentChainId;
      }

      this.isNodeRunning = true;
      this.lockedToLocal = true;

      // Switch to appropriate local chain based on current chain type
      const targetLocalChain = this.isEvm() ? evmChainId : coreChainId;
      this.switchChain(targetLocalChain, true); // Force switch to local

      // Notify node running listeners
      this.notifyNodeRunningListeners();
    }
  }

  /**
   * Called when local node stops - can restore previous chain
   */
  onNodeStop(restorePrevious = true): void {
    if (this.isNodeRunning) {
      this.isNodeRunning = false;
      this.lockedToLocal = false;

      // Restore previous chain if requested and available
      if (restorePrevious && this.previousChainId) {
        this.switchChain(this.previousChainId, true);
        this.previousChainId = null;
      }

      // Notify node running listeners
      this.notifyNodeRunningListeners();
    }
  }

  /**
   * Check if node is currently running
   */
  getNodeRunningStatus(): boolean {
    return this.isNodeRunning;
  }

  /**
   * Check if selector is locked to local chains
   */
  isLockedToLocal(): boolean {
    return this.lockedToLocal;
  }

  onChainChange(listener: (chainId: SupportedChainId) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onNodeRunningChange(listener: (isRunning: boolean) => void): () => void {
    this.nodeRunningListeners.add(listener);
    return () => this.nodeRunningListeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentChainId);
      } catch (error) {
        console.error('Error in chain change listener:', error);
      }
    }
  }

  private notifyNodeRunningListeners(): void {
    for (const listener of this.nodeRunningListeners) {
      try {
        listener(this.isNodeRunning);
      } catch (error) {
        console.error('Error in node running listener:', error);
      }
    }
  }

  private isLocalChain(chainId: SupportedChainId): boolean {
    return chainId === 2029 || chainId === 2030;
  }

  // Helper methods for chain type detection
  isCore(): boolean {
    return this.getCurrentChain().type === 'core';
  }

  isEvm(): boolean {
    return this.getCurrentChain().type === 'evm';
  }

  isTestnet(): boolean {
    return this.getCurrentChain().testnet;
  }

  isLocal(): boolean {
    return this.currentChainId === 2029 || this.currentChainId === 2030;
  }

  // Get corresponding chain IDs
  getCorrespondingChainId(): SupportedChainId | null {
    switch (this.currentChainId) {
      case 1029:
        return 1030; // Core mainnet -> eSpace mainnet
      case 1030:
        return 1029; // eSpace mainnet -> Core mainnet
      case 1:
        return 71; // Core testnet -> eSpace testnet
      case 71:
        return 1; // eSpace testnet -> Core testnet
      case 2029:
        return 2030; // Core local -> eSpace local
      case 2030:
        return 2029; // eSpace local -> Core local
      default:
        return null;
    }
  }

  /**
   * Update local chain configurations with actual node URLs
   * Called when ServerManager starts with specific ports
   */
  updateLocalChainUrls(
    coreRpcPort: number,
    evmRpcPort: number,
    wsPort?: number
  ): void {
    // Update Core local chain
    const coreLocal = SUPPORTED_CHAINS[2029];
    if (coreLocal) {
      coreLocal.rpcUrls.default.http = [`http://localhost:${coreRpcPort}`];
      if (wsPort) {
        coreLocal.rpcUrls.default.webSocket = [`ws://localhost:${wsPort}`];
      }
    }

    // Update eSpace local chain
    const evmLocal = SUPPORTED_CHAINS[2030];
    if (evmLocal) {
      evmLocal.rpcUrls.default.http = [`http://localhost:${evmRpcPort}`];
    }
  }
}

// Default network selector instance
export const defaultNetworkSelector = new NetworkSelector();
