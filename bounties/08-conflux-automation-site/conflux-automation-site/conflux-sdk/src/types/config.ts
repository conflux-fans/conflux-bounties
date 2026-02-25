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

// Core Configuration Types
// Based on proven patterns from DevKit CLI and @xcfx/node

export interface NodeConfig {
  // Chain Configuration
  readonly chainId?: number; // Core space chain ID (default: 2029)
  readonly evmChainId?: number; // EVM space chain ID (default: 2030)

  // Network Ports
  readonly jsonrpcHttpPort?: number; // Core HTTP RPC port (default: 12537)
  readonly jsonrpcHttpEthPort?: number; // EVM HTTP RPC port (default: 8545)
  readonly jsonrpcWsPort?: number; // Core WebSocket port (default: 12538)
  readonly jsonrpcWsEthPort?: number; // EVM WebSocket port (default: 8546)

  // // Development Settings
  // readonly devBlockIntervalMs?: number; // Block generation interval (default: 1000)
  // readonly devPackTxImmediately?: boolean; // Pack transactions immediately

  // Data & Logging
  readonly confluxDataDir?: string; // Data directory path
  readonly log?: boolean; // Enable console logging
  readonly logConf?: string; // Custom log configuration file

  // Genesis Configuration
  readonly genesisSecrets?: readonly string[]; // Core space genesis private keys
  readonly genesisEvmSecrets?: readonly string[]; // EVM space genesis private keys
  readonly miningAuthor?: string; // Mining rewards recipient

  // Node Type
  readonly nodeType?: 'full' | 'archive' | 'light';
  readonly blockDbType?: 'rocksdb' | 'sqlite';
}

export interface ExtendedNodeConfig extends NodeConfig {
  // DevKit Extensions
  readonly accountCount?: number; // Number of accounts to generate per chain
  readonly silent?: boolean; // Suppress all logging
  readonly fundAccounts?: boolean; // Auto-fund generated accounts
  readonly enabledChains?: readonly ('core' | 'evm')[]; // Active chains

  // Derivation paths for account generation
  readonly derivationPaths?: {
    readonly core: string; // Core derivation path template
    readonly evm: string; // EVM derivation path template
  };
}

// Address and Hash Types
export type Address = string;
export type CoreAddress = string; // cfx:... format
export type EvmAddress = string; // 0x... format
export type Hash = string;
export type ChainType = 'core' | 'evm';

// Account Types
export interface UnifiedAccount {
  readonly id: string; // Unique identifier
  readonly name: string; // Human-readable name
  readonly index: number; // Derivation index
  readonly privateKey: string; // Private key (hex format)
  readonly derivationPath: string; // BIP32 derivation path

  // Chain-specific addresses (same private key, different formats)
  readonly coreAddress: CoreAddress; // cfx:... format
  readonly evmAddress: EvmAddress; // 0x... format

  // Chain-specific state
  readonly coreBalance: bigint;
  readonly evmBalance: bigint;
  readonly coreNonce: number;
  readonly evmNonce: number;

  // Metadata
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// Client Status Types
export interface ChainStatus {
  readonly isRunning: boolean;
  readonly chainId: number;
  readonly blockNumber: bigint;
  readonly gasPrice: bigint;
  readonly peerCount: number;
  readonly syncStatus: 'syncing' | 'synced';
  readonly latestBlockHash: string;
  readonly mining: boolean;
  readonly pendingTransactions: number;
  readonly rpcEndpoint: string;
  readonly wsEndpoint?: string;
}

export interface NodeStatus {
  readonly isRunning: boolean;
  readonly uptime: number;
  readonly startTime: Date | null;
  readonly core: ChainStatus;
  readonly evm: ChainStatus;
  readonly dataDir: string;
  readonly config: NodeConfig;
  readonly mining: MiningStatus;
}

export interface MiningStatus {
  readonly isRunning: boolean;
  readonly interval: number;
  readonly blocksMined: number;
  readonly startTime: Date | null;
  readonly lastBlockTime: Date | null;
}

// Transaction Types
export interface BaseTransaction {
  readonly to?: string;
  readonly value?: bigint;
  readonly data?: string;
  readonly gasLimit?: bigint;
  readonly gasPrice?: bigint;
  readonly nonce?: number;
}

export interface TransactionReceipt {
  readonly hash: string;
  readonly blockNumber: bigint;
  readonly blockHash: string;
  readonly transactionIndex: number;
  readonly status: 'success' | 'reverted';
  readonly gasUsed: bigint;
  readonly contractAddress?: string;
  readonly logs: readonly Log[];
}

export interface Log {
  readonly address: string;
  readonly topics: readonly string[];
  readonly data: string;
  readonly blockNumber: bigint;
  readonly transactionHash: string;
  readonly logIndex: number;
}

// Error Types
export interface ConfluxNodeError extends Error {
  readonly code: string;
  readonly chain?: ChainType;
  readonly context?: Record<string, unknown>;
}

export class NodeError extends Error implements ConfluxNodeError {
  public readonly code: string;
  public readonly chain?: ChainType;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    chain?: ChainType,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'NodeError';
    this.code = code;
    this.chain = chain;
    this.context = context;
  }
}

// Event Types
export interface BlockEvent {
  readonly chainType: ChainType;
  readonly blockNumber: bigint;
  readonly blockHash: string;
  readonly timestamp: number;
  readonly transactionCount: number;
}

export interface TransactionEvent {
  readonly chainType: ChainType;
  readonly hash: string;
  readonly from: string;
  readonly to?: string;
  readonly value: bigint;
  readonly blockNumber: bigint;
}

// Utility Types
export type EventCallback<T> = (event: T) => void;
export type UnwatchFunction = () => void;

// Server Management Types
export type ServerStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'error';

export interface ServerConfig {
  readonly coreRpcPort?: number;
  readonly evmRpcPort?: number;
  readonly wsPort?: number;
  readonly chainId?: number;
  readonly evmChainId?: number;
  readonly accounts?: number;
  readonly balance?: string;
  readonly mnemonic?: string;
  readonly logging?: boolean;
  readonly detached?: boolean;
  readonly mining?: MiningConfig;
  readonly devBlockIntervalMs?: number; // Auto block generation interval in ms (undefined = disabled)
  readonly devPackTxImmediately?: boolean; // Pack transactions immediately for responsiveness
  readonly dataDir?: string; // Data directory for Conflux node (default: /workspace/.conflux-dev)
}

export interface MiningConfig {
  readonly enabled: boolean;
  readonly interval: number; // milliseconds between blocks
  readonly autoStart: boolean; // start mining when server starts
}

export interface AccountInfo {
  readonly index: number;
  readonly privateKey: string;
  readonly coreAddress: string;
  readonly evmAddress: string;
  readonly mnemonic: string;
  readonly path: string;
  readonly evmPrivateKey?: string; // Ethereum-derived private key for EVM operations
  readonly evmPath?: string; // Ethereum derivation path (m/44'/60'/0'/0/i)
}

// Additional types will be migrated from devkit-node as needed
