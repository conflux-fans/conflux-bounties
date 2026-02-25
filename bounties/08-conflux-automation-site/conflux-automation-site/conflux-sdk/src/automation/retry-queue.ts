import type { AutomationLogger } from './logger.js';
import { noopLogger } from './logger.js';
import type { Job } from './types.js';

/**
 * RetryQueue – wraps jobs for retry-with-exponential-backoff scheduling.
 *
 * Backoff formula:
 *   delay = min(base × 2^attempt, maxDelay) × (1 + jitter × rand)
 */
export class RetryQueue {
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly jitter: number;
  private readonly log: AutomationLogger;
  private queue: Map<
    string,
    { job: Job; nextRetryAt: number; attempt: number }
  > = new Map();

  constructor(
    options?: {
      baseDelayMs?: number;
      maxDelayMs?: number;
      jitter?: number;
    },
    logger: AutomationLogger = noopLogger
  ) {
    this.baseDelayMs = options?.baseDelayMs ?? 5_000; // 5 s
    this.maxDelayMs = options?.maxDelayMs ?? 300_000; // 5 min cap
    this.jitter = options?.jitter ?? 0.2; // 20 % jitter
    this.log = logger;
  }

  /** Enqueue a job for retry after a calculated backoff delay. */
  enqueue(job: Job): void {
    const existing = this.queue.get(job.id);
    const attempt = existing ? existing.attempt + 1 : 0;
    const delay = this._backoffDelay(attempt);
    const nextRetryAt = Date.now() + delay;

    this.queue.set(job.id, { job, nextRetryAt, attempt });
    this.log.info(
      `[RetryQueue] job ${job.id} enqueued, attempt=${attempt}, delay=${delay}ms`
    );
  }

  /** Remove a job from the queue (e.g. after success or manual cancel). */
  remove(jobId: string): void {
    this.queue.delete(jobId);
  }

  /** Return all jobs whose retry time has arrived; removes them from the queue. */
  drainDue(now = Date.now()): Job[] {
    const due: Job[] = [];
    for (const [jobId, entry] of this.queue) {
      if (now >= entry.nextRetryAt) {
        due.push(entry.job);
        this.queue.delete(jobId);
      }
    }
    return due;
  }

  size(): number {
    return this.queue.size;
  }

  // ─── Private ──────────────────────────────────────────────────────

  private _backoffDelay(attempt: number): number {
    const exponential = this.baseDelayMs * 2 ** attempt;
    const capped = Math.min(exponential, this.maxDelayMs);
    const withJitter = capped * (1 + this.jitter * Math.random());
    return Math.floor(withJitter);
  }
}
