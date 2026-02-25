import type { AutomationLogger } from './logger.js';
import { noopLogger } from './logger.js';
import type {
  Job,
  SafetyCheckResult,
  SafetyConfig,
  SafetyViolation,
} from './types.js';

/** Default on-chain safety limits. */
export const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  maxSwapUsd: 10_000,
  maxSlippageBps: 500,
  maxRetries: 5,
  minExecutionIntervalSeconds: 30,
  globalPause: false,
};

/**
 * SafetyGuard – off-chain complement to AutomationManager's on-chain checks.
 *
 * Responsibilities:
 *  1. Validate a job satisfies configured safety bounds before the keeper
 *     submits a transaction.
 *  2. Provide a global pause switch (circuit-breaker).
 *  3. Log every violation for audit purposes.
 *
 * The logger is injected rather than imported — the SDK ships with no logging
 * dependency.  Pass your pino/winston/console instance, or omit for silence.
 */
export class SafetyGuard {
  private config: SafetyConfig;
  private violations: SafetyViolation[] = [];
  private readonly log: AutomationLogger;

  constructor(
    config: Partial<SafetyConfig> = {},
    logger: AutomationLogger = noopLogger
  ) {
    this.config = { ...DEFAULT_SAFETY_CONFIG, ...config };
    this.log = logger;
    this.log.info(
      {
        maxSwapUsd: this.config.maxSwapUsd,
        maxSlippageBps: this.config.maxSlippageBps,
        maxRetries: this.config.maxRetries,
        globalPause: this.config.globalPause,
      },
      '[SafetyGuard] initialized'
    );
  }

  // ─── Core check ───────────────────────────────────────────────────

  /**
   * Run all configured safety checks against a job.
   * Returns `{ ok: true }` if all pass, or `{ ok: false, violation }` on first failure.
   */
  check(
    job: Job,
    context: { swapUsd: number; currentTime?: number }
  ): SafetyCheckResult {
    const now = context.currentTime ?? Date.now();

    // Global pause (circuit-breaker)
    if (this.config.globalPause) {
      return this._fail(
        job.id,
        'globalPause',
        'Global pause is active — all execution halted'
      );
    }

    // Job status guard — only pending and active are executable
    if (job.status !== 'active' && job.status !== 'pending') {
      return this._fail(
        job.id,
        'globalPause',
        `Job ${job.id} cannot be executed (status: ${job.status})`
      );
    }

    // Retry cap
    if (job.retries >= job.maxRetries) {
      return this._fail(
        job.id,
        'maxRetries',
        `Job ${job.id} has exhausted retries (${job.retries}/${job.maxRetries})`
      );
    }

    // Swap USD cap
    if (context.swapUsd > this.config.maxSwapUsd) {
      return this._fail(
        job.id,
        'maxSwapUsd',
        `Swap value $${context.swapUsd.toFixed(2)} exceeds limit $${this.config.maxSwapUsd}`
      );
    }

    // Job expiry
    if (job.expiresAt !== null && now >= job.expiresAt) {
      return this._fail(job.id, 'globalPause', `Job ${job.id} has expired`);
    }

    // DCA interval check
    if (job.type === 'dca') {
      const dcaParams = job.params;
      if (now < dcaParams.nextExecution) {
        const waitSec = Math.ceil((dcaParams.nextExecution - now) / 1000);
        return this._fail(
          job.id,
          'minExecutionIntervalSeconds',
          `DCA interval not yet reached (${waitSec}s remaining)`
        );
      }
    }

    return { ok: true };
  }

  // ─── Config management ────────────────────────────────────────────

  updateConfig(patch: Partial<SafetyConfig>): void {
    this.config = { ...this.config, ...patch };
    this.log.info(patch, '[SafetyGuard] config updated');
  }

  getConfig(): Readonly<SafetyConfig> {
    return { ...this.config };
  }

  pauseAll(): void {
    this.config.globalPause = true;
    this.log.warn('[SafetyGuard] GLOBAL PAUSE ACTIVATED');
  }

  resumeAll(): void {
    this.config.globalPause = false;
    this.log.info('[SafetyGuard] global pause lifted');
  }

  isPaused(): boolean {
    return this.config.globalPause;
  }

  // ─── Audit log ────────────────────────────────────────────────────

  getViolations(): readonly SafetyViolation[] {
    return this.violations;
  }

  clearViolations(): void {
    this.violations = [];
  }

  // ─── Private ──────────────────────────────────────────────────────

  private _fail(
    jobId: string,
    rule: keyof SafetyConfig,
    detail: string
  ): SafetyCheckResult {
    const violation: SafetyViolation = {
      jobId,
      rule,
      detail,
      timestamp: Date.now(),
    };
    this.violations.push(violation);
    this.log.warn({ jobId, detail }, `[SafetyGuard] violation – ${rule}`);
    return { ok: false, violation };
  }
}
