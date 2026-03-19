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

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type {
  EmbeddedWallet,
  EmbeddedWalletOptions,
  SignedTransaction,
  SignTransactionRequest,
  WalletExport,
} from '../types/index.js';
import { EmbeddedWalletError } from '../types/index.js';

/**
 * Embedded Wallet Manager
 *
 * Manages server-side custody wallets for users.
 * Provides secure wallet creation, storage, and transaction signing.
 *
 * SECURITY WARNING:
 * This is a simplified implementation for development and testing.
 * Production use requires:
 * - Hardware Security Modules (HSM)
 * - Proper key management infrastructure
 * - Multi-signature schemes
 * - Audit logging
 * - Compliance with custody regulations
 *
 * Use Cases:
 * - Social login wallets (Privy, Magic, Web3Auth)
 * - Custodial game wallets
 * - Enterprise treasury management
 * - Automated service accounts
 *
 * @example
 * ```typescript
 * const manager = new EmbeddedWalletManager();
 *
 * // Create wallet for user
 * const wallet = await manager.createWallet('user123', 'secure-password');
 *
 * // Sign transaction
 * const signed = await manager.signTransaction('user123', 'secure-password', {
 *   to: '0xRecipient...',
 *   value: parseEther('1.0'),
 *   chain: 'evm'
 * });
 *
 * // Export wallet for user
 * const exportData = await manager.exportWallet('user123', 'secure-password');
 * ```
 */
export class EmbeddedWalletManager {
  private wallets: Map<string, EmbeddedWallet> = new Map();
  private options: Required<EmbeddedWalletOptions>;

  constructor(options: EmbeddedWalletOptions = {}) {
    this.options = {
      algorithm: options.algorithm || 'aes-256-gcm',
      iterations: options.iterations || 100000,
      autoCreate: options.autoCreate !== false, // Default true
    };
  }

  /**
   * Create a new embedded wallet for a user
   *
   * @param userId - User identifier
   * @param password - Encryption password
   * @returns Created wallet (without private key)
   */
  async createWallet(
    userId: string,
    password: string
  ): Promise<Omit<EmbeddedWallet, 'encryptedPrivateKey'>> {
    // Check if wallet already exists
    if (this.wallets.has(userId)) {
      throw new EmbeddedWalletError('Wallet already exists', { userId });
    }

    // Generate new private key
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    // Encrypt private key
    // NOTE: This is a simplified implementation
    // Production should use proper encryption libraries (crypto-js, node:crypto, etc.)
    const { encrypted, iv, salt } = await this.encryptPrivateKey(
      privateKey,
      password
    );

    // Create EVM address
    const evmAddress = account.address;

    // Create Core Space address
    // NOTE: In production, use proper Core Space address derivation
    const coreAddress = `cfx:${evmAddress.slice(2)}`;

    const wallet: EmbeddedWallet = {
      userId,
      coreAddress,
      evmAddress,
      encryptedPrivateKey: encrypted,
      encryption: {
        algorithm: this.options.algorithm,
        iv,
        salt,
      },
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      isActive: true,
    };

    this.wallets.set(userId, wallet);

    // Return wallet without encrypted private key
    const { encryptedPrivateKey: _, ...publicWallet } = wallet;
    return publicWallet;
  }

  /**
   * Get wallet info (without private key)
   *
   * @param userId - User identifier
   * @returns Wallet info or undefined
   */
  getWallet(
    userId: string
  ): Omit<EmbeddedWallet, 'encryptedPrivateKey'> | undefined {
    const wallet = this.wallets.get(userId);
    if (!wallet) return undefined;

    wallet.lastAccessedAt = new Date();
    const { encryptedPrivateKey: _, ...publicWallet } = wallet;
    return publicWallet;
  }

  /**
   * Check if user has a wallet
   *
   * @param userId - User identifier
   * @returns true if wallet exists
   */
  hasWallet(userId: string): boolean {
    return this.wallets.has(userId);
  }

  /**
   * Sign transaction with user's embedded wallet
   *
   * @param userId - User identifier
   * @param password - Decryption password
   * @param request - Transaction request
   * @returns Signed transaction
   */
  async signTransaction(
    userId: string,
    password: string,
    request: SignTransactionRequest
  ): Promise<SignedTransaction> {
    const wallet = this.wallets.get(userId);
    if (!wallet) {
      throw new EmbeddedWalletError('Wallet not found', { userId });
    }

    if (!wallet.isActive) {
      throw new EmbeddedWalletError('Wallet is not active', { userId });
    }

    // Decrypt private key
    const privateKey = await this.decryptPrivateKey(
      wallet.encryptedPrivateKey,
      password,
      wallet.encryption.iv,
      wallet.encryption.salt
    );

    // Create account
    const account = privateKeyToAccount(privateKey as `0x${string}`);

    // Update last accessed
    wallet.lastAccessedAt = new Date();

    // Sign transaction
    // Note: Simplified implementation
    const serialized = JSON.stringify({
      from: account.address,
      ...request,
      value: request.value?.toString(),
      gasLimit: request.gasLimit?.toString(),
      gasPrice: request.gasPrice?.toString(),
    });

    const signature = await account.signMessage({
      message: serialized,
    });

    return {
      rawTransaction: signature,
      hash: `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')}`,
      from: account.address,
      chain: request.chain,
    };
  }

  /**
   * Export wallet for user backup
   *
   * @param userId - User identifier
   * @param password - Encryption password
   * @returns Encrypted wallet export
   */
  async exportWallet(userId: string, password: string): Promise<WalletExport> {
    const wallet = this.wallets.get(userId);
    if (!wallet) {
      throw new EmbeddedWalletError('Wallet not found', { userId });
    }

    // Re-encrypt with user's password for export
    // In production, verify password first
    const exportData = JSON.stringify({
      coreAddress: wallet.coreAddress,
      evmAddress: wallet.evmAddress,
      encryptedPrivateKey: wallet.encryptedPrivateKey,
      encryption: wallet.encryption,
    });

    const { encrypted, iv, salt } = await this.encryptPrivateKey(
      exportData,
      password
    );

    return {
      userId,
      encryptedData: encrypted,
      encryption: {
        algorithm: this.options.algorithm,
        iv,
        salt,
      },
      exportedAt: new Date(),
    };
  }

  /**
   * Deactivate wallet
   *
   * @param userId - User identifier
   */
  deactivateWallet(userId: string): void {
    const wallet = this.wallets.get(userId);
    if (wallet) {
      wallet.isActive = false;
    }
  }

  /**
   * Delete wallet permanently
   *
   * WARNING: This operation cannot be undone
   *
   * @param userId - User identifier
   * @returns true if deleted, false if not found
   */
  deleteWallet(userId: string): boolean {
    return this.wallets.delete(userId);
  }

  /**
   * List all wallets (without private keys)
   *
   * @returns Array of wallet info
   */
  listWallets(): Array<Omit<EmbeddedWallet, 'encryptedPrivateKey'>> {
    return Array.from(this.wallets.values()).map((wallet) => {
      const { encryptedPrivateKey: _, ...publicWallet } = wallet;
      return publicWallet;
    });
  }

  /**
   * Get wallet statistics
   *
   * @returns Wallet statistics
   */
  getStats() {
    const all = Array.from(this.wallets.values());
    const active = all.filter((w) => w.isActive);

    return {
      total: all.length,
      active: active.length,
      inactive: all.length - active.length,
    };
  }

  /**
   * Encrypt private key
   *
   * NOTE: Simplified implementation for demonstration
   * Production should use proper encryption (node:crypto, @noble/ciphers, etc.)
   */
  private async encryptPrivateKey(
    data: string,
    password: string
  ): Promise<{ encrypted: string; iv: string; salt: string }> {
    // Generate random IV and salt
    const iv = Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0')
    ).join('');

    const salt = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0')
    ).join('');

    // In production, use proper key derivation (PBKDF2, scrypt, argon2)
    // and encryption (AES-256-GCM)
    const mockEncrypted = Buffer.from(
      JSON.stringify({ data, password, iv, salt })
    ).toString('base64');

    return {
      encrypted: mockEncrypted,
      iv,
      salt,
    };
  }

  /**
   * Decrypt private key
   *
   * NOTE: Simplified implementation for demonstration
   */
  private async decryptPrivateKey(
    encrypted: string,
    password: string,
    _iv: string,
    _salt: string
  ): Promise<string> {
    try {
      // In production, use proper decryption
      const decoded = JSON.parse(
        Buffer.from(encrypted, 'base64').toString('utf-8')
      );

      if (decoded.password !== password) {
        throw new Error('Invalid password');
      }

      return decoded.data;
    } catch (error) {
      throw new EmbeddedWalletError('Failed to decrypt private key', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
