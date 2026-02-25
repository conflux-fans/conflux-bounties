// ──────────────────────────────────────────────────────────────────────────────
// Strategy types – UI-facing configuration before a Job is created
// ──────────────────────────────────────────────────────────────────────────────

export interface LimitOrderStrategy {
  kind: 'limit_order';
  tokenIn: string;
  tokenOut: string;
  amountIn: string; // human-readable (e.g. "100.0")
  targetPrice: string; // human-readable price
  direction: 'gte' | 'lte';
  slippageBps: number; // basis points, e.g. 50 = 0.5%
  expiresInDays: number | null;
}

export interface DCAStrategy {
  kind: 'dca';
  tokenIn: string;
  tokenOut: string;
  amountPerSwap: string; // human-readable
  intervalHours: number;
  totalSwaps: number;
  slippageBps: number;
}

export type Strategy = LimitOrderStrategy | DCAStrategy;
