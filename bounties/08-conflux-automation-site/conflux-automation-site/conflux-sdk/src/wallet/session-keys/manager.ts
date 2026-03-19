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

import { privateKeyToAccount } from 'viem/accounts';
import type {
  SessionKey,
  SessionKeyOptions,
  SignedTransaction,
  SignTransactionRequest,
} from '../types/index.js';
import { SessionKeyError } from '../types/index.js';

/**
 * Session Key Manager
 *
 * Manages temporary session keys for delegated transaction signing.
 * Session keys allow applications to sign transactions on behalf of users
 * with time-limited and permission-scoped access.
 *
 * Use Cases:
 * - Gaming: Allow game to make in-game purchases without repeated wallet prompts
 * - Trading: Enable automated trading bots with spending limits
 * - DeFi: Permit auto-compounding or rebalancing with constraints
 *
 * @example
 * ```typescript
 * const manager = new SessionKeyManager();
 *
 * // Create session key with 1 hour TTL and spending limit
 * const sessionKey = manager.generateSessionKey(
 *   '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
 *   {
 *     ttl: 3600,
 *     permissions: {
 *       maxValue: parseEther('1.0'),
 *       contracts: ['0xGameContract...']
 *     },
 *     chain: 'evm'
 *   }
 * );
 *
 * // Use session key to sign transactions
 * const signedTx = await manager.signWithSessionKey(sessionKey.id, {
 *   to: '0xGameContract...',
 *   data: '0x...',
 *   chain: 'evm'
 * });
 * ```
 */
export class SessionKeyManager {
  private sessionKeys: Map<string, SessionKey> = new Map();

  /**
   * Generate a new session key
   *
   * @param parentAddress - Parent wallet address
   * @param options - Session key configuration
   * @returns Created session key
   */
  generateSessionKey(
    parentAddress: string,
    options: SessionKeyOptions
  ): SessionKey {
    // Generate random private key for session
    const privateKey = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}` as `0x${string}`;

    const account = privateKeyToAccount(privateKey);

    const ttl = options.ttl || 3600; // Default 1 hour
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const sessionKey: SessionKey = {
      id: `sk_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      privateKey,
      address: account.address,
      parentAddress,
      ttl,
      expiresAt,
      permissions: options.permissions || {},
      createdAt: now,
      isActive: true,
      chain: options.chain,
    };

    this.sessionKeys.set(sessionKey.id, sessionKey);
    return sessionKey;
  }

  /**
   * Get session key by ID
   *
   * @param sessionKeyId - Session key identifier
   * @returns Session key or undefined
   */
  getSessionKey(sessionKeyId: string): SessionKey | undefined {
    const sessionKey = this.sessionKeys.get(sessionKeyId);

    // Check if expired
    if (sessionKey && new Date() > sessionKey.expiresAt) {
      sessionKey.isActive = false;
    }

    return sessionKey;
  }

  /**
   * Revoke a session key
   *
   * @param sessionKeyId - Session key identifier
   */
  revokeSessionKey(sessionKeyId: string): void {
    const sessionKey = this.sessionKeys.get(sessionKeyId);
    if (sessionKey) {
      sessionKey.isActive = false;
    }
  }

  /**
   * List all session keys for a parent address
   *
   * @param parentAddress - Parent wallet address
   * @returns Array of session keys
   */
  listSessionKeys(parentAddress: string): SessionKey[] {
    return Array.from(this.sessionKeys.values()).filter(
      (sk) => sk.parentAddress.toLowerCase() === parentAddress.toLowerCase()
    );
  }

  /**
   * List active session keys for a parent address
   *
   * @param parentAddress - Parent wallet address
   * @returns Array of active session keys
   */
  listActiveSessionKeys(parentAddress: string): SessionKey[] {
    return this.listSessionKeys(parentAddress).filter(
      (sk) => sk.isActive && new Date() <= sk.expiresAt
    );
  }

  /**
   * Validate transaction against session key permissions
   *
   * @param sessionKey - Session key
   * @param request - Transaction request
   * @throws SessionKeyError if validation fails
   */
  private validateTransaction(
    sessionKey: SessionKey,
    request: SignTransactionRequest
  ): void {
    // Check if session key is active
    if (!sessionKey.isActive) {
      throw new SessionKeyError('Session key is not active', {
        sessionKeyId: sessionKey.id,
      });
    }

    // Check if session key is expired
    if (new Date() > sessionKey.expiresAt) {
      throw new SessionKeyError('Session key has expired', {
        sessionKeyId: sessionKey.id,
        expiresAt: sessionKey.expiresAt,
      });
    }

    // Check chain
    if (request.chain !== sessionKey.chain) {
      throw new SessionKeyError('Chain mismatch', {
        sessionKeyId: sessionKey.id,
        allowedChain: sessionKey.chain,
        requestedChain: request.chain,
      });
    }

    const { permissions } = sessionKey;

    // Check value limit
    if (
      permissions.maxValue &&
      request.value &&
      request.value > permissions.maxValue
    ) {
      throw new SessionKeyError('Transaction value exceeds maximum', {
        sessionKeyId: sessionKey.id,
        maxValue: permissions.maxValue.toString(),
        requestedValue: request.value.toString(),
      });
    }

    // Check contract whitelist
    if (permissions.contracts && permissions.contracts.length > 0) {
      const isWhitelisted = permissions.contracts.some(
        (addr) => addr.toLowerCase() === request.to.toLowerCase()
      );
      if (!isWhitelisted) {
        throw new SessionKeyError('Contract not whitelisted', {
          sessionKeyId: sessionKey.id,
          whitelistedContracts: permissions.contracts,
          requestedContract: request.to,
        });
      }
    }

    // Check operation whitelist (if data is provided)
    if (
      permissions.operations &&
      permissions.operations.length > 0 &&
      request.data
    ) {
      // Extract function selector (first 4 bytes / 8 hex chars + 0x)
      const selector = request.data.slice(0, 10);
      const isAllowed = permissions.operations.some(
        (op) => op.toLowerCase() === selector.toLowerCase()
      );
      if (!isAllowed) {
        throw new SessionKeyError('Operation not allowed', {
          sessionKeyId: sessionKey.id,
          allowedOperations: permissions.operations,
          requestedOperation: selector,
        });
      }
    }
  }

  /**
   * Sign transaction with session key
   *
   * @param sessionKeyId - Session key identifier
   * @param request - Transaction request
   * @returns Signed transaction
   * @throws SessionKeyError if session key is invalid or transaction violates permissions
   */
  async signWithSessionKey(
    sessionKeyId: string,
    request: SignTransactionRequest
  ): Promise<SignedTransaction> {
    const sessionKey = this.sessionKeys.get(sessionKeyId);
    if (!sessionKey) {
      throw new SessionKeyError('Session key not found', { sessionKeyId });
    }

    // Validate transaction against permissions
    this.validateTransaction(sessionKey, request);

    // Create account from session key
    const account = privateKeyToAccount(sessionKey.privateKey as `0x${string}`);

    // Sign transaction
    // Note: This is a simplified implementation
    // In production, you'd use the appropriate signing method for the chain
    const serialized = JSON.stringify({
      from: account.address,
      to: request.to,
      value: request.value?.toString(),
      data: request.data,
      gasLimit: request.gasLimit?.toString(),
      gasPrice: request.gasPrice?.toString(),
      nonce: request.nonce,
      chain: request.chain,
    });

    // In a real implementation, this would use the chain's signing method
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
   * Clean up expired session keys
   *
   * @returns Number of removed session keys
   */
  cleanupExpired(): number {
    const now = new Date();
    let removed = 0;

    for (const [id, sessionKey] of this.sessionKeys.entries()) {
      if (now > sessionKey.expiresAt) {
        this.sessionKeys.delete(id);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get session key statistics
   *
   * @returns Statistics about session keys
   */
  getStats() {
    const all = Array.from(this.sessionKeys.values());
    const active = all.filter(
      (sk) => sk.isActive && new Date() <= sk.expiresAt
    );
    const expired = all.filter((sk) => new Date() > sk.expiresAt);

    return {
      total: all.length,
      active: active.length,
      expired: expired.length,
      inactive: all.length - active.length - expired.length,
    };
  }
}
