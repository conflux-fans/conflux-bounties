// @cfxdevkit/sdk
// Conflux SDK – single-package library for building on Conflux Core Space & eSpace
//
// Subpath exports (preferred for tree-shaking):
//   import { ClientManager } from '@cfxdevkit/sdk/clients';
//   import { SwapService }   from '@cfxdevkit/sdk/services';
//   import { ContractReader } from '@cfxdevkit/sdk/contracts';
//   import { generateMnemonic } from '@cfxdevkit/sdk/wallet';
//
// Or import everything from the root:
//   import { ClientManager, SwapService, ERC20_ABI } from '@cfxdevkit/sdk';

export { formatCFX, parseCFX } from 'cive';
export { isAddress as isCoreAddress } from 'cive/utils';
// ── Re-export useful viem/cive primitives ──────────────────────────────────
export { formatUnits, isAddress as isEspaceAddress, parseUnits } from 'viem';
// ── Clients ────────────────────────────────────────────────────────────────
export {
  ClientManager,
  CoreClient,
  CoreTestClient,
  CoreWalletClient,
  EspaceClient,
  EspaceTestClient,
  EspaceWalletClient,
} from './clients/index.js';
export type {
  ClientManagerConfig,
  ClientManagerEvents,
  ClientManagerStatus,
} from './clients/manager.js';
export type { ChainConfig } from './config/chains.js';
// ── Chain Configuration ────────────────────────────────────────────────────
export {
  CORE_LOCAL,
  CORE_MAINNET,
  CORE_TESTNET,
  defaultNetworkSelector,
  EVM_LOCAL,
  EVM_MAINNET,
  EVM_TESTNET,
  getChainConfig,
  getCoreChains,
  getEvmChains,
  getMainnetChains,
} from './config/index.js';
// ── Contracts ──────────────────────────────────────────────────────────────
export {
  ContractDeployer,
  ContractError,
  ContractReader,
  ContractWriter,
  DeploymentError,
  ERC20_ABI,
  ERC721_ABI,
  ERC1155_ABI,
  InteractionError,
} from './contracts/index.js';
// ── Services ───────────────────────────────────────────────────────────────
export {
  EncryptionService,
  getKeystoreService,
  KeystoreLockedError,
  KeystoreService,
  SwapService,
} from './services/index.js';
// ── Types ──────────────────────────────────────────────────────────────────
export type {
  Address,
  ChainType,
  CoreAddress,
  EvmAddress,
  Hash,
  UnifiedAccount,
} from './types/index.js';
// ── Utils ──────────────────────────────────────────────────────────────────
export { logger } from './utils/index.js';
// ── Wallet ─────────────────────────────────────────────────────────────────
export {
  deriveAccount,
  deriveAccounts,
  deriveFaucetAccount,
  EmbeddedWalletManager,
  generateMnemonic,
  SessionKeyManager,
  TransactionBatcher,
  validateMnemonic,
} from './wallet/index.js';
