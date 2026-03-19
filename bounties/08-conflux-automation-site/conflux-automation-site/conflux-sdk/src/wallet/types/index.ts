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

import type { ChainType } from '../../types/index.js';

/**
 * Session Key Types
 */

export interface SessionKeyPermissions {
  /** Maximum value per transaction (in wei) */
  maxValue?: bigint;
  /** Whitelisted contract addresses */
  contracts?: string[];
  /** Allowed operations/function signatures */
  operations?: string[];
  /** Allowed chains */
  chains?: ChainType[];
}

export interface SessionKey {
  /** Unique identifier for this session key */
  id: string;
  /** The session key's private key */
  privateKey: string;
  /** The session key's address */
  address: string;
  /** Parent wallet address */
  parentAddress: string;
  /** Time-to-live in seconds */
  ttl: number;
  /** Expiration timestamp */
  expiresAt: Date;
  /** Session key permissions */
  permissions: SessionKeyPermissions;
  /** Creation timestamp */
  createdAt: Date;
  /** Whether the session key is active */
  isActive: boolean;
  /** Chain type */
  chain: ChainType;
}

export interface SessionKeyOptions {
  /** Time-to-live in seconds (default: 3600) */
  ttl?: number;
  /** Session key permissions */
  permissions?: SessionKeyPermissions;
  /** Chain type */
  chain: ChainType;
}

/**
 * Transaction Batching Types
 */

export interface BatchTransaction {
  /** Unique identifier */
  id: string;
  /** Target address */
  to: string;
  /** Value to send (in wei) */
  value?: bigint;
  /** Transaction data */
  data?: string;
  /** Gas limit */
  gasLimit?: bigint;
  /** Chain type */
  chain: ChainType;
  /** Added timestamp */
  addedAt: Date;
}

export interface BatchResult {
  /** Batch identifier */
  batchId: string;
  /** Transaction hashes */
  transactionHashes: string[];
  /** Number of successful transactions */
  successCount: number;
  /** Number of failed transactions */
  failureCount: number;
  /** Execution timestamp */
  executedAt: Date;
  /** Total gas used */
  totalGasUsed: bigint;
  /** Chain type */
  chain: ChainType;
}

export interface BatcherOptions {
  /** Maximum batch size */
  maxBatchSize?: number;
  /** Auto-execute batch after timeout (ms) */
  autoExecuteTimeout?: number;
  /** Minimum gas price (in wei) */
  minGasPrice?: bigint;
}

/**
 * Embedded Wallet Types
 */

export interface EmbeddedWallet {
  /** User identifier */
  userId: string;
  /** Wallet address (Core Space) */
  coreAddress: string;
  /** Wallet address (eSpace) */
  evmAddress: string;
  /** Encrypted private key */
  encryptedPrivateKey: string;
  /** Encryption metadata */
  encryption: {
    algorithm: string;
    iv: string;
    salt: string;
  };
  /** Creation timestamp */
  createdAt: Date;
  /** Last accessed timestamp */
  lastAccessedAt: Date;
  /** Whether the wallet is active */
  isActive: boolean;
}

export interface WalletExport {
  /** User identifier */
  userId: string;
  /** Encrypted wallet data */
  encryptedData: string;
  /** Encryption metadata */
  encryption: {
    algorithm: string;
    iv: string;
    salt: string;
  };
  /** Export timestamp */
  exportedAt: Date;
}

export interface EmbeddedWalletOptions {
  /** Encryption algorithm (default: 'aes-256-gcm') */
  algorithm?: string;
  /** Key derivation iterations (default: 100000) */
  iterations?: number;
  /** Whether to auto-create wallets for new users */
  autoCreate?: boolean;
}

/**
 * Transaction Signing Types
 */

export interface SignTransactionRequest {
  /** Transaction to sign */
  to: string;
  value?: bigint;
  data?: string;
  gasLimit?: bigint;
  gasPrice?: bigint;
  nonce?: number;
  /** Chain type */
  chain: ChainType;
}

export interface SignedTransaction {
  /** Raw signed transaction */
  rawTransaction: string;
  /** Transaction hash */
  hash: string;
  /** Signer address */
  from: string;
  /** Chain type */
  chain: ChainType;
}

/**
 * Wallet Manager Types
 */

export interface WalletManagerOptions {
  /** Session key options */
  sessionKeys?: SessionKeyOptions;
  /** Batcher options */
  batcher?: BatcherOptions;
  /** Embedded wallet options */
  embedded?: EmbeddedWalletOptions;
}

/**
 * Error Types
 */

export class WalletError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WalletError';
  }
}

export class SessionKeyError extends WalletError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SESSION_KEY_ERROR', context);
    this.name = 'SessionKeyError';
  }
}

export class BatcherError extends WalletError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'BATCHER_ERROR', context);
    this.name = 'BatcherError';
  }
}

export class EmbeddedWalletError extends WalletError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'EMBEDDED_WALLET_ERROR', context);
    this.name = 'EmbeddedWalletError';
  }
}
