import type { DCAJob, LimitOrderJob } from '@conflux-cas/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SAFETY_CONFIG, SafetyGuard } from './safety-guard.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeLimitOrderJob(
  overrides: Partial<LimitOrderJob> = {}
): LimitOrderJob {
  return {
    id: 'job-1',
    owner: '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
    type: 'limit_order',
    status: 'active',
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
      nextExecution: Date.now() - 1, // already due
    },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SafetyGuard', () => {
  let guard: SafetyGuard;

  beforeEach(() => {
    guard = new SafetyGuard({ maxSwapUsd: 1000 });
  });

  // ── basic pass ──────────────────────────────────────────────────────────────

  it('passes a valid limit-order job within swap USD limit', () => {
    const job = makeLimitOrderJob();
    const result = guard.check(job, { swapUsd: 100 });
    expect(result.ok).toBe(true);
  });

  it('passes a valid DCA job whose interval has passed', () => {
    const job = makeDCAJob();
    const result = guard.check(job, { swapUsd: 50 });
    expect(result.ok).toBe(true);
  });

  // ── global pause ────────────────────────────────────────────────────────────

  it('fails any job when global pause is active', () => {
    guard.pauseAll();
    const job = makeLimitOrderJob();
    const result = guard.check(job, { swapUsd: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violation.rule).toBe('globalPause');
  });

  it('passes job again after resume', () => {
    guard.pauseAll();
    guard.resumeAll();
    const job = makeLimitOrderJob();
    expect(guard.check(job, { swapUsd: 1 }).ok).toBe(true);
  });

  it('isPaused() reflects current state', () => {
    expect(guard.isPaused()).toBe(false);
    guard.pauseAll();
    expect(guard.isPaused()).toBe(true);
    guard.resumeAll();
    expect(guard.isPaused()).toBe(false);
  });

  // ── swap USD cap ─────────────────────────────────────────────────────────────

  it('blocks swap exceeding maxSwapUsd', () => {
    const job = makeLimitOrderJob();
    const result = guard.check(job, { swapUsd: 9_999_999 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violation.rule).toBe('maxSwapUsd');
  });

  it('passes swap exactly at maxSwapUsd', () => {
    const job = makeLimitOrderJob();
    const result = guard.check(job, { swapUsd: 1000 });
    expect(result.ok).toBe(true);
  });

  // ── retry cap ────────────────────────────────────────────────────────────────

  it('blocks job that has exhausted retries', () => {
    const job = makeLimitOrderJob({ retries: 5, maxRetries: 5 });
    const result = guard.check(job, { swapUsd: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violation.rule).toBe('maxRetries');
  });

  it('passes job with one retry remaining', () => {
    const job = makeLimitOrderJob({ retries: 4, maxRetries: 5 });
    const result = guard.check(job, { swapUsd: 1 });
    expect(result.ok).toBe(true);
  });

  // ── DCA interval ─────────────────────────────────────────────────────────────

  it('blocks DCA job whose next execution is in the future', () => {
    const job = makeDCAJob({
      params: { ...makeDCAJob().params, nextExecution: Date.now() + 60_000 },
    });
    const result = guard.check(job, { swapUsd: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.violation.rule).toBe('minExecutionIntervalSeconds');
  });

  // ── job expiry ───────────────────────────────────────────────────────────────

  it('blocks expired job', () => {
    const job = makeLimitOrderJob({ expiresAt: Date.now() - 1 });
    const result = guard.check(job, { swapUsd: 1 });
    expect(result.ok).toBe(false);
  });

  it('passes job with future expiry', () => {
    const job = makeLimitOrderJob({ expiresAt: Date.now() + 1_000_000 });
    const result = guard.check(job, { swapUsd: 1 });
    expect(result.ok).toBe(true);
  });

  // ── inactive status ───────────────────────────────────────────────────────────

  it('blocks cancelled job', () => {
    const job = makeLimitOrderJob({ status: 'cancelled' });
    const result = guard.check(job, { swapUsd: 1 });
    expect(result.ok).toBe(false);
  });

  // ── violations log ────────────────────────────────────────────────────────────

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

  // ── config update ─────────────────────────────────────────────────────────────

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

  // ── DEFAULT_SAFETY_CONFIG ─────────────────────────────────────────────────────

  it('DEFAULT_SAFETY_CONFIG has sensible values', () => {
    expect(DEFAULT_SAFETY_CONFIG.maxSwapUsd).toBeGreaterThan(0);
    expect(DEFAULT_SAFETY_CONFIG.maxSlippageBps).toBeLessThanOrEqual(1000);
    expect(DEFAULT_SAFETY_CONFIG.maxRetries).toBeGreaterThan(0);
    expect(DEFAULT_SAFETY_CONFIG.globalPause).toBe(false);
  });
});
