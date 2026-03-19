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

// EVM Space Client Implementation (eSpace)
// Based on proven patterns from DevKit CLI, adapted for unified interface

import {
  type Address,
  type Chain,
  createPublicClient,
  createTestClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
  formatEther,
  http,
  isAddress as isEvmAddress,
  type PublicClient,
  parseEther,
  type TestClient as ViemTestClient,
  type WalletClient,
} from 'viem';
import { type Account, privateKeyToAccount } from 'viem/accounts';
import { getChainConfig, type SupportedChainId } from '../config/chains.js';
import type {
  BaseTransaction,
  BlockEvent,
  ChainClient,
  ClientConfig,
  EspaceClientInstance,
  EventCallback,
  TestClient,
  TestConfig,
  TransactionEvent,
  TransactionReceipt,
  WalletClient as UnifiedWalletClient,
  WalletConfig,
} from '../types/index.js';
import { NodeError } from '../types/index.js';

// Define eSpace chains if not available from viem/chains
const espaceMainnet = defineChain({
  id: 1030,
  name: 'Conflux eSpace',
  nativeCurrency: { name: 'Conflux', symbol: 'CFX', decimals: 18 },
  rpcUrls: { default: { http: ['https://evm.confluxrpc.com'] } },
  blockExplorers: {
    default: { name: 'ConfluxScan', url: 'https://evm.confluxscan.net' },
  },
});

const espaceTestnet = defineChain({
  id: 71,
  name: 'Conflux eSpace Testnet',
  nativeCurrency: { name: 'Conflux', symbol: 'CFX', decimals: 18 },
  rpcUrls: { default: { http: ['https://evmtestnet.confluxrpc.com'] } },
  blockExplorers: {
    default: { name: 'ConfluxScan', url: 'https://evmtestnet.confluxscan.net' },
  },
});

/**
 * EVM Space (eSpace) Client Implementation
 * Provides unified interface for Ethereum-compatible operations on Conflux eSpace
 */
export class EspaceClient implements ChainClient {
  readonly chainId: number;
  readonly chainType = 'evm' as const;
  readonly publicClient: PublicClient;
  protected readonly chain: Chain;
  public address: Address;

  constructor(config: ClientConfig) {
    this.chainId = config.chainId;

    // Create chain configuration based on provided chain ID
    if (config.chainId === 1030) {
      this.chain = espaceMainnet;
    } else if (config.chainId === 71) {
      this.chain = espaceTestnet;
    } else {
      // Custom chain configuration for development
      this.chain = defineChain({
        id: config.chainId,
        name: `Conflux eSpace (${config.chainId})`,
        nativeCurrency: { name: 'Conflux', symbol: 'CFX', decimals: 18 },
        rpcUrls: { default: { http: [config.rpcUrl] } },
      });
    }

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
      const blockNumber = await this.publicClient.getBlockNumber();
      return blockNumber;
    } catch (error) {
      throw new NodeError(
        `Failed to get block number: ${error instanceof Error ? error.message : String(error)}`,
        'BLOCK_NUMBER_ERROR',
        'evm',
        { originalError: error }
      );
    }
  }

  async getBalance(address: Address): Promise<string> {
    if (!isEvmAddress(address)) {
      throw new NodeError(
        'Invalid EVM address format',
        'INVALID_ADDRESS',
        'evm'
      );
    }

    try {
      const balance = await this.publicClient.getBalance({ address });
      return formatEther(balance);
    } catch (error) {
      throw new NodeError(
        `Failed to get balance: ${error instanceof Error ? error.message : String(error)}`,
        'BALANCE_ERROR',
        'evm',
        { address, originalError: error }
      );
    }
  }

  async estimateGas(tx: BaseTransaction): Promise<bigint> {
    try {
      const gas = await this.publicClient.estimateGas({
        to: tx.to as Address,
        value: tx.value,
        data: tx.data as `0x${string}`,
      });
      return gas;
    } catch (error) {
      throw new NodeError(
        `Failed to estimate gas: ${error instanceof Error ? error.message : String(error)}`,
        'GAS_ESTIMATE_ERROR',
        'evm',
        { transaction: tx, originalError: error }
      );
    }
  }

  async waitForTransaction(hash: string): Promise<TransactionReceipt> {
    try {
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: hash as `0x${string}`,
        timeout: 5_000, // 5 second timeout for faster response
      });

      return {
        hash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        transactionIndex: receipt.transactionIndex,
        status: receipt.status === 'success' ? 'success' : 'reverted',
        gasUsed: receipt.gasUsed,
        contractAddress: receipt.contractAddress || undefined,
        logs: receipt.logs.map((log) => ({
          address: log.address,
          topics: log.topics,
          data: log.data,
          blockNumber: log.blockNumber || 0n,
          transactionHash: log.transactionHash || '',
          logIndex: log.logIndex || 0,
        })),
      };
    } catch (error) {
      throw new NodeError(
        `Failed to wait for transaction: ${error instanceof Error ? error.message : String(error)}`,
        'TRANSACTION_WAIT_ERROR',
        'evm',
        { hash, originalError: error }
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
        'evm',
        { originalError: error }
      );
    }
  }

  /**
   * Get the current chain ID from the network
   */
  async getChainId(): Promise<number> {
    try {
      const chainId = await this.publicClient.getChainId();
      return chainId;
    } catch (error) {
      throw new NodeError(
        `Failed to get chain ID: ${error instanceof Error ? error.message : String(error)}`,
        'CHAIN_ID_ERROR',
        'evm',
        { originalError: error }
      );
    }
  }

  /**
   * Check if the client is connected to the network
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.publicClient.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  }

  // Base implementation - should be overridden by WalletClient
  async sendTransaction(_tx: BaseTransaction): Promise<string> {
    throw new NodeError(
      'sendTransaction not available on public client',
      'METHOD_NOT_AVAILABLE',
      'evm'
    );
  }

  async getTokenBalance(
    _address: string,
    _tokenAddress: string
  ): Promise<string> {
    try {
      const balance = await this.publicClient.readContract({
        address: _tokenAddress as Address,
        abi: [
          {
            type: 'function',
            name: 'balanceOf',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: 'balance', type: 'uint256' }],
            stateMutability: 'view',
          },
        ],
        functionName: 'balanceOf',
        args: [_address as Address],
      });
      return balance.toString();
    } catch (error) {
      throw new NodeError(
        `Failed to get token balance: ${error instanceof Error ? error.message : String(error)}`,
        'TOKEN_BALANCE_ERROR',
        'evm',
        { address: _address, tokenAddress: _tokenAddress, originalError: error }
      );
    }
  }

  watchBlocks(callback: EventCallback<BlockEvent>): () => void {
    const unwatch = this.publicClient.watchBlocks({
      onBlock: (block) =>
        callback({
          chainType: 'evm',
          blockNumber: block.number || 0n,
          blockHash: block.hash || '',
          timestamp: Number(block.timestamp || 0),
          transactionCount: block.transactions?.length || 0,
        }),
    });
    return unwatch;
  }

  async watchTransaction(
    _hash: string,
    _callback: (receipt: TransactionReceipt) => void
  ): Promise<() => void> {
    // This is a simplified implementation - viem doesn't have a direct watchTransaction
    // In practice, you'd poll for the transaction receipt
    const pollTransaction = async () => {
      try {
        const receipt = await this.waitForTransaction(_hash);
        _callback(receipt);
      } catch {
        // Transaction might not be mined yet, continue polling
        setTimeout(pollTransaction, 1000);
      }
    };

    setTimeout(pollTransaction, 1000);
    return () => {}; // Return a no-op unwatch function
  }

  getInternalClient(): PublicClient | WalletClient {
    return this.publicClient;
  }

  // Base implementation - should be overridden by TestClient
  watchTransactions(_callback: EventCallback<TransactionEvent>): () => void {
    throw new NodeError(
      'watchTransactions not available on public client',
      'METHOD_NOT_AVAILABLE',
      'evm'
    );
  }

  isValidAddress(address: string): boolean {
    return isEvmAddress(address);
  }

  formatAmount(amount: bigint): string {
    return formatEther(amount);
  }

  parseAmount(amount: string): bigint {
    return parseEther(amount);
  }
}

/**
 * EVM Space Wallet Client
 * Extends EspaceClient with transaction and account functionality
 */
export class EspaceWalletClient
  extends EspaceClient
  implements UnifiedWalletClient
{
  private readonly walletClient: WalletClient;
  private readonly account: Account;

  constructor(config: ClientConfig & { privateKey: string }) {
    super(config);

    // Create account from private key
    this.account = privateKeyToAccount(config.privateKey as `0x${string}`);
    this.address = this.account.address;

    // Create wallet client
    this.walletClient = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(config.rpcUrl),
    });
  }

  getAddress(): Address {
    return this.address;
  }

  async sendTransaction(tx: BaseTransaction): Promise<string> {
    try {
      const hash = await this.walletClient.sendTransaction({
        account: this.account,
        chain: this.chain,
        to: tx.to as Address,
        value: tx.value,
        data: tx.data as `0x${string}`,
        gas: tx.gasLimit,
        gasPrice: tx.gasPrice,
        nonce: tx.nonce,
      });
      return hash;
    } catch (error) {
      throw new NodeError(
        `Failed to send transaction: ${error instanceof Error ? error.message : String(error)}`,
        'TRANSACTION_ERROR',
        'evm',
        { transaction: tx, originalError: error }
      );
    }
  }

  async signMessage(message: string): Promise<string> {
    try {
      const signature = await this.walletClient.signMessage({
        account: this.account,
        message,
      });
      return signature;
    } catch (error) {
      throw new NodeError(
        `Failed to sign message: ${error instanceof Error ? error.message : String(error)}`,
        'SIGNING_ERROR',
        'evm',
        { message, originalError: error }
      );
    }
  }

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

      return receipt.contractAddress;
    } catch (error) {
      throw new NodeError(
        `Failed to deploy contract: ${error instanceof Error ? error.message : String(error)}`,
        'DEPLOYMENT_ERROR',
        'evm',
        { bytecode, constructorArgs, originalError: error }
      );
    }
  }

  async callContract<T = unknown>(
    address: string,
    abi: unknown[],
    functionName: string,
    args: unknown[] = []
  ): Promise<T> {
    try {
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
        'evm',
        { address, functionName, args, originalError: error }
      );
    }
  }

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
        `Failed to write contract: ${error instanceof Error ? error.message : String(error)}`,
        'CONTRACT_WRITE_ERROR',
        'evm',
        { address, functionName, args, value, originalError: error }
      );
    }
  }

  /**
   * Transfer CFX from eSpace to Core Space
   * Uses the built-in withdrawal mechanism
   */
  async faucetToCore(coreAddress: string, amount: string): Promise<string> {
    // Basic Core address format validation (cfx:...)
    if (!coreAddress.startsWith('cfx:') || coreAddress.length < 30) {
      throw new NodeError(
        'Invalid Core address format',
        'INVALID_ADDRESS',
        'evm',
        { coreAddress }
      );
    }

    try {
      // Use the CrossSpaceCall precompiled contract for eSpace to Core transfers
      const hash = await this.walletClient.sendTransaction({
        account: this.account,
        chain: this.chain,
        to: '0x0888000000000000000000000000000000000006', // CrossSpaceCall precompiled address
        value: parseEther(amount),
        data: encodeFunctionData({
          abi: [
            {
              type: 'function',
              name: 'withdrawFromMapped',
              inputs: [{ name: 'value', type: 'uint256' }],
              outputs: [],
              stateMutability: 'payable',
            },
          ],
          functionName: 'withdrawFromMapped',
          args: [parseEther(amount)],
        }),
      });

      return hash;
    } catch (error) {
      throw new NodeError(
        `Failed to send faucet transaction to Core: ${error instanceof Error ? error.message : String(error)}`,
        'FAUCET_ERROR',
        'evm',
        { coreAddress, amount, originalError: error }
      );
    }
  }

  getInternalClient(): PublicClient | WalletClient {
    return this.walletClient;
  }
}

/**
 * EVM Space Test Client
 * Extends EspaceWalletClient with additional testing utilities
 */
export class EspaceTestClient extends EspaceWalletClient implements TestClient {
  private readonly testClient: ViemTestClient;

  constructor(config: TestConfig & { privateKey: string }) {
    super(config);

    this.testClient = createTestClient({
      mode: 'anvil',
      chain: this.chainId === 1030 ? espaceMainnet : espaceTestnet,
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
        'MINING_ERROR',
        'evm',
        { blocks, originalError: error }
      );
    }
  }

  async setNextBlockTimestamp(timestamp: number): Promise<void> {
    try {
      await this.testClient.setNextBlockTimestamp({
        timestamp: BigInt(timestamp),
      });
    } catch (error) {
      throw new NodeError(
        `Failed to set next block timestamp: ${error instanceof Error ? error.message : String(error)}`,
        'TIMESTAMP_ERROR',
        'evm',
        { timestamp, originalError: error }
      );
    }
  }

  async increaseTime(seconds: number): Promise<void> {
    try {
      await this.testClient.increaseTime({ seconds });
    } catch (error) {
      throw new NodeError(
        `Failed to increase time: ${error instanceof Error ? error.message : String(error)}`,
        'TIME_INCREASE_ERROR',
        'evm',
        { seconds, originalError: error }
      );
    }
  }

  async impersonateAccount(address: string): Promise<void> {
    try {
      await this.testClient.impersonateAccount({ address: address as Address });
    } catch (error) {
      throw new NodeError(
        `Failed to impersonate account: ${error instanceof Error ? error.message : String(error)}`,
        'IMPERSONATION_ERROR',
        'evm',
        { address, originalError: error }
      );
    }
  }

  async stopImpersonatingAccount(address: string): Promise<void> {
    try {
      await this.testClient.stopImpersonatingAccount({
        address: address as Address,
      });
    } catch (error) {
      throw new NodeError(
        `Failed to stop impersonating account: ${error instanceof Error ? error.message : String(error)}`,
        'IMPERSONATION_STOP_ERROR',
        'evm',
        { address, originalError: error }
      );
    }
  }

  async setBalance(address: string, balance: bigint): Promise<void> {
    try {
      await this.testClient.setBalance({
        address: address as Address,
        value: balance,
      });
    } catch (error) {
      throw new NodeError(
        `Failed to set balance: ${error instanceof Error ? error.message : String(error)}`,
        'BALANCE_SET_ERROR',
        'evm',
        { address, balance, originalError: error }
      );
    }
  }

  async snapshot(): Promise<string> {
    try {
      const snapshotId = await this.testClient.snapshot();
      return snapshotId;
    } catch (error) {
      throw new NodeError(
        `Failed to create snapshot: ${error instanceof Error ? error.message : String(error)}`,
        'SNAPSHOT_ERROR',
        'evm',
        { originalError: error }
      );
    }
  }

  async revert(snapshotId: string): Promise<void> {
    try {
      await this.testClient.revert({ id: snapshotId as `0x${string}` });
    } catch (error) {
      throw new NodeError(
        `Failed to revert to snapshot: ${error instanceof Error ? error.message : String(error)}`,
        'REVERT_ERROR',
        'evm',
        { snapshotId, originalError: error }
      );
    }
  }

  async getStorageAt(address: string, slot: string): Promise<string> {
    try {
      const value = await this.publicClient.getStorageAt({
        address: address as Address,
        slot: slot as `0x${string}`,
      });
      return value || '0x';
    } catch (error) {
      throw new NodeError(
        `Failed to get storage: ${error instanceof Error ? error.message : String(error)}`,
        'STORAGE_GET_ERROR',
        'evm',
        { address, slot, originalError: error }
      );
    }
  }

  async setStorageAt(
    address: string,
    slot: string,
    value: string
  ): Promise<void> {
    try {
      await this.testClient.setStorageAt({
        address: address as Address,
        index: slot as `0x${string}`,
        value: value as `0x${string}`,
      });
    } catch (error) {
      throw new NodeError(
        `Failed to set storage: ${error instanceof Error ? error.message : String(error)}`,
        'STORAGE_SET_ERROR',
        'evm',
        { address, slot, value, originalError: error }
      );
    }
  }

  watchTransactions(callback: EventCallback<TransactionEvent>): () => void {
    // This is a simplified implementation
    // In practice, you'd need to implement proper transaction watching
    const unwatch = this.publicClient.watchPendingTransactions({
      onTransactions: (hashes) => {
        for (const hash of hashes) {
          // For each transaction, we'd need to fetch details
          // This is a simplified callback - in real implementation you'd fetch transaction details
          callback({
            chainType: 'evm',
            hash,
            from: '', // Would need to fetch transaction details
            to: '', // Would need to fetch transaction details
            value: 0n, // Would need to fetch transaction details
            blockNumber: 0n, // Would need to fetch transaction details
          });
        }
      },
    });
    return unwatch;
  }

  isValidAddress(address: string): boolean {
    return isEvmAddress(address);
  }

  async getCurrentEpoch(): Promise<bigint> {
    return await this.getBlockNumber();
  }

  async generateAccounts(count: number): Promise<string[]> {
    const accounts: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate random private key and derive address
      const privateKey =
        `0x${'0'.repeat(64 - 2)}${i.toString(16).padStart(2, '0')}${'0'.repeat(60)}` as const;
      const account = privateKeyToAccount(privateKey);
      accounts.push(account.address);
    }
    return accounts;
  }
}

/**
 * Create an eSpace client instance with all components
 */
export async function createEspaceClient(
  config: ClientConfig
): Promise<EspaceClientInstance> {
  const chainConfig = getChainConfig(config.chainId as SupportedChainId);

  if (chainConfig.type !== 'evm') {
    throw new NodeError(
      `Invalid chain type for eSpace client: ${chainConfig.type}`,
      'INVALID_CHAIN_TYPE',
      'evm'
    );
  }

  // Update config with proper RPC URL if not provided
  const clientConfig: ClientConfig = {
    ...config,
    rpcUrl:
      config.rpcUrl ||
      chainConfig.rpcUrls.default.http[0] ||
      'http://localhost:8545',
  };

  const publicClient = new EspaceClient(clientConfig);

  let walletClient: EspaceWalletClient | undefined;
  let testClient: EspaceTestClient | undefined;

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
    walletClient = new EspaceWalletClient(walletConfig);
  }

  if (config.testMode) {
    // Test client needs a private key, use a default one if not provided
    let privateKey: string;
    if (config.account) {
      if (typeof config.account === 'string') {
        privateKey = config.account;
      } else {
        privateKey = config.account.privateKey;
      }
    } else {
      // Default test private key
      privateKey =
        '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    }

    const testConfig: TestConfig & { privateKey: string } = {
      ...clientConfig,
      enableTestMode: true,
      privateKey,
    };
    testClient = new EspaceTestClient(testConfig);
  }

  return {
    publicClient,
    walletClient,
    testClient,
  };
}
