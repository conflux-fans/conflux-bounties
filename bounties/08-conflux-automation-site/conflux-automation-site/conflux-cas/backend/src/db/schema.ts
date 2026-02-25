import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(), // checksummed EVM address
  type: text('type', { enum: ['limit_order', 'dca'] }).notNull(),
  status: text('status', {
    enum: ['pending', 'active', 'executed', 'cancelled', 'failed', 'paused'],
  })
    .notNull()
    .default('pending'),
  paramsJson: text('params_json').notNull(), // JSON-serialised LimitOrderParams | DCAParams
  onChainJobId: text('on_chain_job_id'), // bytes32 hex from contract JobCreated event (nullable)
  createdAt: integer('created_at').notNull(), // unix ms
  updatedAt: integer('updated_at').notNull(),
  expiresAt: integer('expires_at'), // nullable unix ms
  retries: integer('retries').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(5),
  lastError: text('last_error'),
  txHash: text('tx_hash'), // set on execution
});

// ─── Executions (audit trail) ─────────────────────────────────────────────────

export const executions = sqliteTable('executions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: text('job_id')
    .notNull()
    .references(() => jobs.id),
  txHash: text('tx_hash').notNull(),
  timestamp: integer('timestamp').notNull(), // unix ms
  amountOut: text('amount_out'), // wei string
});

// ─── Worker heartbeat ────────────────────────────────────────────────────────

export const workerHeartbeat = sqliteTable('worker_heartbeat', {
  id: integer('id').primaryKey(), // always 1 (single-row table)
  lastSeenAt: integer('last_seen_at').notNull(), // unix ms
  workerPid: integer('worker_pid'),
});

// ─── Settings (key-value store) ─────────────────────────────────────────────

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// ─── Auth nonces ──────────────────────────────────────────────────────────────

export const nonces = sqliteTable('nonces', {
  nonce: text('nonce').primaryKey(),
  address: text('address').notNull(),
  expiresAt: integer('expires_at').notNull(), // unix ms
  used: integer('used', { mode: 'boolean' }).notNull().default(false),
});
