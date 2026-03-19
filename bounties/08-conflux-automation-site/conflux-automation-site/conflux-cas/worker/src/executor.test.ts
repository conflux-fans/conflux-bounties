import type { DCAJob, LimitOrderJob } from '@conflux-cas/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Executor, type JobStore, type KeeperClient } from './executor.js';
import type { PriceChecker, PriceCheckResult } from './price-checker.js';
import type { RetryQueue } from './retry-queue.js';
import type { SafetyGuard } from './safety-guard.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeLimitOrderJob(
  overrides: Partial<LimitOrderJob> = {}
): LimitOrderJob {
  return {
    id: 'lo-1',
    owner: '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
    type: 'limit_order',
    status: 'active',
    onChainJobId:
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    createdAt: Date.now() - 5000,
    updatedAt: Date.now(),
    expiresAt: null,
    retries: 0,
    maxRetries: 5,
    lastError: null,
    params: {
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: '1000000000000000000',
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
    onChainJobId:
      '0xdca0000000000000000000000000000000000000000000000000000000000001',
    createdAt: Date.now() - 5000,
    updatedAt: Date.now(),
    expiresAt: null,
    retries: 0,
    maxRetries: 5,
    lastError: null,
    params: {
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountPerSwap: '100000000000000000',
      intervalSeconds: 3600,
      totalSwaps: 5,
      swapsCompleted: 2,
      nextExecution: Date.now() - 1, // already due
    },
    ...overrides,
  };
}

// ─── Mock factories ────────────────────────────────────────────────────────────

function makeJobStore() {
  return {
    getActiveJobs: vi.fn().mockResolvedValue([]),
    markActive: vi.fn().mockResolvedValue(undefined),
    markExecuted: vi.fn().mockResolvedValue(undefined),
    markDCATick: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    incrementRetry: vi.fn().mockResolvedValue(undefined),
    markExpired: vi.fn().mockResolvedValue(undefined),
    markCancelled: vi.fn().mockResolvedValue(undefined),
    updateLastError: vi.fn().mockResolvedValue(undefined),
  };
}

function makeKeeperClient() {
  return {
    executeLimitOrder: vi
      .fn()
      .mockResolvedValue({ txHash: '0xtx', amountOut: '990000000000000000' }),
    executeDCATick: vi
      .fn()
      .mockResolvedValue({ txHash: '0xdcatx', amountOut: '99000000000000000' }),
    getOnChainStatus: vi.fn().mockResolvedValue('executed' as const),
  };
}

function makePriceChecker(conditionMet = true): PriceChecker {
  const result: PriceCheckResult = {
    conditionMet,
    currentPrice: 1000000000000000000n,
    targetPrice: 1000000000000000000n,
    swapUsd: 100,
  };
  return {
    checkLimitOrder: vi.fn().mockResolvedValue(result),
    checkDCA: vi.fn().mockResolvedValue(result),
  } as unknown as PriceChecker;
}

function makeSafetyGuard(ok = true): SafetyGuard {
  return {
    check: vi.fn().mockReturnValue({ ok, violation: ok ? null : 'MaxSwapUsd' }),
  } as unknown as SafetyGuard;
}

function makeRetryQueue() {
  return {
    enqueue: vi.fn(),
    drainDue: vi.fn().mockReturnValue([]),
    remove: vi.fn(),
  };
}

// ─── Helper: build a default Executor with all mocks passing ─────────────────

function makeExecutor(
  options: {
    store?: ReturnType<typeof makeJobStore>;
    keeper?: ReturnType<typeof makeKeeperClient>;
    priceChecker?: PriceChecker;
    safetyGuard?: SafetyGuard;
    retryQueue?: ReturnType<typeof makeRetryQueue>;
    dryRun?: boolean;
  } = {}
) {
  const store = options.store ?? makeJobStore();
  const keeper = options.keeper ?? makeKeeperClient();
  const priceChecker = options.priceChecker ?? makePriceChecker(true);
  const safetyGuard = options.safetyGuard ?? makeSafetyGuard(true);
  const retryQueue = options.retryQueue ?? makeRetryQueue();
  const executor = new Executor(
    priceChecker,
    safetyGuard,
    retryQueue as unknown as RetryQueue,
    keeper as unknown as KeeperClient,
    store as unknown as JobStore,
    { dryRun: options.dryRun ?? false }
  );
  return { executor, store, keeper, priceChecker, safetyGuard, retryQueue };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Executor.processTick', () => {
  afterEach(() => vi.clearAllMocks());

  // ── Expiry ─────────────────────────────────────────────────────────────────

  it('marks expired when expiresAt is in the past', async () => {
    const { executor, store } = makeExecutor();
    const job = makeLimitOrderJob({ expiresAt: Date.now() - 1000 });
    await executor.processTick(job);
    expect(store.markExpired).toHaveBeenCalledWith(job.id);
    expect(store.markExecuted).not.toHaveBeenCalled();
  });

  it('does NOT mark expired when expiresAt is in the future', async () => {
    const { executor, store } = makeExecutor();
    const job = makeLimitOrderJob({ expiresAt: Date.now() + 60_000 });
    await executor.processTick(job);
    expect(store.markExpired).not.toHaveBeenCalled();
  });

  // ── Pending → active transition ────────────────────────────────────────────

  it('calls markActive when job status is pending', async () => {
    const { executor, store } = makeExecutor();
    const job = makeLimitOrderJob({ status: 'pending' });
    await executor.processTick(job);
    expect(store.markActive).toHaveBeenCalledWith(job.id);
  });

  // ── JobNotFound error ──────────────────────────────────────────────────────

  it('calls markCancelled (not incrementRetry) when keeper throws JobNotFound', async () => {
    const keeper = makeKeeperClient();
    keeper.executeLimitOrder.mockRejectedValue(new Error('JobNotFound'));
    const { executor, store } = makeExecutor({ keeper });
    const job = makeLimitOrderJob();
    await executor.processTick(job);
    expect(store.markCancelled).toHaveBeenCalledWith(job.id);
    expect(store.incrementRetry).not.toHaveBeenCalled();
    expect(store.markFailed).not.toHaveBeenCalled();
  });

  // ── JobNotActive error ─────────────────────────────────────────────────────

  it('calls markExecuted when JobNotActive + on-chain status is executed', async () => {
    const keeper = makeKeeperClient();
    keeper.executeLimitOrder.mockRejectedValue(new Error('JobNotActive'));
    keeper.getOnChainStatus.mockResolvedValue('executed');
    const { executor, store } = makeExecutor({ keeper });
    const job = makeLimitOrderJob();
    await executor.processTick(job);
    expect(store.markExecuted).toHaveBeenCalledWith(job.id, 'chain-sync');
    expect(store.markCancelled).not.toHaveBeenCalled();
  });

  it('calls markCancelled when JobNotActive + on-chain status is cancelled', async () => {
    const keeper = makeKeeperClient();
    keeper.executeLimitOrder.mockRejectedValue(new Error('JobNotActive'));
    keeper.getOnChainStatus.mockResolvedValue('cancelled');
    const { executor, store } = makeExecutor({ keeper });
    const job = makeLimitOrderJob();
    await executor.processTick(job);
    expect(store.markCancelled).toHaveBeenCalledWith(job.id);
    expect(store.markExecuted).not.toHaveBeenCalled();
  });

  it('calls markCancelled when JobNotActive + on-chain status is expired', async () => {
    const keeper = makeKeeperClient();
    keeper.executeLimitOrder.mockRejectedValue(new Error('JobNotActive'));
    keeper.getOnChainStatus.mockResolvedValue('expired');
    const { executor, store } = makeExecutor({ keeper });
    const job = makeLimitOrderJob();
    await executor.processTick(job);
    expect(store.markCancelled).toHaveBeenCalledWith(job.id);
  });

  // ── Transient errors — increment retries, update last error, don't perm-fail until max ──

  it('does NOT increment retries on PriceConditionNotMet (transient — off-chain/on-chain race)', async () => {
    // PriceConditionNotMet is an expected racing condition: off-chain check
    // passed but the block timestamp ticked back before the tx mined.
    // Burning retries would eventually fail a healthy job, so the executor
    // silently skips this tick and re-evaluates on the next poll.
    const keeper = makeKeeperClient();
    keeper.executeLimitOrder.mockRejectedValue(
      new Error('PriceConditionNotMet')
    );
    const { executor, store } = makeExecutor({ keeper });
    const job = makeLimitOrderJob();
    await executor.processTick(job);
    expect(store.markFailed).not.toHaveBeenCalled();
    expect(store.incrementRetry).not.toHaveBeenCalled();
    expect(store.updateLastError).not.toHaveBeenCalled();
  });

  it('does NOT increment retries on DCAIntervalNotReached (transient — interval timing skew)', async () => {
    // DCAIntervalNotReached is a transient timing skew between the DB's
    // nextExecution timestamp and the contract's block timestamp.
    // Burning retries would eventually fail a job that is simply waiting
    // for its next scheduled window, so the executor skips this tick.
    const keeper = makeKeeperClient();
    keeper.executeDCATick.mockRejectedValue(new Error('DCAIntervalNotReached'));
    const { executor, store } = makeExecutor({ keeper });
    const job = makeDCAJob();
    await executor.processTick(job);
    expect(store.markFailed).not.toHaveBeenCalled();
    expect(store.incrementRetry).not.toHaveBeenCalled();
    expect(store.updateLastError).not.toHaveBeenCalled();
  });

  it('increments retries and updates last error on Slippage exceeded', async () => {
    const keeper = makeKeeperClient();
    keeper.executeLimitOrder.mockRejectedValue(new Error('Slippage exceeded'));
    const { executor, store } = makeExecutor({ keeper });
    const job = makeLimitOrderJob();
    await executor.processTick(job);
    expect(store.markFailed).not.toHaveBeenCalled();
    expect(store.incrementRetry).toHaveBeenCalledWith(job.id);
    expect(store.updateLastError).toHaveBeenCalled();
  });

  // ── Condition not met (off-chain price check) ─────────────────────────────

  it('does not call executeLimitOrder when price condition not met', async () => {
    const priceChecker = makePriceChecker(false);
    const keeper = makeKeeperClient();
    const { executor, store } = makeExecutor({ priceChecker, keeper });
    const job = makeLimitOrderJob();
    await executor.processTick(job);
    expect(keeper.executeLimitOrder).not.toHaveBeenCalled();
    expect(store.markExecuted).not.toHaveBeenCalled();
  });

  it('does not call executeDCATick when DCA interval not yet reached (off-chain)', async () => {
    const priceChecker = makePriceChecker(false);
    const keeper = makeKeeperClient();
    const { executor, store } = makeExecutor({ priceChecker, keeper });
    const job = makeDCAJob({
      params: { ...makeDCAJob().params, nextExecution: Date.now() + 60_000 },
    });
    await executor.processTick(job);
    expect(keeper.executeDCATick).not.toHaveBeenCalled();
    expect(store.markDCATick).not.toHaveBeenCalled();
  });

  // ── Safety guard blocked ───────────────────────────────────────────────────

  it('does not call executeLimit Order when safety guard blocks', async () => {
    const safetyGuard = makeSafetyGuard(false);
    const keeper = makeKeeperClient();
    const { executor, store } = makeExecutor({ safetyGuard, keeper });
    const job = makeLimitOrderJob();
    await executor.processTick(job);
    expect(keeper.executeLimitOrder).not.toHaveBeenCalled();
    expect(store.markFailed).not.toHaveBeenCalled();
  });

  // ── Dry-run mode ───────────────────────────────────────────────────────────

  it('does not call executeLimitOrder in dryRun mode', async () => {
    const keeper = makeKeeperClient();
    const { executor, store } = makeExecutor({ keeper, dryRun: true });
    const job = makeLimitOrderJob();
    await executor.processTick(job);
    expect(keeper.executeLimitOrder).not.toHaveBeenCalled();
    expect(store.markExecuted).not.toHaveBeenCalled();
  });

  it('does not call executeDCATick in dryRun mode', async () => {
    const keeper = makeKeeperClient();
    const { executor, store } = makeExecutor({ keeper, dryRun: true });
    const job = makeDCAJob();
    await executor.processTick(job);
    expect(keeper.executeDCATick).not.toHaveBeenCalled();
    expect(store.markDCATick).not.toHaveBeenCalled();
  });

  // ── Successful execution ───────────────────────────────────────────────────

  it('calls markExecuted with txHash on successful limit order', async () => {
    const keeper = makeKeeperClient();
    keeper.executeLimitOrder.mockResolvedValue({
      txHash: '0xdeadbeef',
      amountOut: '950000000000000000',
    });
    const { executor, store } = makeExecutor({ keeper });
    const job = makeLimitOrderJob();
    await executor.processTick(job);
    expect(store.markExecuted).toHaveBeenCalledWith(
      job.id,
      '0xdeadbeef',
      '950000000000000000'
    );
    expect(store.markFailed).not.toHaveBeenCalled();
  });

  it('calls markDCATick with updated swaps and nextExecution on successful DCA tick', async () => {
    const keeper = makeKeeperClient();
    keeper.executeDCATick.mockResolvedValue({
      txHash: '0xcafe',
      amountOut: '98000000000000000',
    });
    const { executor, store } = makeExecutor({ keeper });
    const job = makeDCAJob(); // swapsCompleted = 2
    await executor.processTick(job);
    expect(store.markDCATick).toHaveBeenCalledWith(
      job.id,
      '0xcafe',
      3, // swapsCompleted + 1
      expect.any(Number), // nextExecution
      '98000000000000000'
    );
  });

  it('skips execution when onChainJobId is null', async () => {
    const keeper = makeKeeperClient();
    const { executor, store } = makeExecutor({ keeper });
    const job = makeLimitOrderJob({ onChainJobId: null });
    await executor.processTick(job);
    expect(keeper.executeLimitOrder).not.toHaveBeenCalled();
    expect(store.markExecuted).not.toHaveBeenCalled();
  });

  // ── Unexpected error → incrementRetry + markFailed ────────────────────────

  it('calls incrementRetry and markFailed on unexpected error (retries < maxRetries)', async () => {
    const keeper = makeKeeperClient();
    keeper.executeLimitOrder.mockRejectedValue(new Error('UnexpectedRevert'));
    const retryQueue = makeRetryQueue();
    const { executor, store } = makeExecutor({ keeper, retryQueue });
    const job = makeLimitOrderJob({ retries: 0, maxRetries: 5 });
    await executor.processTick(job);
    expect(store.incrementRetry).toHaveBeenCalledWith(job.id);
    expect(store.markFailed).toHaveBeenCalledWith(job.id, 'UnexpectedRevert');
    expect(retryQueue.enqueue).toHaveBeenCalled();
  });

  it('does NOT call incrementRetry when retries === maxRetries (exhausted)', async () => {
    const keeper = makeKeeperClient();
    keeper.executeLimitOrder.mockRejectedValue(new Error('UnexpectedRevert'));
    const { executor, store } = makeExecutor({ keeper });
    const job = makeLimitOrderJob({ retries: 5, maxRetries: 5 });
    await executor.processTick(job);
    expect(store.incrementRetry).not.toHaveBeenCalled();
    expect(store.markFailed).toHaveBeenCalled();
  });
});

describe('Executor.runAllTicks', () => {
  afterEach(() => vi.clearAllMocks());

  it('processes all active jobs returned by the store', async () => {
    const store = makeJobStore();
    store.getActiveJobs.mockResolvedValue([
      makeLimitOrderJob({ id: 'j1' }),
      makeDCAJob({ id: 'j2' }),
    ]);
    const keeper = makeKeeperClient();
    const retryQueue = makeRetryQueue();
    (retryQueue.drainDue as ReturnType<typeof vi.fn>).mockReturnValue([]);
    const { executor } = makeExecutor({ store, keeper, retryQueue });
    await executor.runAllTicks();
    // Both jobs had conditions met → both executed
    expect(store.markExecuted).toHaveBeenCalledTimes(1); // the limit order
    expect(store.markDCATick).toHaveBeenCalledTimes(1); // the DCA job
  });

  it('also processes jobs from the retry queue', async () => {
    const store = makeJobStore();
    store.getActiveJobs.mockResolvedValue([]);
    const retryJob = makeLimitOrderJob({ id: 'retry-j1', retries: 2 });
    const retryQueue = makeRetryQueue();
    (retryQueue.drainDue as ReturnType<typeof vi.fn>).mockReturnValue([
      retryJob,
    ]);
    const { executor } = makeExecutor({ store, retryQueue });
    await executor.runAllTicks();
    expect(store.markExecuted).toHaveBeenCalledWith(
      retryJob.id,
      '0xtx',
      '990000000000000000'
    );
  });
});
