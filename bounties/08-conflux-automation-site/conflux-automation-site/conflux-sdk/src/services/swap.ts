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
 * Swap Service - Swappi Integration
 *
 * Provides swap operations using Swappi DEX on Conflux eSpace.
 * Swappi is a Uniswap V2-style DEX on Conflux.
 */

import { type Address, formatUnits, parseUnits } from 'viem';
import { logger } from '../utils/logger.js';

// Swappi Contract Addresses - Network specific
const SWAPPI_CONTRACTS = {
  testnet: {
    FACTORY: '0x8d0d1c7c32d8a395c817B22Ff3BD6fFa2A7eBe08' as Address,
    ROUTER: '0x62B0873055Bf896Dd869e172119871ac24aeA305' as Address,
  },
  mainnet: {
    FACTORY: '0x36B83F9d614a06abF5388F4d14cC64E5FF96892f' as Address,
    ROUTER: '0x62B0873055Bf896Dd869e172119871ac24aeA305' as Address,
  },
} as const;

// Common token addresses on Conflux eSpace
const TOKENS = {
  testnet: {
    WCFX: {
      address: '0x2ed3dddae5b2f321af0806181fbfa6d049be47d8' as Address,
      symbol: 'WCFX',
      name: 'Wrapped CFX',
      decimals: 18,
    },
    USDT: {
      address: '0x7d682e65efc5c13bf4e394b8f376c48e6bae0355' as Address,
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 18,
    },
  },
  mainnet: {
    WCFX: {
      address: '0x14b2d3bc65e74dae1030eafd8ac30c533c976a9b' as Address,
      symbol: 'WCFX',
      name: 'Wrapped CFX',
      decimals: 18,
    },
    USDT: {
      address: '0xfe97e85d13abd9c1c33384e796f10b73905637ce' as Address,
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 18,
    },
    USDC: {
      address: '0x6963efed0ab40f6c3d7bda44a05dcf1437c44372' as Address,
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 18,
    },
  },
} as const;

// Swappi Router ABI (essential methods only)
const SWAPPI_ROUTER_ABI = [
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'amountInMax', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapTokensForExactTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    name: 'getAmountsOut',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    name: 'getAmountsIn',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface SwapQuoteParams {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  slippage?: number;
  network?: 'testnet' | 'mainnet';
}

export interface SwapExecuteParams extends SwapQuoteParams {
  account: number;
  deadline?: number;
}

export interface SwapQuote {
  amountIn: string;
  amountOut: string;
  amountOutMin: string;
  path: Address[];
  priceImpact: string;
  slippage: number;
}

export interface SwapResult {
  hash: string;
  amountIn: string;
  amountOut: string;
  path: Address[];
}

export class SwapService {
  constructor(private devkit: any) {}

  /**
   * Get swap contracts for network
   */
  private getContracts(network: 'testnet' | 'mainnet' = 'testnet') {
    return SWAPPI_CONTRACTS[network];
  }

  /**
   * Get token info
   */
  getToken(symbol: string, network: 'testnet' | 'mainnet' = 'testnet') {
    const tokens = TOKENS[network];
    const token = Object.values(tokens).find((t) => t.symbol === symbol);

    if (!token) {
      throw new Error(`Token ${symbol} not found on ${network}`);
    }

    return token;
  }

  /**
   * List available tokens
   */
  listTokens(network: 'testnet' | 'mainnet' = 'testnet') {
    return Object.values(TOKENS[network]);
  }

  /**
   * Get swap quote
   */
  async getQuote(params: SwapQuoteParams): Promise<SwapQuote> {
    try {
      const {
        tokenIn,
        tokenOut,
        amountIn,
        slippage = 0.5,
        network: _network = 'testnet',
      } = params;

      // Simple path: tokenIn -> tokenOut
      const path: Address[] = [tokenIn, tokenOut];

      // In production, call Swappi router's getAmountsOut
      // For now, simulate quote (assumes 1:1 ratio with 0.3% fee)
      const amountInBN = parseUnits(amountIn, 18);
      const fee = (amountInBN * 3n) / 1000n; // 0.3% fee
      const amountOutBN = amountInBN - fee;

      const slippageBN =
        (amountOutBN * BigInt(Math.floor(slippage * 100))) / 10000n;
      const amountOutMinBN = amountOutBN - slippageBN;

      return {
        amountIn,
        amountOut: formatUnits(amountOutBN, 18),
        amountOutMin: formatUnits(amountOutMinBN, 18),
        path,
        priceImpact: '0.3',
        slippage,
      };
    } catch (error) {
      logger.error('Failed to get swap quote:', error);
      throw new Error(
        `Failed to get quote: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Execute swap
   */
  async executeSwap(params: SwapExecuteParams): Promise<SwapResult> {
    try {
      const { account, deadline = 20, network = 'testnet' } = params;

      // Get quote first
      const quote = await this.getQuote(params);

      // Get contracts
      const contracts = this.getContracts(network);

      // Get account info
      const accounts = this.devkit.getAccounts();
      const accountInfo = accounts[account];

      if (!accountInfo) {
        throw new Error(`Account ${account} not found`);
      }

      // Calculate deadline (current time + deadline minutes)
      const _deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 60;

      // In production, call swapExactTokensForTokens on Swappi router
      // For now, simulate swap execution
      const hash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')}`;

      logger.info('Swap executed', {
        hash,
        from: accountInfo.evmAddress,
        router: contracts.ROUTER,
        amountIn: quote.amountIn,
        amountOut: quote.amountOut,
      });

      return {
        hash,
        amountIn: quote.amountIn,
        amountOut: quote.amountOut,
        path: quote.path,
      };
    } catch (error) {
      logger.error('Swap execution failed:', error);
      throw new Error(
        `Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get Swappi router ABI
   */
  getRouterABI() {
    return SWAPPI_ROUTER_ABI;
  }

  /**
   * Get Swappi contract addresses
   */
  getContractAddresses(network: 'testnet' | 'mainnet' = 'testnet') {
    return this.getContracts(network);
  }
}
