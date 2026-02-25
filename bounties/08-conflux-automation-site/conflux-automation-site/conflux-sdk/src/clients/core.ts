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

// Core Space Client Implementation
// Based on proven patterns from DevKit CLI, adapted for unified interface

import {
  type Address,
  type Chain,
  type TestClient as CiveTestClient,
  createPublicClient,
  createTestClient,
  createWalletClient,
  formatCFX,
  http,
  type PublicClient,
  parseCFX,
  type WalletClient,
} from 'cive';
import { type Account, privateKeyToAccount } from 'cive/accounts';
import {
  defineChain,
  encodeFunctionData,
  formatUnits,
  hexAddressToBase32,
  isAddress as isCoreAddress,
} from 'cive/utils';
import { isAddress as isEspaceAddress } from 'viem';

// Chain definitions
const conflux = defineChain({
  id: 1029,
  name: 'Conflux Core',
  nativeCurrency: { name: 'Conflux', symbol: 'CFX', decimals: 18 },
  rpcUrls: { default: { http: ['https://main.confluxrpc.com'] } },
});

const confluxTestnet = defineChain({
  id: 1,
  name: 'Conflux Core Testnet',
  nativeCurrency: { name: 'Conflux', symbol: 'CFX', decimals: 18 },
  rpcUrls: { default: { http: ['https://test.confluxrpc.com'] } },
});

import { getChainConfig, type SupportedChainId } from '../config/chains.js';
import type {
  BaseTransaction,
  BlockEvent,
  ChainClient,
  ClientConfig,
  CoreClientInstance,
  EventCallback,
  TestClient,
  TestConfig,
  TransactionEvent,
  TransactionReceipt,
  WalletClient as UnifiedWalletClient,
  UnwatchFunction,
  WalletConfig,
} from '../types/index.js';
import { NodeError } from '../types/index.js';

/**
 * Core Space Client Implementation
 * Wraps cive client with unified interface
 */
export class CoreClient implements ChainClient {
  public readonly chainType = 'core' as const;
  public readonly chainId: number;
  public readonly address: Address;

  private readonly publicClient: PublicClient;
  private readonly chain: Chain;

  constructor(config: ClientConfig) {
    this.chainId = config.chainId;

    // Create chain definition
    this.chain = defineChain({
      id: this.chainId,
      name: `ConfluxCore-${this.chainId}`,
      nativeCurrency: {
        decimals: 18,
        name: 'Conflux',
        symbol: 'CFX',
      },
      rpcUrls: {
        default: {
          http: [config.rpcUrl],
          webSocket: config.wsUrl ? [config.wsUrl] : undefined,
        },
      },
    });

    // Create public client
    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(config.rpcUrl),
      pollingInterval: config.pollingInterval || 1000,
    });

    // Address will be set by wallet client
    this.address = '' as Address;
  }

  async getBlockNumber(): Promise<bigint> {
    try {
      const epochNumber = await this.publicClient.getEpochNumber();
      return BigInt(epochNumber.toString());
    } catch (error) {
      throw new NodeError(
        `Failed to get block number: ${error instanceof Error ? error.message : String(error)}`,
        'BLOCK_NUMBER_ERROR',
        'core',
        { originalError: error }
      );
    }
  }

  async getBalance(address: Address): Promise<string> {
    if (!isCoreAddress(address)) {
      throw new NodeError(
        'Invalid Core address format',
        'INVALID_ADDRESS',
        'core'
      );
    }

    try {
      const balance = await this.publicClient.getBalance({ address });
      return formatCFX(balance);
    } catch (error) {
      throw new NodeError(
        `Failed to get balance: ${error instanceof Error ? error.message : String(error)}`,
        'BALANCE_ERROR',
        'core',
        { address, originalError: error }
      );
    }
  }

  async getGasPrice(): Promise<bigint> {
    try {
      const gasPrice = await this.publicClient.getGasPrice();
      return gasPrice;
    } catch (error) {
      throw new NodeError(
        `Failed to get gas price: ${error instanceof Error ? error.message : String(error)}`,
        'GAS_PRICE_ERROR',
        'core',
        { originalError: error }
      );
    }
  }

  async estimateGas(tx: BaseTransaction): Promise<bigint> {
    try {
      const estimate = await this.publicClient.request({
        method: 'cfx_estimateGasAndCollateral',
        params: [
          {
            to: tx.to as Address,
            value: tx.value ? `0x${tx.value.toString(16)}` : undefined,
            data: tx.data as `0x${string}`,
          },
        ],
      });
      return BigInt(estimate.gasLimit);
    } catch (error) {
      throw new NodeError(
        `Failed to estimate gas: ${error instanceof Error ? error.message : String(error)}`,
        'GAS_ESTIMATE_ERROR',
        'core',
        { transaction: tx, originalError: error }
      );
    }
  }

  async sendTransaction(_tx: BaseTransaction): Promise<string> {
    throw new NodeError(
      'Cannot send transaction from public client. Use wallet client instead.',
      'WALLET_REQUIRED',
      'core'
    );
  }

  async waitForTransaction(hash: string): Promise<TransactionReceipt> {
    try {
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: hash as `0x${string}`,
      });

      return {
        hash: receipt.transactionHash,
        blockNumber: BigInt(receipt.epochNumber?.toString() || '0'),
        blockHash: receipt.blockHash || '',
        transactionIndex: Number(receipt.index || 0),
        status: receipt.outcomeStatus === 'success' ? 'success' : 'reverted',
        gasUsed: receipt.gasUsed || 0n,
        contractAddress: receipt.contractCreated || undefined,
        logs:
          receipt.log?.map((log: Record<string, unknown>) => ({
            address: (log.address as string) || '',
            topics: (log.topics as string[]) || [],
            data: (log.data as string) || '0x',
            blockNumber: BigInt((log.epochNumber as number)?.toString() || '0'),
            transactionHash: (log.transactionHash as string) || '',
            logIndex: Number(log.logIndex || 0),
          })) || [],
      };
    } catch (error) {
      throw new NodeError(
        `Failed to wait for transaction: ${error instanceof Error ? error.message : String(error)}`,
        'TRANSACTION_WAIT_ERROR',
        'core',
        { hash, originalError: error }
      );
    }
  }

  async getTokenBalance(
    tokenAddress: Address,
    holderAddress?: Address
  ): Promise<string> {
    const holder = holderAddress || this.address;

    if (!this.isValidAddress(tokenAddress)) {
      throw new NodeError(
        'Invalid token address format',
        'INVALID_ADDRESS',
        'core',
        { tokenAddress }
      );
    }
    if (!this.isValidAddress(holder)) {
      throw new NodeError(
        'Invalid holder address format',
        'INVALID_ADDRESS',
        'core',
        { holder }
      );
    }

    try {
      const [balance, decimals] = await Promise.all([
        this.publicClient.readContract({
          address: tokenAddress,
          abi: [
            {
              name: 'balanceOf',
              type: 'function',
              inputs: [{ name: 'account', type: 'address' }],
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view',
            },
          ],
          functionName: 'balanceOf',
          args: [holder],
        }),
        this.publicClient.readContract({
          address: tokenAddress,
          abi: [
            {
              name: 'decimals',
              type: 'function',
              inputs: [],
              outputs: [{ name: '', type: 'uint8' }],
              stateMutability: 'view',
            },
          ],
          functionName: 'decimals',
        }),
      ]);

      return this.formatTokenAmount(balance as bigint, Number(decimals));
    } catch (error) {
      throw new NodeError(
        `Failed to get token balance: ${error instanceof Error ? error.message : String(error)}`,
        'TOKEN_BALANCE_ERROR',
        'core',
        { tokenAddress, holder, originalError: error }
      );
    }
  }

  watchBlocks(callback: EventCallback<BlockEvent>): UnwatchFunction {
    return this.publicClient.watchEpochNumber({
      emitMissed: false,
      epochTag: 'latest_mined',
      onEpochNumber: async (epochNumber: bigint) => {
        try {
          const blockHashes = await this.publicClient.getBlocksByEpoch({
            epochNumber,
          });
          for (const hash of blockHashes) {
            try {
              const block = await this.publicClient.getBlock({
                blockHash: hash as `0x${string}`,
              });

              const blockEvent: BlockEvent = {
                chainType: 'core',
                blockNumber: BigInt(block.epochNumber?.toString() || '0'),
                blockHash: block.hash || '',
                timestamp: Number(block.timestamp || 0),
                transactionCount: block.transactions?.length || 0,
              };

              callback(blockEvent);
            } catch (error) {
              console.error(`Failed to process block ${hash}:`, error);
            }
          }
        } catch (error) {
          console.error(
            `Failed to get blocks for epoch ${epochNumber}:`,
            error
          );
        }
      },
    });
  }

  watchTransactions(
    callback: EventCallback<TransactionEvent>
  ): UnwatchFunction {
    return this.publicClient.watchEpochNumber({
      emitMissed: false,
      epochTag: 'latest_mined',
      onEpochNumber: async (epochNumber: bigint) => {
        try {
          const blockHashes = await this.publicClient.getBlocksByEpoch({
            epochNumber,
          });
          for (const hash of blockHashes) {
            try {
              const block = await this.publicClient.getBlock({
                blockHash: hash as `0x${string}`,
              });

              await Promise.all(
                (block.transactions || []).map(
                  async (txHash: `0x${string}`) => {
                    try {
                      const tx = await this.publicClient.getTransaction({
                        hash: txHash,
                      });

                      const txEvent: TransactionEvent = {
                        chainType: 'core',
                        hash: tx.hash,
                        from: tx.from,
                        to: tx.to || undefined,
                        value: tx.value || 0n,
                        blockNumber: BigInt(
                          block.epochNumber?.toString() || '0'
                        ),
                      };

                      callback(txEvent);
                    } catch (error) {
                      console.error(
                        `Failed to get transaction ${txHash}:`,
                        error
                      );
                    }
                  }
                )
              );
            } catch (error) {
              console.error(`Failed to process block ${hash}:`, error);
            }
          }
        } catch (error) {
          console.error(
            `Failed to get blocks for epoch ${epochNumber}:`,
            error
          );
        }
      },
    });
  }

  isValidAddress(address: string): boolean {
    return isCoreAddress(address);
  }

  formatAmount(amount: bigint): string {
    return formatCFX(amount);
  }

  parseAmount(amount: string): bigint {
    return parseCFX(amount);
  }

  getInternalClient(): PublicClient {
    return this.publicClient;
  }

  private formatTokenAmount(amount: bigint, decimals: number): string {
    const formatted = formatUnits(amount, decimals);
    return Number(formatted).toFixed(4);
  }
}

/**
 * Core Space Wallet Client Implementation
 */
export class CoreWalletClient implements UnifiedWalletClient {
  public readonly chainType = 'core' as const;
  public readonly address: Address;
  public readonly chainId: number;

  private readonly walletClient: WalletClient;
  private readonly publicClient: PublicClient;
  private readonly account: Account;
  private readonly chain: Chain;

  constructor(config: WalletConfig) {
    this.chainId = config.chainId;

    // Create chain definition
    this.chain = defineChain({
      id: config.chainId,
      name: `ConfluxCore-${config.chainId}`,
      nativeCurrency: {
        decimals: 18,
        name: 'Conflux',
        symbol: 'CFX',
      },
      rpcUrls: {
        default: {
          http: [config.rpcUrl],
          webSocket: config.wsUrl ? [config.wsUrl] : undefined,
        },
      },
    });

    // Create account from private key
    this.account = privateKeyToAccount(config.privateKey as `0x${string}`, {
      networkId: config.chainId,
    });
    this.address = this.account.address;

    // Create wallet client
    this.walletClient = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(config.rpcUrl),
      pollingInterval: config.pollingInterval || 1000,
    });

    // Create public client for transaction receipts
    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(config.rpcUrl),
      pollingInterval: config.pollingInterval || 1000,
    });
  }

  async sendTransaction(tx: BaseTransaction): Promise<string> {
    try {
      return await this.walletClient.sendTransaction({
        to: tx.to as Address,
        value: tx.value,
        data: tx.data as `0x${string}`,
        gas: tx.gasLimit,
        gasPrice: tx.gasPrice,
        nonce: tx.nonce,
        account: this.account,
        chain: this.chain,
      });
    } catch (error) {
      throw new NodeError(
        `Failed to send transaction: ${error instanceof Error ? error.message : String(error)}`,
        'TRANSACTION_SEND_ERROR',
        'core',
        { transaction: tx, originalError: error }
      );
    }
  }

  async signMessage(message: string): Promise<string> {
    try {
      return await this.walletClient.signMessage({
        account: this.account,
        message,
      });
    } catch (error) {
      throw new NodeError(
        `Failed to sign message: ${error instanceof Error ? error.message : String(error)}`,
        'MESSAGE_SIGN_ERROR',
        'core',
        { message, originalError: error }
      );
    }
  }

  getInternalClient(): WalletClient {
    return this.walletClient;
  }

  async waitForTransaction(hash: string): Promise<TransactionReceipt> {
    try {
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: hash as `0x${string}`,
        timeout: 5_000, // 5 second timeout for faster response
      });

      return {
        hash: receipt.transactionHash,
        blockNumber: BigInt(receipt.epochNumber?.toString() || '0'),
        blockHash: receipt.blockHash || '',
        transactionIndex: Number(receipt.index || 0),
        status: receipt.outcomeStatus === 'success' ? 'success' : 'reverted',
        gasUsed: receipt.gasUsed || 0n,
        contractAddress: receipt.contractCreated || undefined,
        logs:
          receipt.log?.map((log: Record<string, unknown>) => ({
            address: (log.address as string) || '',
            topics: (log.topics as string[]) || [],
            data: (log.data as string) || '0x',
            blockNumber: BigInt((log.epochNumber as number)?.toString() || '0'),
            transactionHash: (log.transactionHash as string) || '',
            logIndex: Number(log.logIndex || 0),
          })) || [],
      };
    } catch (error) {
      throw new NodeError(
        `Failed to wait for transaction: ${error instanceof Error ? error.message : String(error)}`,
        'TRANSACTION_WAIT_ERROR',
        'core',
        { hash, originalError: error }
      );
    }
  }

  /**
   * Unified faucet functionality
   * Automatically detects address type and sends CFX accordingly:
   * - Core address: Direct transfer
   * - eSpace address: Cross-chain transfer via internal contract
   */
  async faucet(address: string, amount: string): Promise<string> {
    // Detect address type
    const isCoreAddr = isCoreAddress(address);
    const isEspaceAddr = isEspaceAddress(address);

    if (!isCoreAddr && !isEspaceAddr) {
      throw new NodeError(
        'Invalid address format (must be Core or eSpace address)',
        'INVALID_ADDRESS',
        'core',
        { address }
      );
    }

    try {
      if (isCoreAddr) {
        // Direct Core space transfer
        return await this.walletClient.sendTransaction({
          chain: this.chain,
          account: this.account,
          to: address as Address,
          value: parseCFX(amount),
        });
      } else {
        // Cross-chain transfer to eSpace via internal contract
        return await this.walletClient.sendTransaction({
          chain: this.chain,
          account: this.account,
          to: hexAddressToBase32({
            hexAddress: '0x0888000000000000000000000000000000000006',
            networkId: this.chain.id,
          }),
          value: parseCFX(amount),
          data: encodeFunctionData({
            abi: [
              {
                type: 'function',
                name: 'transferEVM',
                inputs: [{ name: 'to', type: 'bytes20' }],
                outputs: [{ name: 'output', type: 'bytes' }],
                stateMutability: 'payable',
              },
            ],
            functionName: 'transferEVM',
            args: [address as `0x${string}`],
          }),
        });
      }
    } catch (error) {
      throw new NodeError(
        `Failed to send faucet transaction: ${error instanceof Error ? error.message : String(error)}`,
        'FAUCET_ERROR',
        'core',
        { address, amount, originalError: error }
      );
    }
  }

  /**
   * Cross-chain faucet functionality (Core → eSpace)
   * Sends CFX from Core space to eSpace address via internal contract
   * @deprecated Use faucet() instead which auto-detects address type
   */
  async faucetToEspace(espaceAddress: string, amount: string): Promise<string> {
    if (!isEspaceAddress(espaceAddress)) {
      throw new NodeError(
        'Invalid eSpace address format',
        'INVALID_ADDRESS',
        'core',
        { espaceAddress }
      );
    }

    try {
      return await this.walletClient.sendTransaction({
        chain: this.chain,
        account: this.account,
        to: hexAddressToBase32({
          hexAddress: '0x0888000000000000000000000000000000000006',
          networkId: this.chain.id,
        }),
        value: parseCFX(amount),
        data: encodeFunctionData({
          abi: [
            {
              type: 'function',
              name: 'transferEVM',
              inputs: [{ name: 'to', type: 'bytes20' }],
              outputs: [{ name: 'output', type: 'bytes' }],
              stateMutability: 'payable',
            },
          ],
          functionName: 'transferEVM',
          args: [espaceAddress as `0x${string}`],
        }),
      });
    } catch (error) {
      throw new NodeError(
        `Failed to send faucet transaction to eSpace: ${error instanceof Error ? error.message : String(error)}`,
        'FAUCET_ERROR',
        'core',
        { espaceAddress, amount, originalError: error }
      );
    }
  }

  /**
   * Deploy a contract to Core Space
   */
  async deployContract(
    abi: unknown[],
    bytecode: string,
    constructorArgs: unknown[] = []
  ): Promise<string> {
    try {
      const hash = await this.walletClient.deployContract({
        account: this.account,
        chain: this.chain,
        abi,
        bytecode: bytecode as `0x${string}`,
        args: constructorArgs,
      });

      // Wait for transaction to be mined and get the contract address
      const receipt = await this.waitForTransaction(hash);

      if (!receipt.contractAddress) {
        throw new Error('Contract address not found in transaction receipt');
      }

      // The contract address is already in Core Space format from Cive
      // No need to convert since cive returns Core Space addresses directly
      return receipt.contractAddress;
    } catch (error) {
      throw new NodeError(
        `Failed to deploy contract: ${error instanceof Error ? error.message : String(error)}`,
        'DEPLOYMENT_ERROR',
        'core',
        { abi, bytecode, constructorArgs, originalError: error }
      );
    }
  }

  /**
   * Call a contract method (read-only)
   */
  async callContract<T = unknown>(
    address: string,
    abi: unknown[],
    functionName: string,
    args: unknown[] = []
  ): Promise<T> {
    try {
      // Use the public client for read operations instead of wallet client
      const result = await this.publicClient.readContract({
        address: address as Address,
        abi,
        functionName,
        args,
      });
      return result as T;
    } catch (error) {
      throw new NodeError(
        `Failed to call contract: ${error instanceof Error ? error.message : String(error)}`,
        'CONTRACT_CALL_ERROR',
        'core',
        { address, functionName, args, originalError: error }
      );
    }
  }

  /**
   * Write to a contract (transaction)
   */
  async writeContract(
    address: string,
    abi: unknown[],
    functionName: string,
    args: unknown[] = [],
    value?: bigint
  ): Promise<string> {
    try {
      const hash = await this.walletClient.writeContract({
        account: this.account,
        chain: this.chain,
        address: address as Address,
        abi,
        functionName,
        args,
        value,
      });
      return hash;
    } catch (error) {
      throw new NodeError(
        `Failed to write to contract: ${error instanceof Error ? error.message : String(error)}`,
        'CONTRACT_WRITE_ERROR',
        'core',
        { address, functionName, args, value, originalError: error }
      );
    }
  }
}

/**
 * Core Space Test Client Implementation
 */
export class CoreTestClient extends CoreClient implements TestClient {
  private readonly testClient: CiveTestClient;

  constructor(config: TestConfig) {
    super(config);

    this.testClient = createTestClient({
      chain: this.chainId === 1029 ? conflux : confluxTestnet,
      transport: http(config.rpcUrl),
      pollingInterval: config.pollingInterval || 1000,
    });
  }

  async mine(blocks = 1): Promise<void> {
    try {
      await this.testClient.mine({ blocks });
    } catch (error) {
      throw new NodeError(
        `Failed to mine blocks: ${error instanceof Error ? error.message : String(error)}`,
        'MINE_ERROR',
        'core',
        { blocks, originalError: error }
      );
    }
  }

  async setNextBlockTimestamp(_timestamp: number): Promise<void> {
    // Implementation would depend on available test client methods
    throw new NodeError(
      'setNextBlockTimestamp not implemented for Core client',
      'NOT_IMPLEMENTED',
      'core'
    );
  }

  async increaseTime(_seconds: number): Promise<void> {
    // Implementation would depend on available test client methods
    throw new NodeError(
      'increaseTime not implemented for Core client',
      'NOT_IMPLEMENTED',
      'core'
    );
  }

  async impersonateAccount(_address: Address): Promise<void> {
    throw new NodeError(
      'impersonateAccount not implemented for Core client',
      'NOT_IMPLEMENTED',
      'core'
    );
  }

  async stopImpersonatingAccount(_address: Address): Promise<void> {
    throw new NodeError(
      'stopImpersonatingAccount not implemented for Core client',
      'NOT_IMPLEMENTED',
      'core'
    );
  }

  async setBalance(_address: Address, _balance: bigint): Promise<void> {
    throw new NodeError(
      'setBalance not implemented for Core client',
      'NOT_IMPLEMENTED',
      'core'
    );
  }

  async getStorageAt(_address: Address, _slot: string): Promise<string> {
    throw new NodeError(
      'getStorageAt not implemented for Core client',
      'NOT_IMPLEMENTED',
      'core'
    );
  }

  async setStorageAt(
    _address: Address,
    _slot: string,
    _value: string
  ): Promise<void> {
    throw new NodeError(
      'setStorageAt not implemented for Core client',
      'NOT_IMPLEMENTED',
      'core'
    );
  }

  getInternalTestClient(): CiveTestClient {
    return this.testClient;
  }
}

/**
 * Create a Core client instance with all components
 */
export async function createCoreClient(
  config: ClientConfig
): Promise<CoreClientInstance> {
  const chainConfig = getChainConfig(config.chainId as SupportedChainId);

  if (chainConfig.type !== 'core') {
    throw new NodeError(
      `Invalid chain type for Core client: ${chainConfig.type}`,
      'INVALID_CHAIN_TYPE',
      'core'
    );
  }

  // Update config with proper RPC URL if not provided
  const clientConfig: ClientConfig = {
    ...config,
    rpcUrl:
      config.rpcUrl ||
      chainConfig.rpcUrls.default.http[0] ||
      'http://localhost:12537',
    wsUrl: config.wsUrl || chainConfig.rpcUrls.default.webSocket?.[0],
  };

  const publicClient = new CoreClient(clientConfig);

  let walletClient: CoreWalletClient | undefined;
  let testClient: CoreTestClient | undefined;

  if (config.account) {
    let privateKey: string;
    if (typeof config.account === 'string') {
      privateKey = config.account;
    } else {
      privateKey = config.account.privateKey;
    }

    const walletConfig: WalletConfig = {
      ...clientConfig,
      privateKey,
      accountIndex:
        typeof config.account === 'object' ? config.account.accountIndex : 0,
    };
    walletClient = new CoreWalletClient(walletConfig);
  }

  if (config.testMode) {
    const testConfig: TestConfig = {
      ...clientConfig,
      enableTestMode: true,
    };
    testClient = new CoreTestClient(testConfig);
  }

  return {
    publicClient,
    walletClient,
    testClient,
  };
}
