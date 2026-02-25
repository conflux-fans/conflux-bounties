/**
 * DbJobStore — drizzle-backed implementation of the JobStore interface.
 *
 * The worker reads jobs from the same SQLite database as the backend API,
 * enabling the real-time SSE feed to reflect execution state immediately.
 * Both processes must point to DATABASE_PATH; use WAL mode (already set by
 * backend/src/db/client.ts) for safe concurrent reads.
 */

import type { DCAJob, Job, LimitOrderJob } from '@conflux-cas/shared';
import Database from 'better-sqlite3';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { JobStore } from './executor.js';
import { logger } from './logger.js';

// --------------------------------------------------------------------------
// Schema (mirrors backend/src/db/schema.ts)
// --------------------------------------------------------------------------
const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  type: text('type', { enum: ['limit_order', 'dca'] as const }).notNull(),
  status: text('status', {
    enum: [
      'pending',
      'active',
      'executed',
      'cancelled',
      'failed',
      'paused',
    ] as const,
  })
    .notNull()
    .default('pending'),
  paramsJson: text('params_json').notNull(),
  onChainJobId: text('on_chain_job_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  expiresAt: integer('expires_at'),
  retries: integer('retries').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(5),
  lastError: text('last_error'),
  txHash: text('tx_hash'),
});

const executions = sqliteTable('executions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: text('job_id').notNull(),
  txHash: text('tx_hash').notNull(),
  timestamp: integer('timestamp').notNull(),
  amountOut: text('amount_out'),
});

const dbSchema = { jobs, executions };

const _settingsTable = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

type JobRow = typeof jobs.$inferSelect;

function rowToJob(row: JobRow): Job {
  const params = JSON.parse(row.paramsJson) as
    | LimitOrderJob['params']
    | DCAJob['params'];

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
    return {
      ...base,
      type: 'limit_order',
      params: params as LimitOrderJob['params'],
    } as LimitOrderJob;
  }

  return {
    ...base,
    type: 'dca',
    params: params as DCAJob['params'],
  } as DCAJob;
}

// --------------------------------------------------------------------------
// DbJobStore
// --------------------------------------------------------------------------

export class DbJobStore implements JobStore {
  private db;
  private sqlite: InstanceType<typeof Database>;

  constructor(databasePath: string) {
    const sqlite = new Database(databasePath);
    this.sqlite = sqlite;
    sqlite.pragma('journal_mode = WAL');
    // Ensure tables exist (idempotent — mirrors backend/src/db/migrate.ts)
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id          TEXT PRIMARY KEY,
        owner       TEXT NOT NULL,
        type        TEXT NOT NULL CHECK(type IN ('limit_order','dca')),
        status      TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','active','executed','cancelled','failed','paused')),
        params_json TEXT NOT NULL,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL,
        expires_at  INTEGER,
        retries     INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 5,
        last_error  TEXT,
        tx_hash     TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_jobs_owner  ON jobs(owner);
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE TABLE IF NOT EXISTS executions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id     TEXT NOT NULL REFERENCES jobs(id),
        tx_hash    TEXT NOT NULL,
        timestamp  INTEGER NOT NULL,
        amount_out TEXT
      );
      CREATE TABLE IF NOT EXISTS nonces (
        nonce      TEXT PRIMARY KEY,
        address    TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        used       INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS worker_heartbeat (
        id           INTEGER PRIMARY KEY,
        last_seen_at INTEGER NOT NULL,
        worker_pid   INTEGER
      );
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    this.db = drizzle(sqlite, { schema: dbSchema });
    // Add on_chain_job_id column if upgrading from an older schema
    try {
      sqlite.exec(`ALTER TABLE jobs ADD COLUMN on_chain_job_id TEXT`);
    } catch (err: unknown) {
      if (!/duplicate column/i.test(String(err))) throw err;
    }
    logger.info({ databasePath }, '[DbJobStore] connected');
  }

  async getActiveJobs(): Promise<Job[]> {
    const rows = await this.db
      .select()
      .from(jobs)
      .where(inArray(jobs.status, ['pending', 'active']));

    return rows.map(rowToJob);
  }

  async markActive(jobId: string): Promise<void> {
    await this.db
      .update(jobs)
      .set({ status: 'active', updatedAt: Date.now() })
      .where(eq(jobs.id, jobId));
    logger.info({ jobId }, '[DbJobStore] markActive');
  }

  async markExecuted(
    jobId: string,
    txHash: string,
    amountOut?: string | null
  ): Promise<void> {
    const now = Date.now();
    await this.db
      .update(jobs)
      .set({ status: 'executed', txHash, lastError: null, updatedAt: now })
      .where(eq(jobs.id, jobId));

    // Write to executions audit table
    await this.db.insert(executions).values({
      jobId,
      txHash,
      timestamp: now,
      amountOut: amountOut ?? null,
    });

    logger.info({ jobId, txHash }, '[DbJobStore] markExecuted');
  }

  async markDCATick(
    jobId: string,
    txHash: string,
    newSwapsCompleted: number,
    nextExecution: number,
    amountOut?: string | null
  ): Promise<void> {
    const now = Date.now();

    // Fetch current params_json to mutate swapsCompleted + nextExecution
    const [row] = await this.db
      .select({ paramsJson: jobs.paramsJson, type: jobs.type })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (!row) {
      logger.warn({ jobId }, '[DbJobStore] markDCATick: job not found');
      return;
    }

    const params = JSON.parse(row.paramsJson) as DCAJob['params'];
    params.swapsCompleted = newSwapsCompleted;
    params.nextExecution = nextExecution;

    // If all swaps are done, mark the whole job as executed
    const newStatus: typeof jobs.$inferSelect.status =
      newSwapsCompleted >= params.totalSwaps ? 'executed' : 'active';

    await this.db
      .update(jobs)
      .set({
        status: newStatus,
        paramsJson: JSON.stringify(params),
        txHash, // last successful tx
        lastError: null, // clear any previous error on successful tick
        updatedAt: now,
      })
      .where(eq(jobs.id, jobId));

    // Record this individual swap in the executions audit log
    await this.db.insert(executions).values({
      jobId,
      txHash,
      timestamp: now,
      amountOut: amountOut ?? null,
    });

    logger.info(
      {
        jobId,
        txHash,
        swapsCompleted: newSwapsCompleted,
        totalSwaps: params.totalSwaps,
        newStatus,
      },
      '[DbJobStore] markDCATick'
    );
  }

  async markFailed(jobId: string, error: string): Promise<void> {
    await this.db
      .update(jobs)
      .set({ status: 'failed', lastError: error, updatedAt: Date.now() })
      .where(eq(jobs.id, jobId));

    logger.warn({ jobId, error }, '[DbJobStore] markFailed');
  }

  async incrementRetry(jobId: string): Promise<void> {
    const [row] = await this.db
      .select({ retries: jobs.retries })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (!row) return;

    await this.db
      .update(jobs)
      .set({ retries: row.retries + 1, updatedAt: Date.now() })
      .where(eq(jobs.id, jobId));
  }

  async updateHeartbeat(): Promise<void> {
    this.sqlite
      .prepare(
        `INSERT INTO worker_heartbeat (id, last_seen_at, worker_pid)
       VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at, worker_pid = excluded.worker_pid`
      )
      .run(Date.now(), process.pid);
  }

  getPaused(): boolean {
    const row = this.sqlite
      .prepare<[], { value: string }>(
        `SELECT value FROM settings WHERE key = 'paused'`
      )
      .get();
    return row?.value === '1';
  }

  async markExpired(jobId: string): Promise<void> {
    await this.db
      .update(jobs)
      .set({ status: 'failed', lastError: 'expired', updatedAt: Date.now() })
      .where(eq(jobs.id, jobId));

    logger.info({ jobId }, '[DbJobStore] markExpired');
  }

  async markCancelled(jobId: string): Promise<void> {
    await this.db
      .update(jobs)
      .set({ status: 'cancelled', updatedAt: Date.now() })
      .where(eq(jobs.id, jobId));

    logger.info({ jobId }, '[DbJobStore] markCancelled');
  }

  async updateLastError(jobId: string, error: string): Promise<void> {
    await this.db
      .update(jobs)
      .set({ lastError: error, updatedAt: Date.now() })
      .where(eq(jobs.id, jobId));
  }
}
