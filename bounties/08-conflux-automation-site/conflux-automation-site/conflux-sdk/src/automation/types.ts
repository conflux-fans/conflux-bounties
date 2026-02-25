// ──────────────────────────────────────────────────────────────────────────────
// Automation types — job lifecycle, safety guardrails, and strategy params.
//
// These types are the shared language between:
//   - the AutomationManager.sol contract (via ABI mapping)
//   - the off-chain keeper/executor worker
//   - any frontend or API layer that manages jobs
// ──────────────────────────────────────────────────────────────────────────────

// ── Job lifecycle ─────────────────────────────────────────────────────────────

export type JobStatus =
  | 'pending' // created, waiting for worker pickup
  | 'active' // being evaluated this tick
  | 'executed' // successfully submitted on-chain
  | 'cancelled' // user-cancelled
  | 'failed' // exhausted retries
  | 'paused'; // halted by SafetyGuard

export type JobType = 'limit_order' | 'dca';

export interface BaseJob {
  id: string;
  owner: string; // checksummed EVM address
  type: JobType;
  status: JobStatus;
  /** bytes32 hex jobId from the on-chain JobCreated event (0x-prefixed) */
  onChainJobId: string | null;
  createdAt: number; // unix ms
  updatedAt: number; // unix ms
  expiresAt: number | null; // unix ms, null = no expiry
  retries: number;
  maxRetries: number;
  lastError: string | null;
}

export interface LimitOrderJob extends BaseJob {
  type: 'limit_order';
  params: LimitOrderParams;
}

export interface DCAJob extends BaseJob {
  type: 'dca';
  params: DCAParams;
}

export type Job = LimitOrderJob | DCAJob;

// ── Limit-order params ────────────────────────────────────────────────────────

export interface LimitOrderParams {
  tokenIn: string; // ERC-20 address
  tokenOut: string;
  amountIn: string; // wei string
  minAmountOut: string; // minimum received (slippage-controlled), wei string
  targetPrice: string; // price in tokenOut/tokenIn, 18-decimal wei string
  direction: 'gte' | 'lte'; // trigger when price >= or <= target
  /** User-configured slippage in basis points (e.g. 50 = 0.5%) — stored for display */
  slippageBps?: number;
}

// ── DCA params ────────────────────────────────────────────────────────────────

export interface DCAParams {
  tokenIn: string;
  tokenOut: string;
  amountPerSwap: string; // wei string
  intervalSeconds: number;
  totalSwaps: number;
  swapsCompleted: number;
  nextExecution: number; // unix ms
}

// ── Safety / guardrail types ────────────────────────────────────────────────

export interface SafetyConfig {
  /** Maximum USD value per single swap */
  maxSwapUsd: number;
  /** Maximum slippage in basis points (e.g. 200 = 2%) */
  maxSlippageBps: number;
  /** Maximum retries before a job is marked failed */
  maxRetries: number;
  /** Minimum seconds between consecutive executions for the same job */
  minExecutionIntervalSeconds: number;
  /** If true, all job execution is halted (circuit-breaker) */
  globalPause: boolean;
}

export interface SafetyViolation {
  jobId: string;
  rule: keyof SafetyConfig;
  detail: string;
  timestamp: number;
}

export type SafetyCheckResult =
  | { ok: true }
  | { ok: false; violation: SafetyViolation };
