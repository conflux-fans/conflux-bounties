import type { Executor } from './executor.js';
import { logger } from './logger.js';

export interface JobPollerOptions {
  /** Poll interval in milliseconds. Default: 15 000 (15s). */
  intervalMs?: number;
  /** Called after each successful tick (e.g. to update a heartbeat). */
  onTick?: () => void | Promise<void>;
}

/**
 * JobPoller – drives the execution loop. Periodically calls
 * Executor.runAllTicks() and manages the poll timer.
 */
export class JobPoller {
  private executor: Executor;
  private intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  private onTick: (() => void | Promise<void>) | undefined;

  constructor(executor: Executor, options: JobPollerOptions = {}) {
    this.executor = executor;
    this.intervalMs = options.intervalMs ?? 15_000;
    this.onTick = options.onTick;
  }

  start(): void {
    if (this.running) {
      logger.warn('[JobPoller] already running');
      return;
    }
    this.running = true;
    logger.info(`[JobPoller] starting with interval ${this.intervalMs}ms`);
    // Run once immediately, then repeat
    void this._tick();
    this.timer = setInterval(() => void this._tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    logger.info('[JobPoller] stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  private async _tick(): Promise<void> {
    try {
      await this.executor.runAllTicks();
      if (this.onTick) await this.onTick();
    } catch (err: unknown) {
      logger.error(
        { error: String(err) },
        '[JobPoller] unhandled error in tick'
      );
    }
  }
}
