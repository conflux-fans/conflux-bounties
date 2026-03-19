// @cfxdevkit/sdk - Services module
// Framework-agnostic blockchain services: swap, keystore, encryption

// Encryption service (AES-256-GCM)
export { EncryptionService } from './encryption.js';
export type { DerivedAccount } from './keystore.js';

// Keystore service (encrypted HD wallet storage)
export {
  getKeystoreService,
  KeystoreLockedError,
  KeystoreService,
} from './keystore.js';
// Keystore types
export type {
  AddMnemonicData,
  ConfigModificationCheck,
  DerivedKeys,
  KeystoreV2,
  MnemonicEntry,
  MnemonicSummary,
  NodeConfig,
  SetupData,
  ValidationResult,
} from './keystore-types.js';
export type {
  SwapExecuteParams,
  SwapQuote,
  SwapQuoteParams,
  SwapResult,
} from './swap.js';
// Swap service (Swappi DEX integration for Conflux eSpace)
export { SwapService } from './swap.js';
