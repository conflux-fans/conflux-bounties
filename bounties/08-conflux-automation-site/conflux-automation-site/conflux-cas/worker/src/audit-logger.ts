import type { Job } from '@conflux-cas/shared';
import { logger } from './logger.js';

/**
 * AuditLogger – append-only record of all job lifecycle events.
 * In production this should write to the SQLite DB or a log file.
 * For now, entries are stored in-memory and can be flushed to a file.
 */

export type AuditEventType =
  | 'job_created'
  | 'job_started'
  | 'job_executed'
  | 'job_failed'
  | 'job_cancelled'
  | 'job_expired'
  | 'safety_violation'
  | 'global_pause'
  | 'global_resume'
  | 'keeper_error';

export interface AuditEntry {
  id: string; // uuid-like, generated
  timestamp: number; // unix ms
  eventType: AuditEventType;
  jobId: string | null;
  actor: string; // "system" | keeper address | user address
  detail: string;
  extra?: Record<string, unknown>;
}

export class AuditLogger {
  private entries: AuditEntry[] = [];
  private counter = 0;

  log(
    eventType: AuditEventType,
    jobId: string | null,
    actor: string,
    detail: string,
    extra?: Record<string, unknown>
  ): void {
    const entry: AuditEntry = {
      id: `audit-${Date.now()}-${this.counter++}`,
      timestamp: Date.now(),
      eventType,
      jobId,
      actor,
      detail,
      extra,
    };
    this.entries.push(entry);
    logger.info({ jobId, actor, detail }, `[Audit] ${eventType}`);
  }

  logJob(
    eventType: AuditEventType,
    job: Job,
    actor = 'system',
    detail = ''
  ): void {
    this.log(eventType, job.id, actor, detail || `${eventType} – ${job.type}`, {
      status: job.status,
      retries: job.retries,
    });
  }

  getAll(): readonly AuditEntry[] {
    return this.entries;
  }

  getLast(n: number): readonly AuditEntry[] {
    return this.entries.slice(-n);
  }

  clear(): void {
    this.entries = [];
  }
}
