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

/**
 * Keystore Version 2 Schema
 *
 * Breaking changes from v1:
 * - adminPrivateKey removed (admins identified by wallet address only)
 * - Multiple admin addresses supported
 * - Per-mnemonic node configuration
 * - Derived keys cached and encrypted
 * - Immutable node configuration
 */

/**
 * Main keystore file structure
 */
export interface KeystoreV2 {
  version: 2;
  setupCompleted: boolean;
  setupCompletedAt?: string; // ISO 8601 timestamp

  // Multi-admin support
  adminAddresses: string[]; // Ethereum addresses (0x...)

  // Encryption settings
  encryptionEnabled: boolean;
  encryptionSalt?: string; // Base64, only if encryptionEnabled

  // Mnemonics with node configurations
  mnemonics: MnemonicEntry[];
  activeIndex: number; // Index in mnemonics array
}

/**
 * Individual mnemonic entry with node configuration
 */
export interface MnemonicEntry {
  id: string; // Unique ID: "mnemonic_{timestamp}"
  label: string; // User-friendly name
  type: 'plaintext' | 'encrypted';
  mnemonic: string; // Plaintext or "base64[iv+data]"
  createdAt: string; // ISO 8601

  nodeConfig: NodeConfig;
  derivedKeys: DerivedKeys;
}

/**
 * Node configuration bound to a mnemonic
 * Immutable once blockchain data exists
 */
export interface NodeConfig {
  accountsCount: number; // 1-20 (genesis accounts)
  chainId: number; // Core Space chain ID (default 2029)
  evmChainId: number; // eSpace chain ID (default 2030)
  miningAuthor: 'auto' | string; // 'auto' = account[accountsCount], or explicit address
  immutable: boolean; // Always true after creation
  configHash: string; // SHA-256 of config for integrity check
  createdAt: string; // ISO 8601
}

/**
 * Derived account keys (genesis + faucet)
 * Encrypted if keystore encryption enabled
 */
export interface DerivedKeys {
  type: 'plaintext' | 'encrypted';
  genesisAccounts: DerivedAccount[] | string; // Array if plaintext, base64 if encrypted
  faucetAccount: DerivedAccount | string; // Object if plaintext, base64 if encrypted
}

/**
 * Single derived account with addresses and private keys for both chains
 */
export interface DerivedAccount {
  index: number;
  core: string; // Core Space address (net2029:...)
  evm: string; // eSpace address (0x...)
  privateKey: string; // Core Space private key (0x...) - from m/44'/503'/0'/0/i
  evmPrivateKey: string; // eSpace private key (0x...) - from m/44'/60'/0'/0/i
  // Legacy properties for backward compatibility
  address?: string; // Same as core or evm depending on network
  path?: string; // BIP-32 derivation path
  network?: 'core' | 'espace'; // Network type
}

/**
 * Encrypted data format (used in mnemonic and derivedKeys)
 */
export interface EncryptedData {
  iv: string; // Base64 initialization vector
  data: string; // Base64 encrypted data
}

/**
 * Summary of a mnemonic (without sensitive data)
 */
export interface MnemonicSummary {
  id: string;
  label: string;
  type: 'plaintext' | 'encrypted';
  isActive: boolean;
  createdAt: string;
  nodeConfig: NodeConfig;
  dataDir: string; // Full path to data directory
  dataSize: string; // Human-readable size (e.g., "125MB")
}

/**
 * Setup data for initial configuration
 */
export interface SetupData {
  adminAddress: string; // First admin address
  mnemonic: string; // Generated or imported
  mnemonicLabel: string;
  nodeConfig: {
    accountsCount: number;
    chainId: number;
    evmChainId: number;
    miningAuthor?: string; // Optional, defaults to 'auto'
  };
  encryption?: {
    enabled: boolean;
    password?: string; // Required if enabled=true
  };
}

/**
 * Data for adding a new mnemonic
 */
export interface AddMnemonicData {
  mnemonic: string;
  label: string;
  nodeConfig: {
    accountsCount: number;
    chainId: number;
    evmChainId: number;
    miningAuthor?: string;
  };
  setAsActive?: boolean; // Default false
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Node configuration modification check result
 */
export interface ConfigModificationCheck {
  canModify: boolean;
  reason?: string;
  dataDir?: string;
  lockFile?: string;
}
