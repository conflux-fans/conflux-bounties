import type { DCAParams, LimitOrderParams } from './types.js';

/**
 * Minimal interface that any concrete keeper/executor must satisfy.
 *
 * The SDK defines the contract here; implementations live in the CAS worker
 * (KeeperClient) or in custom keeper deployments.
 */
export interface KeeperClient {
  /**
   * Submit an `executeLimitOrder` transaction to the AutomationManager
   * contract and wait for it to be mined.
   */
  executeLimitOrder(
    jobId: `0x${string}`,
    owner: `0x${string}`,
    params: LimitOrderParams
  ): Promise<{ txHash: `0x${string}`; amountOut?: string }>;

  /**
   * Submit an `executeDCATick` transaction and wait for confirmation.
   */
  executeDCATick(
    jobId: `0x${string}`,
    owner: `0x${string}`,
    params: DCAParams
  ): Promise<{ txHash: `0x${string}`; amountOut?: string }>;

  /**
   * Read the current on-chain status of a job.
   *
   * Maps the contract `JobStatus` enum:
   *  `0 = ACTIVE → 'active'`
   *  `1 = EXECUTED → 'executed'`
   *  `2 = CANCELLED → 'cancelled'`
   *  `3 = EXPIRED → 'expired'`
   */
  getOnChainStatus(
    jobId: `0x${string}`
  ): Promise<'active' | 'executed' | 'cancelled' | 'expired'>;
}
