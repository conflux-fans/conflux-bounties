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
 * Wallet Types for HD Derivation
 *
 * Provides unified types for BIP32/BIP39 HD wallet derivation
 * supporting both Conflux Core Space and eSpace (EVM).
 */

/**
 * Derived account with dual-chain support.
 * Uses separate derivation paths for Core Space (coin type 503)
 * and eSpace (coin type 60).
 */
export interface DerivedAccount {
  /** Account index in derivation sequence */
  index: number;
  /** Core Space address (cfx:...) */
  coreAddress: string;
  /** eSpace address (0x...) */
  evmAddress: string;
  /** Core Space private key from m/44'/503'/accountType'/0/index */
  corePrivateKey: `0x${string}`;
  /** eSpace private key from m/44'/60'/accountType'/0/index */
  evmPrivateKey: `0x${string}`;
  /** Derivation paths used */
  paths: {
    /** Core Space derivation path */
    core: string;
    /** eSpace derivation path */
    evm: string;
  };
}

/**
 * Options for deriving accounts from a mnemonic
 */
export interface DerivationOptions {
  /** Number of accounts to derive */
  count: number;
  /** Starting index (default: 0) */
  startIndex?: number;
  /** Core Space network ID for address encoding (default: 2029 for local) */
  coreNetworkId?: number;
  /**
   * Account type determines the derivation path:
   * - 'standard' (default): m/44'/{coin}'/0'/0/{index} - Regular user accounts
   * - 'mining': m/44'/{coin}'/1'/0/{index} - Mining/faucet accounts
   */
  accountType?: 'standard' | 'mining';
}

/**
 * Result of mnemonic validation
 */
export interface MnemonicValidation {
  /** Whether the mnemonic is valid */
  valid: boolean;
  /** Number of words in the mnemonic */
  wordCount: number;
  /** Error message if invalid */
  error?: string;
}

/**
 * Coin type constants for BIP44 derivation paths
 */
export const COIN_TYPES = {
  /** Conflux Core Space - registered coin type 503 */
  CONFLUX: 503,
  /** Ethereum/eSpace - standard coin type 60 */
  ETHEREUM: 60,
} as const;

/**
 * Network IDs for Conflux Core Space address encoding
 */
export const CORE_NETWORK_IDS = {
  /** Local development network */
  LOCAL: 2029,
  /** Testnet */
  TESTNET: 1,
  /** Mainnet */
  MAINNET: 1029,
} as const;
