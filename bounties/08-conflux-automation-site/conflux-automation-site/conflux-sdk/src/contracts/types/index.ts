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

/**
 * Contract Deployment Types
 */

export interface DeploymentOptions {
  /** Contract bytecode */
  bytecode: string;
  /** Contract ABI */
  abi: unknown[];
  /** Constructor arguments */
  args?: unknown[];
  /** Chain to deploy on */
  chain: ChainType;
  /** Value to send with deployment (in wei) */
  value?: bigint;
  /** Gas limit */
  gasLimit?: bigint;
  /** Gas price (in wei) */
  gasPrice?: bigint;
}

export interface DeploymentResult {
  /** Deployed contract address */
  address: string;
  /** Deployment transaction hash */
  transactionHash: string;
  /** Block number of deployment */
  blockNumber: bigint;
  /** Deployer address */
  deployer: string;
  /** Chain deployed on */
  chain: ChainType;
  /** Deployment timestamp */
  deployedAt: Date;
  /** Gas used for deployment */
  gasUsed: bigint;
}

/**
 * Contract Interaction Types
 */

export interface ReadOptions {
  /** Contract address */
  address: string;
  /** Contract ABI */
  abi: unknown[];
  /** Function name to call */
  functionName: string;
  /** Function arguments */
  args?: unknown[];
  /** Chain to read from */
  chain: ChainType;
  /** Block number to read at (optional) */
  blockNumber?: bigint;
}

export interface WriteOptions {
  /** Contract address */
  address: string;
  /** Contract ABI */
  abi: unknown[];
  /** Function name to call */
  functionName: string;
  /** Function arguments */
  args?: unknown[];
  /** Chain to write to */
  chain: ChainType;
  /** Value to send (in wei) */
  value?: bigint;
  /** Gas limit */
  gasLimit?: bigint;
  /** Gas price (in wei) */
  gasPrice?: bigint;
  /** Wait for transaction confirmation */
  waitForConfirmation?: boolean;
}

export interface WriteResult {
  /** Transaction hash */
  hash: string;
  /** From address */
  from: string;
  /** To address (contract) */
  to: string;
  /** Chain */
  chain: ChainType;
  /** Block number (if confirmed) */
  blockNumber?: bigint;
  /** Gas used (if confirmed) */
  gasUsed?: bigint;
  /** Transaction status */
  status?: 'success' | 'reverted';
}

/**
 * Contract Verification Types
 */

export interface ContractInfo {
  /** Contract address */
  address: string;
  /** Contract name */
  name?: string;
  /** Contract bytecode */
  bytecode: string;
  /** Contract ABI */
  abi?: unknown[];
  /** Deployment block */
  deploymentBlock?: bigint;
  /** Chain */
  chain: ChainType;
  /** Is verified */
  isVerified: boolean;
}

/**
 * Standard Token Types
 */

export interface ERC20TokenInfo {
  /** Token address */
  address: string;
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Token decimals */
  decimals: number;
  /** Total supply */
  totalSupply: bigint;
  /** Chain */
  chain: ChainType;
}

export interface ERC721TokenInfo {
  /** Token address */
  address: string;
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Total supply */
  totalSupply?: bigint;
  /** Base URI */
  baseURI?: string;
  /** Chain */
  chain: ChainType;
}

export interface NFTMetadata {
  /** Token ID */
  tokenId: bigint;
  /** Token name */
  name?: string;
  /** Token description */
  description?: string;
  /** Token image URL */
  image?: string;
  /** Additional attributes */
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

/**
 * Contract Events Types
 */

export interface EventFilter {
  /** Contract address */
  address: string;
  /** Event ABI */
  abi: unknown[];
  /** Event name */
  eventName: string;
  /** Event argument filters */
  args?: Record<string, unknown>;
  /** From block */
  fromBlock?: bigint;
  /** To block */
  toBlock?: bigint;
  /** Chain */
  chain: ChainType;
}

export interface EventLog {
  /** Contract address */
  address: string;
  /** Event name */
  eventName: string;
  /** Event arguments */
  args: Record<string, unknown>;
  /** Block number */
  blockNumber: bigint;
  /** Transaction hash */
  transactionHash: string;
  /** Log index */
  logIndex: number;
  /** Chain */
  chain: ChainType;
}

/**
 * Multi-Chain Deployment Types
 */

export interface MultiChainDeploymentOptions {
  /** Contract bytecode */
  bytecode: string;
  /** Contract ABI */
  abi: unknown[];
  /** Constructor arguments */
  args?: unknown[];
  /** Chains to deploy on */
  chains: ChainType[];
  /** Value per deployment (in wei) */
  value?: bigint;
}

export interface MultiChainDeploymentResult {
  /** Core Space deployment */
  core?: DeploymentResult;
  /** eSpace deployment */
  evm?: DeploymentResult;
  /** Number of successful deployments */
  successCount: number;
  /** Number of failed deployments */
  failureCount: number;
}

/**
 * Error Types
 */

export class ContractError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ContractError';
  }
}

export class DeploymentError extends ContractError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DEPLOYMENT_ERROR', context);
    this.name = 'DeploymentError';
  }
}

export class InteractionError extends ContractError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'INTERACTION_ERROR', context);
    this.name = 'InteractionError';
  }
}
