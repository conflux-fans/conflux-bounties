// @cfxdevkit/sdk - Wallet module
// HD wallet derivation, session keys, transaction batching, embedded wallets

// Transaction Batching
export { TransactionBatcher } from './batching/batcher.js';
// ── HD Wallet Derivation (BIP32/BIP39) ─────────────────────────────────────
export {
  deriveAccount,
  deriveAccounts,
  deriveFaucetAccount,
  generateMnemonic,
  getDerivationPath,
  validateMnemonic,
} from './derivation.js';
// Embedded Wallets
export { EmbeddedWalletManager } from './embedded/custody.js';

// ── Advanced Wallet Abstractions ────────────────────────────────────────────
// Session Keys
export { SessionKeyManager } from './session-keys/manager.js';
// Shared wallet types
export type {
  BatcherOptions,
  BatchResult,
  BatchTransaction,
  EmbeddedWallet,
  EmbeddedWalletOptions,
  SessionKey,
  SessionKeyOptions,
  SessionKeyPermissions,
  SignedTransaction,
  SignTransactionRequest,
} from './types/index.js';
export type {
  DerivationOptions,
  DerivedAccount,
  MnemonicValidation,
} from './types.js';
export {
  COIN_TYPES,
  CORE_NETWORK_IDS,
} from './types.js';
