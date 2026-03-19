import { randomUUID } from 'node:crypto';
import type { DCAJob, Job, LimitOrderJob } from '@conflux-cas/shared';
import { and, eq, gte, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { jobs } from '../db/schema.js';

type NewJobInput =
  | {
      type: 'limit_order';
      owner: string;
      params: LimitOrderJob['params'];
      expiresAt?: number;
      maxRetries?: number;
      onChainJobId?: string;
    }
  | {
      type: 'dca';
      owner: string;
      params: DCAJob['params'];
      expiresAt?: number;
      maxRetries?: number;
      onChainJobId?: string;
    };

/**
 * JobService – thin wrapper around the Drizzle ORM for job CRUD.
 */
export class JobService {
  async createJob(input: NewJobInput): Promise<Job> {
    const now = Date.now();
    const id = randomUUID();

    const row = {
      id,
      owner: input.owner.toLowerCase(),
      type: input.type,
      status: 'pending' as const,
      paramsJson: JSON.stringify(input.params),
      onChainJobId: input.onChainJobId ?? null,
      createdAt: now,
      updatedAt: now,
      expiresAt: input.expiresAt ?? null,
      retries: 0,
      maxRetries: input.maxRetries ?? 5,
      lastError: null,
      txHash: null,
    };

    await db.insert(jobs).values(row);
    return this._rowToJob(row);
  }

  async getJob(id: string): Promise<Job | null> {
    const row = await db.query.jobs.findFirst({ where: eq(jobs.id, id) });
    return row ? this._rowToJob(row) : null;
  }

  async getJobsByOwner(owner: string): Promise<Job[]> {
    const rows = await db.query.jobs.findMany({
      where: eq(jobs.owner, owner.toLowerCase()),
      orderBy: (j, { desc }) => [desc(j.createdAt)],
    });
    return rows.map((r) => this._rowToJob(r));
  }

  async getActiveJobs(): Promise<Job[]> {
    const rows = await db.query.jobs.findMany({
      where: eq(jobs.status, 'active'),
    });
    return rows.map((r) => this._rowToJob(r));
  }

  /** Return all jobs across all owners, optionally filtered by status. Admin use only. */
  async getAllJobs(status?: string): Promise<Job[]> {
    const rows = await db.query.jobs.findMany({
      where: status ? eq(jobs.status, status as Job['status']) : undefined,
      orderBy: (j, { desc }) => [desc(j.updatedAt)],
    });
    return rows.map((r) => this._rowToJob(r));
  }

  async cancelJob(
    id: string,
    owner: string
  ): Promise<Job | null | 'forbidden'> {
    // First check if job exists regardless of owner
    const existing = await db.query.jobs.findFirst({ where: eq(jobs.id, id) });
    if (!existing) return null;
    if (existing.owner.toLowerCase() !== owner.toLowerCase())
      return 'forbidden';

    const now = Date.now();
    const updated = await db
      .update(jobs)
      .set({ status: 'cancelled', updatedAt: now })
      // Allow cancelling jobs in any non-terminal state, including 'failed' and
      // 'paused' — they are still ACTIVE on-chain and occupy a job slot.
      .where(
        and(
          eq(jobs.id, id),
          inArray(jobs.status, ['pending', 'active', 'failed', 'paused'])
        )
      )
      .returning();

    return updated[0] ? this._rowToJob(updated[0]) : null;
  }

  async markExecuted(id: string, txHash: string): Promise<void> {
    await db
      .update(jobs)
      .set({ status: 'executed', txHash, updatedAt: Date.now() })
      .where(eq(jobs.id, id));
  }

  async markFailed(id: string, error: string): Promise<void> {
    await db
      .update(jobs)
      .set({ status: 'failed', lastError: error, updatedAt: Date.now() })
      .where(eq(jobs.id, id));
  }

  async incrementRetry(id: string): Promise<void> {
    const job = await db.query.jobs.findFirst({ where: eq(jobs.id, id) });
    if (job) {
      await db
        .update(jobs)
        .set({ retries: job.retries + 1, updatedAt: Date.now() })
        .where(eq(jobs.id, id));
    }
  }

  async activateJob(id: string): Promise<void> {
    await db
      .update(jobs)
      .set({ status: 'active', updatedAt: Date.now() })
      .where(eq(jobs.id, id));
  }

  /**
   * Return all jobs whose updatedAt is >= sinceMs.
   * Used by the SSE poller to detect worker-initiated changes (direct DB writes
   * that bypass the REST API and therefore never call pushJobUpdate).
   */
  async getJobsUpdatedSince(sinceMs: number): Promise<Job[]> {
    const rows = await db.query.jobs.findMany({
      where: gte(jobs.updatedAt, sinceMs),
    });
    return rows.map((r) => this._rowToJob(r));
  }

  private _rowToJob(row: typeof jobs.$inferSelect): Job {
    const params = JSON.parse(row.paramsJson);
    const base = {
      id: row.id,
      owner: row.owner,
      status: row.status,
      onChainJobId: row.onChainJobId ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      expiresAt: row.expiresAt ?? null,
      retries: row.retries,
      maxRetries: row.maxRetries,
      lastError: row.lastError ?? null,
    };

    if (row.type === 'limit_order') {
      return { ...base, type: 'limit_order', params } as LimitOrderJob;
    }
    return { ...base, type: 'dca', params } as DCAJob;
  }
}

export const jobService = new JobService();
