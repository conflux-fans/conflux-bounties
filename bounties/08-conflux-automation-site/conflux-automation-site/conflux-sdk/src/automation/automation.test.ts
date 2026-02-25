/**
 * Automation module unit tests.
 *
 * Tests for SafetyGuard, RetryQueue, and PriceChecker imported directly from
 * the SDK — no worker dependencies involved.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SAFETY_CONFIG,
  PriceChecker,
  RetryQueue,
  SafetyGuard,
  noopLogger,
} from './index.js';
import type { DCAJob, LimitOrderJob } from './types.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeLimitOrderJob(
  overrides: Partial<LimitOrderJob> = {}
): LimitOrderJob {
  return {
    id: 'job-1',
    owner: '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
    type: 'limit_order',
    status: 'active',
    onChainJobId: null,
    createdAt: Date.now() - 1000,
    updatedAt: Date.now(),
    expiresAt: null,
    retries: 0,
    maxRetries: 5,
    lastError: null,
    params: {
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: '1000000000000000000', // 1e18
      minAmountOut: '990000000000000000',
      targetPrice: '1000000000000000000',
      direction: 'gte',
    },
    ...overrides,
  };
}

function makeDCAJob(overrides: Partial<DCAJob> = {}): DCAJob {
  return {
    id: 'dca-1',
    owner: '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
    type: 'dca',
    status: 'active',
    onChainJobId: null,
    createdAt: Date.now() - 1000,
    updatedAt: Date.now(),
    expiresAt: null,
    retries: 0,
    maxRetries: 5,
    lastError: null,
    params: {
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountPerSwap: '100000000000000000', // 0.1e18
      intervalSeconds: 3600,
      totalSwaps: 10,
      swapsCompleted: 0,
      nextExecution: Date.now() - 1,
    },
    ...overrides,
  };
}

// ─── SafetyGuard ──────────────────────────────────────────────────────────────

describe('SafetyGuard', () => {
  let guard: SafetyGuard;

  beforeEach(() => {
    guard = new SafetyGuard({ maxSwapUsd: 1000 });
  });

  it('passes a valid limit-order job within swap USD limit', () => {
    const result = guard.check(makeLimitOrderJob(), { swapUsd: 100 });
    expect(result.ok).toBe(true);
  });

  it('passes a valid DCA job whose interval has passed', () => {
    const result = guard.check(makeDCAJob(), { swapUsd: 50 });
    expect(result.ok).toBe(true);
  });

  it('fails any job when global pause is active', () => {
    guard.pauseAll();
    const result = guard.check(makeLimitOrderJob(), { swapUsd: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violation.rule).toBe('globalPause');
  });

  it('passes job again after resume', () => {
    guard.pauseAll();
    guard.resumeAll();
    expect(guard.check(makeLimitOrderJob(), { swapUsd: 1 }).ok).toBe(true);
  });

  it('isPaused() reflects current state', () => {
    expect(guard.isPaused()).toBe(false);
    guard.pauseAll();
    expect(guard.isPaused()).toBe(true);
    guard.resumeAll();
    expect(guard.isPaused()).toBe(false);
  });

  it('blocks swap exceeding maxSwapUsd', () => {
    const result = guard.check(makeLimitOrderJob(), { swapUsd: 9_999_999 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violation.rule).toBe('maxSwapUsd');
  });

  it('passes swap exactly at maxSwapUsd', () => {
    expect(guard.check(makeLimitOrderJob(), { swapUsd: 1000 }).ok).toBe(true);
  });

  it('blocks job that has exhausted retries', () => {
    const result = guard.check(
      makeLimitOrderJob({ retries: 5, maxRetries: 5 }),
      { swapUsd: 1 }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violation.rule).toBe('maxRetries');
  });

  it('passes job with one retry remaining', () => {
    expect(
      guard.check(makeLimitOrderJob({ retries: 4, maxRetries: 5 }), {
        swapUsd: 1,
      }).ok
    ).toBe(true);
  });

  it('blocks DCA job whose next execution is in the future', () => {
    const job = makeDCAJob({
      params: {
        ...makeDCAJob().params,
        nextExecution: Date.now() + 60_000,
      },
    });
    const result = guard.check(job, { swapUsd: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.violation.rule).toBe('minExecutionIntervalSeconds');
  });

  it('blocks expired job', () => {
    const result = guard.check(
      makeLimitOrderJob({ expiresAt: Date.now() - 1 }),
      { swapUsd: 1 }
    );
    expect(result.ok).toBe(false);
  });

  it('passes job with future expiry', () => {
    expect(
      guard.check(makeLimitOrderJob({ expiresAt: Date.now() + 1_000_000 }), {
        swapUsd: 1,
      }).ok
    ).toBe(true);
  });

  it('blocks cancelled job', () => {
    const result = guard.check(makeLimitOrderJob({ status: 'cancelled' }), {
      swapUsd: 1,
    });
    expect(result.ok).toBe(false);
  });

  it('records violations', () => {
    guard.pauseAll();
    guard.check(makeLimitOrderJob(), { swapUsd: 1 });
    guard.check(makeLimitOrderJob(), { swapUsd: 1 });
    expect(guard.getViolations().length).toBe(2);
  });

  it('clearViolations empties the log', () => {
    guard.pauseAll();
    guard.check(makeLimitOrderJob(), { swapUsd: 1 });
    guard.clearViolations();
    expect(guard.getViolations().length).toBe(0);
  });

  it('updateConfig changes limits dynamically', () => {
    guard.updateConfig({ maxSwapUsd: 1 });
    const result = guard.check(makeLimitOrderJob(), { swapUsd: 2 });
    expect(result.ok).toBe(false);
  });

  it('getConfig returns a snapshot (not a reference)', () => {
    const cfg = guard.getConfig() as { maxSwapUsd: number };
    cfg.maxSwapUsd = 0;
    expect(guard.getConfig().maxSwapUsd).toBe(1000);
  });

  it('DEFAULT_SAFETY_CONFIG has sensible values', () => {
    expect(DEFAULT_SAFETY_CONFIG.maxSwapUsd).toBeGreaterThan(0);
    expect(DEFAULT_SAFETY_CONFIG.maxSlippageBps).toBeLessThanOrEqual(1000);
    expect(DEFAULT_SAFETY_CONFIG.maxRetries).toBeGreaterThan(0);
    expect(DEFAULT_SAFETY_CONFIG.globalPause).toBe(false);
  });

  it('accepts an injectable logger and calls it', () => {
    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    };
    const g = new SafetyGuard({}, mockLogger);
    g.pauseAll();
    expect(mockLogger.warn).toHaveBeenCalled();
    g.check(makeLimitOrderJob(), { swapUsd: 1 });
    expect(mockLogger.warn).toHaveBeenCalledTimes(2);
  });
});

// ─── RetryQueue ───────────────────────────────────────────────────────────────

describe('RetryQueue', () => {
  it('starts empty', () => {
    const rq = new RetryQueue();
    expect(rq.size()).toBe(0);
  });

  it('enqueue increases size', () => {
    const rq = new RetryQueue();
    rq.enqueue(makeLimitOrderJob());
    expect(rq.size()).toBe(1);
  });

  it('drainDue returns nothing before delay expires', () => {
    const rq = new RetryQueue({ baseDelayMs: 100_000 });
    rq.enqueue(makeLimitOrderJob());
    expect(rq.drainDue()).toHaveLength(0);
  });

  it('drainDue returns job when time has passed', () => {
    const rq = new RetryQueue({ baseDelayMs: 0 });
    const job = makeLimitOrderJob();
    rq.enqueue(job);
    const due = rq.drainDue(Date.now() + 1);
    expect(due).toHaveLength(1);
    expect(due[0].id).toBe(job.id);
  });

  it('drainDue removes the job from the queue', () => {
    const rq = new RetryQueue({ baseDelayMs: 0 });
    rq.enqueue(makeLimitOrderJob());
    rq.drainDue(Date.now() + 1);
    expect(rq.size()).toBe(0);
  });

  it('remove deletes a job from queue', () => {
    const rq = new RetryQueue({ baseDelayMs: 100_000 });
    const job = makeLimitOrderJob();
    rq.enqueue(job);
    rq.remove(job.id);
    expect(rq.size()).toBe(0);
  });

  it('re-enqueueing same job increments attempt', () => {
    const rq = new RetryQueue({ baseDelayMs: 100_000 });
    const job = makeLimitOrderJob();
    rq.enqueue(job);
    rq.enqueue(job); // second enqueue of the same id = attempt 2
    expect(rq.size()).toBe(1);
  });
});

// ─── PriceChecker ─────────────────────────────────────────────────────────────

describe('PriceChecker', () => {
  const mockPriceSource = {
    getPrice: vi.fn().mockResolvedValue(1_000_000_000_000_000_000n), // 1e18
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPriceSource.getPrice.mockResolvedValue(1_000_000_000_000_000_000n);
  });

  it('checkLimitOrder: conditionMet=true when price >= target (gte)', async () => {
    const pc = new PriceChecker(mockPriceSource);
    const job = makeLimitOrderJob(); // target = 1e18, current = 1e18, direction gte
    const result = await pc.checkLimitOrder(job);
    expect(result.conditionMet).toBe(true);
  });

  it('checkLimitOrder: conditionMet=false when price < target (gte)', async () => {
    mockPriceSource.getPrice.mockResolvedValue(500_000_000_000_000_000n);
    const pc = new PriceChecker(mockPriceSource);
    const result = await pc.checkLimitOrder(makeLimitOrderJob());
    expect(result.conditionMet).toBe(false);
  });

  it('checkLimitOrder: conditionMet=true when price <= target (lte)', async () => {
    mockPriceSource.getPrice.mockResolvedValue(500_000_000_000_000_000n);
    const pc = new PriceChecker(mockPriceSource);
    const job = makeLimitOrderJob({
      params: {
        tokenIn: '0xTokenIn',
        tokenOut: '0xTokenOut',
        amountIn: '1000000000000000000',
        minAmountOut: '990000000000000000',
        targetPrice: '600000000000000000',
        direction: 'lte',
      },
    });
    const result = await pc.checkLimitOrder(job);
    expect(result.conditionMet).toBe(true);
  });

  it('checkDCA: conditionMet=true when nextExecution is in the past (>15s buffer)', async () => {
    // checkDCA applies a 15-second pre-execution buffer so the on-chain
    // block.timestamp is reliably past nextExecution when the tx is mined.
    // Set nextExecution well in the past to satisfy the buffer.
    const pc = new PriceChecker(mockPriceSource);
    const job = makeDCAJob({
      params: { ...makeDCAJob().params, nextExecution: Date.now() - 30_000 },
    });
    const result = await pc.checkDCA(job);
    expect(result.conditionMet).toBe(true);
  });

  it('checkDCA: conditionMet=false when nextExecution is in the future', async () => {
    const pc = new PriceChecker(mockPriceSource);
    const job = makeDCAJob({
      params: { ...makeDCAJob().params, nextExecution: Date.now() + 60_000 },
    });
    const result = await pc.checkDCA(job);
    expect(result.conditionMet).toBe(false);
  });

  it('updateTokenPrice feeds USD estimate', async () => {
    const pc = new PriceChecker(mockPriceSource);
    pc.updateTokenPrice('0xtokenin', 2000);
    const job = makeLimitOrderJob(); // amountIn = 1e18
    const result = await pc.checkLimitOrder(job);
    expect(result.swapUsd).toBeCloseTo(2000, 0);
  });

  it('swapUsd is 0 for unknown token', async () => {
    const pc = new PriceChecker(mockPriceSource);
    const result = await pc.checkLimitOrder(makeLimitOrderJob());
    expect(result.swapUsd).toBe(0);
  });

  it('_estimateUsd uses correct divisor for 6-decimal token (e.g. USDC)', async () => {
    // Resolver that returns 6 decimals for 0xtokenin
    const getDecimals = async (t: string) => t.toLowerCase() === '0xtokenin' ? 6 : 18;
    const pc = new PriceChecker(mockPriceSource, new Map(), noopLogger, getDecimals);
    pc.updateTokenPrice('0xtokenin', 1); // 1 USDC = $1
    const job = makeLimitOrderJob({
      params: {
        tokenIn: '0xTokenIn',
        tokenOut: '0xTokenOut',
        amountIn: '1000000', // 1 USDC in raw 6-decimal units
        minAmountOut: '990000000000000000',
        targetPrice: '1000000000000000000',
        direction: 'gte',
      },
    });
    const result = await pc.checkLimitOrder(job);
    // 1_000_000 / 10^6 = 1.0, multiplied by $1 = $1
    expect(result.swapUsd).toBeCloseTo(1, 4);
  });

  it('_estimateUsd correct for 18-decimal token via explicit resolver', async () => {
    const getDecimals = async () => 18;
    const pc = new PriceChecker(mockPriceSource, new Map(), noopLogger, getDecimals);
    pc.updateTokenPrice('0xtokenin', 2000);
    const job = makeLimitOrderJob(); // amountIn = 1e18
    const result = await pc.checkLimitOrder(job);
    expect(result.swapUsd).toBeCloseTo(2000, 0);
  });
});
