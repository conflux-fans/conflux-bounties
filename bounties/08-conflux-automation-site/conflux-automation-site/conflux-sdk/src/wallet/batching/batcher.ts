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
import type {
  BatcherOptions,
  BatchResult,
  BatchTransaction,
} from '../types/index.js';
import { BatcherError } from '../types/index.js';

/**
 * Transaction Batcher
 *
 * Batches multiple transactions for efficient execution.
 * Reduces gas costs and network congestion by grouping related operations.
 *
 * Use Cases:
 * - Batch NFT minting
 * - Multi-send operations
 * - Batch token approvals
 * - Gas optimization for high-frequency operations
 *
 * @example
 * ```typescript
 * const batcher = new TransactionBatcher({
 *   maxBatchSize: 10,
 *   autoExecuteTimeout: 5000
 * });
 *
 * // Add transactions to batch
 * batcher.addTransaction({
 *   to: '0xRecipient1...',
 *   value: parseEther('1.0'),
 *   chain: 'evm'
 * });
 *
 * batcher.addTransaction({
 *   to: '0xRecipient2...',
 *   value: parseEther('2.0'),
 *   chain: 'evm'
 * });
 *
 * // Execute batch
 * const result = await batcher.executeBatch('evm', signer);
 * console.log(`Executed ${result.successCount} transactions`);
 * ```
 */
export class TransactionBatcher {
  private coreBatch: BatchTransaction[] = [];
  private evmBatch: BatchTransaction[] = [];
  private autoExecuteTimer: NodeJS.Timeout | null = null;
  private options: Required<BatcherOptions>;

  constructor(options: BatcherOptions = {}) {
    this.options = {
      maxBatchSize: options.maxBatchSize || 10,
      autoExecuteTimeout: options.autoExecuteTimeout || 0, // 0 = disabled
      minGasPrice: options.minGasPrice || 0n,
    };
  }

  /**
   * Add transaction to batch
   *
   * @param tx - Transaction to add
   * @returns Transaction ID
   */
  addTransaction(tx: Omit<BatchTransaction, 'id' | 'addedAt'>): string {
    const transaction: BatchTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      ...tx,
      addedAt: new Date(),
    };

    const batch = tx.chain === 'core' ? this.coreBatch : this.evmBatch;
    batch.push(transaction);

    // Check if we should auto-execute
    if (
      this.options.autoExecuteTimeout > 0 &&
      batch.length === 1 // First transaction in batch
    ) {
      this.startAutoExecuteTimer(tx.chain);
    }

    // Check if batch is full
    if (batch.length >= this.options.maxBatchSize) {
      // Emit event or trigger callback (in production, you'd have proper event handling)
      console.log(
        `Batch for ${tx.chain} is full (${batch.length} transactions)`
      );
    }

    return transaction.id;
  }

  /**
   * Remove transaction from batch
   *
   * @param transactionId - Transaction ID
   * @param chain - Chain type
   * @returns true if removed, false if not found
   */
  removeTransaction(transactionId: string, chain: ChainType): boolean {
    const batch = chain === 'core' ? this.coreBatch : this.evmBatch;
    const index = batch.findIndex((tx) => tx.id === transactionId);

    if (index !== -1) {
      batch.splice(index, 1);
      return true;
    }

    return false;
  }

  /**
   * Get pending transactions for a chain
   *
   * @param chain - Chain type
   * @returns Array of pending transactions
   */
  getPendingTransactions(chain: ChainType): BatchTransaction[] {
    return chain === 'core' ? [...this.coreBatch] : [...this.evmBatch];
  }

  /**
   * Get batch statistics
   *
   * @param chain - Chain type
   * @returns Batch statistics
   */
  getBatchStats(chain: ChainType) {
    const batch = chain === 'core' ? this.coreBatch : this.evmBatch;

    return {
      count: batch.length,
      totalValue: batch.reduce((sum, tx) => sum + (tx.value || 0n), 0n),
      avgGasLimit:
        batch.length > 0
          ? batch.reduce((sum, tx) => sum + (tx.gasLimit || 0n), 0n) /
            BigInt(batch.length)
          : 0n,
      oldestTransaction: batch[0]?.addedAt,
    };
  }

  /**
   * Execute batch of transactions
   *
   * Note: This is a simplified implementation. In production, you would:
   * - Use multicall contracts for actual batching
   * - Handle gas estimation
   * - Implement retry logic
   * - Support different batching strategies (sequential, parallel, etc.)
   *
   * @param chain - Chain to execute on
   * @param signer - Function to sign and send transactions
   * @returns Batch execution result
   */
  async executeBatch(
    chain: ChainType,
    signer?: (tx: BatchTransaction) => Promise<string>
  ): Promise<BatchResult> {
    const batch = chain === 'core' ? this.coreBatch : this.evmBatch;

    if (batch.length === 0) {
      throw new BatcherError('No transactions in batch', { chain });
    }

    this.stopAutoExecuteTimer();

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const transactionHashes: string[] = [];
    let successCount = 0;
    let failureCount = 0;
    let totalGasUsed = 0n;

    // Execute transactions
    // In production, this would use multicall or other batching mechanisms
    for (const tx of batch) {
      try {
        if (signer) {
          const hash = await signer(tx);
          transactionHashes.push(hash);
          successCount++;
          // In production, you'd get actual gas used from receipt
          totalGasUsed += tx.gasLimit || 21000n;
        } else {
          // Simulate execution for testing
          const hash = `0x${Array.from({ length: 64 }, () =>
            Math.floor(Math.random() * 16).toString(16)
          ).join('')}`;
          transactionHashes.push(hash);
          successCount++;
          totalGasUsed += tx.gasLimit || 21000n;
        }
      } catch (error) {
        failureCount++;
        console.error(`Transaction ${tx.id} failed:`, error);
      }
    }

    // Clear batch
    if (chain === 'core') {
      this.coreBatch = [];
    } else {
      this.evmBatch = [];
    }

    return {
      batchId,
      transactionHashes,
      successCount,
      failureCount,
      executedAt: new Date(),
      totalGasUsed,
      chain,
    };
  }

  /**
   * Clear all pending transactions
   *
   * @param chain - Chain to clear, or undefined to clear both
   */
  clearBatch(chain?: ChainType): void {
    if (chain === 'core' || chain === undefined) {
      this.coreBatch = [];
    }
    if (chain === 'evm' || chain === undefined) {
      this.evmBatch = [];
    }

    this.stopAutoExecuteTimer();
  }

  /**
   * Start auto-execute timer
   */
  private startAutoExecuteTimer(chain: ChainType): void {
    if (this.options.autoExecuteTimeout <= 0) return;

    this.stopAutoExecuteTimer();

    this.autoExecuteTimer = setTimeout(() => {
      const batch = chain === 'core' ? this.coreBatch : this.evmBatch;
      if (batch.length > 0) {
        // In production, emit event or trigger callback
        console.log(
          `Auto-executing batch for ${chain} (${batch.length} transactions)`
        );
        // You would call executeBatch here with appropriate signer
      }
    }, this.options.autoExecuteTimeout);
  }

  /**
   * Stop auto-execute timer
   */
  private stopAutoExecuteTimer(): void {
    if (this.autoExecuteTimer) {
      clearTimeout(this.autoExecuteTimer);
      this.autoExecuteTimer = null;
    }
  }

  /**
   * Get batcher configuration
   */
  getOptions(): Required<BatcherOptions> {
    return { ...this.options };
  }

  /**
   * Update batcher configuration
   */
  updateOptions(options: Partial<BatcherOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    };

    // Restart timer if timeout changed
    if (options.autoExecuteTimeout !== undefined) {
      this.stopAutoExecuteTimer();
      if (this.coreBatch.length > 0) {
        this.startAutoExecuteTimer('core');
      }
      if (this.evmBatch.length > 0) {
        this.startAutoExecuteTimer('evm');
      }
    }
  }
}
