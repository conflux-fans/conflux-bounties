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
 * HD Wallet Derivation for Conflux DevKit
 *
 * Provides unified BIP32/BIP39 HD wallet derivation supporting both
 * Conflux Core Space and eSpace (EVM) addresses.
 *
 * Uses modern, audited libraries:
 * - @scure/bip32 for HD key derivation
 * - @scure/bip39 for mnemonic generation/validation
 *
 * Derivation Paths:
 * - Core Space (standard): m/44'/503'/0'/0/{index}
 * - eSpace (standard): m/44'/60'/0'/0/{index}
 * - Core Space (mining): m/44'/503'/1'/0/{index}
 * - eSpace (mining): m/44'/60'/1'/0/{index}
 */

import { HDKey } from '@scure/bip32';
import {
  generateMnemonic as generateBip39Mnemonic,
  mnemonicToSeedSync,
  validateMnemonic as validateBip39Mnemonic,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { privateKeyToAccount as civePrivateKeyToAccount } from 'cive/accounts';
import { bytesToHex } from 'viem';
import { privateKeyToAccount as viemPrivateKeyToAccount } from 'viem/accounts';

import {
  COIN_TYPES,
  CORE_NETWORK_IDS,
  type DerivationOptions,
  type DerivedAccount,
  type MnemonicValidation,
} from './types.js';

/**
 * Generate a new BIP-39 mnemonic phrase
 *
 * @param strength - 128 for 12 words (default) or 256 for 24 words
 * @returns A valid BIP-39 mnemonic phrase
 *
 * @example
 * ```typescript
 * const mnemonic = generateMnemonic(); // 12 words
 * const mnemonic24 = generateMnemonic(256); // 24 words
 * ```
 */
export function generateMnemonic(strength: 128 | 256 = 128): string {
  return generateBip39Mnemonic(wordlist, strength);
}

/**
 * Validate a mnemonic phrase
 *
 * Checks that the mnemonic has a valid word count (12 or 24)
 * and passes BIP-39 checksum validation.
 *
 * @param mnemonic - The mnemonic phrase to validate
 * @returns Validation result with details
 *
 * @example
 * ```typescript
 * const result = validateMnemonic('abandon abandon ...');
 * if (result.valid) {
 *   console.log(`Valid ${result.wordCount}-word mnemonic`);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateMnemonic(mnemonic: string): MnemonicValidation {
  const normalizedMnemonic = mnemonic.trim().toLowerCase();
  const words = normalizedMnemonic.split(/\s+/);
  const wordCount = words.length;

  if (wordCount !== 12 && wordCount !== 24) {
    return {
      valid: false,
      wordCount,
      error: `Invalid word count: ${wordCount}. Must be 12 or 24.`,
    };
  }

  const valid = validateBip39Mnemonic(normalizedMnemonic, wordlist);
  return {
    valid,
    wordCount,
    error: valid ? undefined : 'Invalid mnemonic: checksum verification failed',
  };
}

/**
 * Derive multiple accounts from a mnemonic phrase
 *
 * Derives accounts for both Conflux Core Space and eSpace using
 * BIP-44 standard derivation paths:
 * - Core Space: m/44'/503'/{accountType}'/0/{index}
 * - eSpace: m/44'/60'/{accountType}'/0/{index}
 *
 * @param mnemonic - BIP-39 mnemonic phrase
 * @param options - Derivation options
 * @returns Array of derived accounts
 * @throws Error if mnemonic is invalid
 *
 * @example
 * ```typescript
 * const accounts = deriveAccounts(mnemonic, {
 *   count: 10,
 *   coreNetworkId: 2029, // Local network
 * });
 * console.log(accounts[0].coreAddress); // cfx:...
 * console.log(accounts[0].evmAddress);  // 0x...
 * ```
 */
export function deriveAccounts(
  mnemonic: string,
  options: DerivationOptions
): DerivedAccount[] {
  const {
    count,
    startIndex = 0,
    coreNetworkId = CORE_NETWORK_IDS.LOCAL,
    accountType = 'standard',
  } = options;

  // Validate mnemonic
  const validation = validateMnemonic(mnemonic);
  if (!validation.valid) {
    throw new Error(`Invalid mnemonic: ${validation.error}`);
  }

  // Generate seed from mnemonic
  const normalizedMnemonic = mnemonic.trim().toLowerCase();
  const seed = mnemonicToSeedSync(normalizedMnemonic);
  const masterKey = HDKey.fromMasterSeed(seed);

  const accounts: DerivedAccount[] = [];
  // Standard accounts use 0', mining accounts use 1'
  const accountTypeIndex = accountType === 'standard' ? 0 : 1;

  for (let i = startIndex; i < startIndex + count; i++) {
    // Derive Core Space key (coin type 503)
    const corePath = `m/44'/${COIN_TYPES.CONFLUX}'/${accountTypeIndex}'/0/${i}`;
    const coreKey = masterKey.derive(corePath);

    // Derive eSpace key (coin type 60)
    const evmPath = `m/44'/${COIN_TYPES.ETHEREUM}'/${accountTypeIndex}'/0/${i}`;
    const evmKey = masterKey.derive(evmPath);

    if (!coreKey.privateKey || !evmKey.privateKey) {
      throw new Error(`Failed to derive keys at index ${i}`);
    }

    const corePrivateKey = bytesToHex(coreKey.privateKey) as `0x${string}`;
    const evmPrivateKey = bytesToHex(evmKey.privateKey) as `0x${string}`;

    // Create accounts to get addresses
    const coreAccount = civePrivateKeyToAccount(corePrivateKey, {
      networkId: coreNetworkId,
    });
    const evmAccount = viemPrivateKeyToAccount(evmPrivateKey);

    accounts.push({
      index: i,
      coreAddress: coreAccount.address,
      evmAddress: evmAccount.address,
      corePrivateKey,
      evmPrivateKey,
      paths: {
        core: corePath,
        evm: evmPath,
      },
    });
  }

  return accounts;
}

/**
 * Derive a single account at a specific index
 *
 * Convenience function for deriving just one account.
 *
 * @param mnemonic - BIP-39 mnemonic phrase
 * @param index - Account index to derive
 * @param coreNetworkId - Core Space network ID (default: 2029 for local)
 * @param accountType - 'standard' or 'mining' (default: 'standard')
 * @returns The derived account
 *
 * @example
 * ```typescript
 * const account = deriveAccount(mnemonic, 5);
 * console.log(account.index); // 5
 * ```
 */
export function deriveAccount(
  mnemonic: string,
  index: number,
  coreNetworkId: number = CORE_NETWORK_IDS.LOCAL,
  accountType: 'standard' | 'mining' = 'standard'
): DerivedAccount {
  const accounts = deriveAccounts(mnemonic, {
    count: 1,
    startIndex: index,
    coreNetworkId,
    accountType,
  });
  return accounts[0];
}

/**
 * Derive the faucet/mining account
 *
 * The faucet account uses a separate derivation path (mining type)
 * at index 0. This is used for the mining rewards recipient and
 * as the source for faucet operations.
 *
 * @param mnemonic - BIP-39 mnemonic phrase
 * @param coreNetworkId - Core Space network ID (default: 2029 for local)
 * @returns The faucet account
 *
 * @example
 * ```typescript
 * const faucet = deriveFaucetAccount(mnemonic);
 * // Uses paths: m/44'/503'/1'/0/0 and m/44'/60'/1'/0/0
 * ```
 */
export function deriveFaucetAccount(
  mnemonic: string,
  coreNetworkId: number = CORE_NETWORK_IDS.LOCAL
): DerivedAccount {
  return deriveAccount(mnemonic, 0, coreNetworkId, 'mining');
}

/**
 * Get the derivation path for an account
 *
 * Utility function to generate standard derivation paths.
 *
 * @param coinType - Coin type (503 for Conflux, 60 for Ethereum)
 * @param index - Account index
 * @param accountType - 'standard' (0') or 'mining' (1')
 * @returns The BIP-44 derivation path
 */
export function getDerivationPath(
  coinType: number,
  index: number,
  accountType: 'standard' | 'mining' = 'standard'
): string {
  const accountTypeIndex = accountType === 'standard' ? 0 : 1;
  return `m/44'/${coinType}'/${accountTypeIndex}'/0/${index}`;
}
