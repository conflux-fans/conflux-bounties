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

// Types Index - Export all type definitions

// Re-export chain types from config
export type { SupportedChainId } from '../config/chains.js';
export * from './clients.js';
export * from './config.js';

// Health status enum
export type HealthStatus = 'healthy' | 'unhealthy' | 'disconnected' | 'unknown';

// Import client types
import type {
  CoreClient,
  CoreTestClient,
  CoreWalletClient,
} from '../clients/core.js';
import type {
  EspaceClient,
  EspaceTestClient,
  EspaceWalletClient,
} from '../clients/evm.js';

// Combined client instance types
export interface CoreClientInstance {
  publicClient: CoreClient;
  walletClient?: CoreWalletClient;
  testClient?: CoreTestClient;
}

export interface EspaceClientInstance {
  publicClient: EspaceClient;
  walletClient?: EspaceWalletClient;
  testClient?: EspaceTestClient;
}

// DevKit API Types
export interface StartOptions {
  mining?: boolean;
  waitForBlocks?: number;
  fundingAmount?: string;
}

export interface DeployOptions {
  abi: unknown[];
  bytecode: string;
  args?: unknown[];
  account: number;
  chain?: 'core' | 'evm';
  chains?: ('core' | 'evm')[];
  value?: bigint;
}

export interface ReadOptions {
  address: string;
  abi: unknown[];
  functionName: string;
  args?: unknown[];
  chain: 'core' | 'evm';
}

export interface WriteOptions {
  address: string;
  abi: unknown[];
  functionName: string;
  args?: unknown[];
  account: number;
  chain: 'core' | 'evm';
  value?: bigint;
  waitForConfirmation?: boolean;
}

export interface ContractResult {
  core?: string;
  evm?: string;
}

export interface ChainStatus {
  core: { connected: boolean; status: string };
  evm: { connected: boolean; status: string };
}

export interface FaucetBalances {
  coreBalance: string;
  evmBalance: string;
}

export interface MiningStatus {
  isRunning: boolean;
  interval: number;
  blocksMined: number;
  startTime?: Date;
}

export interface ChainBalances {
  core: string;
  evm: string;
}
