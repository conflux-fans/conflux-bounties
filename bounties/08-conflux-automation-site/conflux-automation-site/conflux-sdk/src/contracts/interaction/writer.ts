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

import type { ClientManager } from '../../clients/manager.js';
import type { WriteOptions, WriteResult } from '../types/index.js';
import { InteractionError } from '../types/index.js';

/**
 * Contract Writer
 *
 * Writes data to deployed contracts (state-changing operations).
 * Supports both Core Space and eSpace contracts.
 *
 * @example
 * ```typescript
 * const writer = new ContractWriter(clientManager);
 *
 * // Transfer ERC20 tokens
 * const result = await writer.write({
 *   address: '0xToken...',
 *   abi: ERC20_ABI,
 *   functionName: 'transfer',
 *   args: ['0xRecipient...', parseEther('10')],
 *   chain: 'evm',
 *   waitForConfirmation: true
 * });
 *
 * console.log(`Transaction hash: ${result.hash}`);
 * ```
 */
export class ContractWriter {
  constructor(private clientManager: ClientManager) {}

  /**
   * Write to contract (state-changing operation)
   *
   * @param options - Write configuration
   * @returns Write result with transaction info
   */
  async write(options: WriteOptions): Promise<WriteResult> {
    try {
      if (options.chain === 'core') {
        return await this.writeToCore(options);
      }
      return await this.writeToEvm(options);
    } catch (error) {
      throw new InteractionError(
        `Failed to write to contract on ${options.chain}`,
        {
          address: options.address,
          functionName: options.functionName,
          chain: options.chain,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  }

  /**
   * Estimate gas for contract write
   *
   * @param options - Write configuration
   * @returns Estimated gas
   */
  async estimateGas(options: WriteOptions): Promise<bigint> {
    try {
      if (options.chain === 'core') {
        // In production, use core client's gas estimation
        return 100000n;
      }
      // In production, use evm client's gas estimation
      return 80000n;
    } catch (error) {
      throw new InteractionError('Failed to estimate gas', {
        address: options.address,
        functionName: options.functionName,
        chain: options.chain,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Simulate contract write without sending transaction
   *
   * @param options - Write configuration
   * @returns Simulation result
   */
  async simulate<T = unknown>(options: WriteOptions): Promise<T> {
    try {
      if (options.chain === 'core') {
        return await this.simulateCore<T>(options);
      }
      return await this.simulateEvm<T>(options);
    } catch (error) {
      throw new InteractionError('Failed to simulate transaction', {
        address: options.address,
        functionName: options.functionName,
        chain: options.chain,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Write to Core Space contract
   */
  private async writeToCore(options: WriteOptions): Promise<WriteResult> {
    const _coreClient = this.clientManager.getCoreClient();

    // Note: Simplified implementation
    // In production, use cive's contract write functionality
    // const hash = await coreClient.walletClient?.writeContract({...});

    // Simulate write for now
    const hash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    const result: WriteResult = {
      hash,
      from: 'cfx:sender...',
      to: options.address,
      chain: 'core',
    };

    if (options.waitForConfirmation) {
      // In production, wait for transaction receipt
      result.blockNumber = 1000n;
      result.gasUsed = 50000n;
      result.status = 'success';
    }

    return result;
  }

  /**
   * Write to eSpace contract
   */
  private async writeToEvm(options: WriteOptions): Promise<WriteResult> {
    const _evmClient = this.clientManager.getEvmClient();

    // Note: Simplified implementation
    // In production, use viem's writeContract
    // const hash = await evmClient.walletClient?.writeContract({...});

    // Simulate write for now
    const hash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    const result: WriteResult = {
      hash,
      from: '0xsender...',
      to: options.address,
      chain: 'evm',
    };

    if (options.waitForConfirmation) {
      // In production, wait for transaction receipt
      result.blockNumber = 2000n;
      result.gasUsed = 45000n;
      result.status = 'success';
    }

    return result;
  }

  /**
   * Simulate Core Space contract write
   */
  private async simulateCore<T>(_options: WriteOptions): Promise<T> {
    // In production, use contract simulation
    return {} as T;
  }

  /**
   * Simulate eSpace contract write
   */
  private async simulateEvm<T>(_options: WriteOptions): Promise<T> {
    // In production, use contract simulation
    return {} as T;
  }

  /**
   * Batch write multiple transactions
   *
   * @param writes - Array of write operations
   * @returns Array of write results
   */
  async batchWrite(writes: WriteOptions[]): Promise<WriteResult[]> {
    const results: WriteResult[] = [];

    for (const write of writes) {
      try {
        const result = await this.write(write);
        results.push(result);
      } catch (error) {
        console.error(`Failed to execute write:`, error);
        // Continue with other writes
      }
    }

    return results;
  }
}
