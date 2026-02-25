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
import type { ContractInfo, ReadOptions } from '../types/index.js';
import { InteractionError } from '../types/index.js';

/**
 * Contract Reader
 *
 * Reads data from deployed contracts without modifying state.
 * Supports both Core Space and eSpace contracts.
 *
 * @example
 * ```typescript
 * const reader = new ContractReader(clientManager);
 *
 * // Read ERC20 balance
 * const balance = await reader.read({
 *   address: '0xToken...',
 *   abi: ERC20_ABI,
 *   functionName: 'balanceOf',
 *   args: ['0xUser...'],
 *   chain: 'evm'
 * });
 * ```
 */
export class ContractReader {
  constructor(private clientManager: ClientManager) {}

  /**
   * Read data from contract
   *
   * @param options - Read configuration
   * @returns Function return value
   */
  async read<T = unknown>(options: ReadOptions): Promise<T> {
    try {
      if (options.chain === 'core') {
        return await this.readFromCore<T>(options);
      }
      return await this.readFromEvm<T>(options);
    } catch (error) {
      throw new InteractionError(
        `Failed to read from contract on ${options.chain}`,
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
   * Batch read multiple values from same contract
   *
   * @param address - Contract address
   * @param abi - Contract ABI
   * @param calls - Array of function calls
   * @param chain - Chain type
   * @returns Array of results
   */
  async batchRead<T = unknown>(
    address: string,
    abi: unknown[],
    calls: Array<{ functionName: string; args?: unknown[] }>,
    chain: 'core' | 'evm'
  ): Promise<T[]> {
    const results: T[] = [];

    for (const call of calls) {
      const result = await this.read<T>({
        address,
        abi,
        functionName: call.functionName,
        args: call.args,
        chain,
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Get contract information
   *
   * @param address - Contract address
   * @param chain - Chain type
   * @returns Contract info
   */
  async getContractInfo(
    address: string,
    chain: 'core' | 'evm'
  ): Promise<ContractInfo> {
    // In production, fetch actual contract bytecode and metadata
    return {
      address,
      bytecode: '0x...',
      chain,
      isVerified: false,
    };
  }

  /**
   * Check if address is a contract
   *
   * @param address - Address to check
   * @param chain - Chain type
   * @returns true if contract exists
   */
  async isContract(_address: string, _chain: 'core' | 'evm'): Promise<boolean> {
    try {
      // In production, check if address has code
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read from Core Space contract
   */
  private async readFromCore<T>(_options: ReadOptions): Promise<T> {
    const _coreClient = this.clientManager.getCoreClient();

    // Note: Simplified implementation
    // In production, use cive's contract read functionality
    // const result = await coreClient.publicClient.readContract({...});

    // Simulate read for now
    return {} as T;
  }

  /**
   * Read from eSpace contract
   */
  private async readFromEvm<T>(_options: ReadOptions): Promise<T> {
    const _evmClient = this.clientManager.getEvmClient();

    // Note: Simplified implementation
    // In production, use viem's readContract
    // const result = await evmClient.publicClient.readContract({...});

    // Simulate read for now
    return {} as T;
  }
}
