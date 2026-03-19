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

// Unified Client Interfaces
// Abstract the differences between cive and viem clients

import type {
  Address,
  BaseTransaction,
  BlockEvent,
  ChainType,
  EventCallback,
  TransactionEvent,
  TransactionReceipt,
  UnwatchFunction,
} from './config.js';

/**
 * Unified interface for both Core and EVM clients
 * Abstracts away the differences between cive and viem
 */
export interface ChainClient {
  readonly chainType: ChainType;
  readonly chainId: number;
  readonly address: Address;

  // Basic Operations
  getBlockNumber(): Promise<bigint>;
  getBalance(address: Address): Promise<string>;
  getGasPrice(): Promise<bigint>;
  estimateGas(tx: BaseTransaction): Promise<bigint>;

  // Transaction Operations
  sendTransaction(tx: BaseTransaction): Promise<string>;
  waitForTransaction(hash: string): Promise<TransactionReceipt>;

  // Token Operations
  getTokenBalance(
    tokenAddress: Address,
    holderAddress?: Address
  ): Promise<string>;

  // Event Watching
  watchBlocks(callback: EventCallback<BlockEvent>): UnwatchFunction;
  watchTransactions(callback: EventCallback<TransactionEvent>): UnwatchFunction;

  // Utility Methods
  isValidAddress(address: string): boolean;
  formatAmount(amount: bigint): string;
  parseAmount(amount: string): bigint;

  // Access to underlying client (for advanced operations)
  getInternalClient(): unknown;
}

/**
 * Wallet client interface for signing transactions
 */
export interface WalletClient {
  readonly address: Address;
  readonly chainType: ChainType;

  // Transaction signing and sending
  sendTransaction(tx: BaseTransaction): Promise<string>;
  signMessage(message: string): Promise<string>;

  // Access to underlying wallet client
  getInternalClient(): unknown;
}

/**
 * Test client interface for development operations
 */
export interface TestClient extends ChainClient {
  // Development operations
  mine(blocks?: number): Promise<void>;
  setNextBlockTimestamp(timestamp: number): Promise<void>;
  increaseTime(seconds: number): Promise<void>;

  // Account management
  impersonateAccount(address: Address): Promise<void>;
  stopImpersonatingAccount(address: Address): Promise<void>;

  // Balance manipulation
  setBalance(address: Address, balance: bigint): Promise<void>;

  // Contract interaction helpers
  getStorageAt(address: Address, slot: string): Promise<string>;
  setStorageAt(address: Address, slot: string, value: string): Promise<void>;
}

/**
 * Client factory interface
 */
export interface ClientFactory {
  createPublicClient(chainType: ChainType, config: ClientConfig): ChainClient;
  createWalletClient(chainType: ChainType, config: WalletConfig): WalletClient;
  createTestClient(chainType: ChainType, config: TestConfig): TestClient;
}

/**
 * Configuration interfaces for client creation
 */
export interface ClientConfig {
  readonly rpcUrl: string;
  readonly wsUrl?: string;
  readonly chainId: number;
  readonly pollingInterval?: number;
  readonly account?: string | { privateKey: string; accountIndex?: number };
  readonly testMode?: boolean;
}

export interface WalletConfig extends ClientConfig {
  readonly privateKey: string;
  readonly accountIndex?: number;
}

export interface TestConfig extends ClientConfig {
  readonly enableTestMode: boolean;
}

/**
 * Client manager interface
 * Manages lifecycle of both Core and EVM clients
 */
export interface ClientManager {
  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  // Client access
  getCoreClient(): ChainClient;
  getEvmClient(): ChainClient;
  getCoreWalletClient(accountIndex?: number): WalletClient;
  getEvmWalletClient(accountIndex?: number): WalletClient;
  getCoreTestClient(): TestClient;
  getEvmTestClient(): TestClient;

  // Status
  isInitialized(): boolean;
  getStatus(): {
    core: { isConnected: boolean; blockNumber: bigint };
    evm: { isConnected: boolean; blockNumber: bigint };
  };

  // Health checking
  checkHealth(): Promise<boolean>;

  // Event management
  on(event: 'block', callback: EventCallback<BlockEvent>): void;
  on(event: 'transaction', callback: EventCallback<TransactionEvent>): void;
  on(event: 'error', callback: EventCallback<Error>): void;
  off(event: 'block', callback: EventCallback<BlockEvent>): void;
  off(event: 'transaction', callback: EventCallback<TransactionEvent>): void;
  off(event: 'error', callback: EventCallback<Error>): void;
}
