// ── Automation module barrel ────────────────────────────────────────────────
//
// Public surface of `@cfxdevkit/sdk/automation`.
//
// Usage:
//   import { SafetyGuard, RetryQueue, PriceChecker, AUTOMATION_MANAGER_ABI }
//     from '@cfxdevkit/sdk/automation';

// ABIs — legacy UPPER_CASE names + wagmi/viem-idiomatic camelCase names
export {
  AUTOMATION_MANAGER_ABI,
  SWAPPI_PRICE_ADAPTER_ABI,
  PERMIT_HANDLER_ABI,
  automationManagerAbi,
  swappiPriceAdapterAbi,
  permitHandlerAbi,
  // Deployment bytecode (for programmatic deploy via viem deployContract)
  automationManagerBytecode,
  swappiPriceAdapterBytecode,
  permitHandlerBytecode,
  // Deployed addresses + wagmi-style contract configs (keyed by chain ID)
  automationManagerAddress,
  automationManagerConfig,
  swappiPriceAdapterAddress,
  swappiPriceAdapterConfig,
  permitHandlerAddress,
  permitHandlerConfig,
} from './abi.js';
export type { KeeperClient } from './keeper-interface.js';
export type { AutomationLogger } from './logger.js';
export { noopLogger } from './logger.js';
export type { DecimalsResolver, PriceCheckResult, PriceSource } from './price-checker.js';
export { PriceChecker } from './price-checker.js';
export { RetryQueue } from './retry-queue.js';
export { DEFAULT_SAFETY_CONFIG, SafetyGuard } from './safety-guard.js';
export type {
  BaseJob,
  DCAJob,
  DCAParams,
  Job,
  JobStatus,
  JobType,
  LimitOrderJob,
  LimitOrderParams,
  SafetyCheckResult,
  SafetyConfig,
  SafetyViolation,
} from './types.js';
