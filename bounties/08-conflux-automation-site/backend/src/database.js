import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_URL || path.join(__dirname, '../../data/automation.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner TEXT NOT NULL,
    job_type INTEGER NOT NULL,
    token_in TEXT NOT NULL,
    token_out TEXT NOT NULL,
    amount TEXT NOT NULL,
    target_price TEXT NOT NULL,
    max_slippage INTEGER NOT NULL,
    interval INTEGER NOT NULL,
    next_execution INTEGER NOT NULL,
    executions INTEGER DEFAULT 0,
    max_executions INTEGER NOT NULL,
    status INTEGER DEFAULT 0,
    blockchain_job_id INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    tx_hash TEXT,
    amount_in TEXT NOT NULL,
    amount_out TEXT NOT NULL,
    price TEXT NOT NULL,
    success INTEGER NOT NULL,
    error TEXT,
    executed_at INTEGER NOT NULL,
    FOREIGN KEY (job_id) REFERENCES jobs(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    user_address TEXT,
    details TEXT,
    timestamp INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_owner ON jobs(owner);
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_next_execution ON jobs(next_execution);
  CREATE INDEX IF NOT EXISTS idx_executions_job_id ON executions(job_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
`);

// Prepared statements
const statements = {
  // Jobs
  createJob: db.prepare(`
    INSERT INTO jobs (
      owner, job_type, token_in, token_out, amount, target_price,
      max_slippage, interval, next_execution, executions, max_executions,
      status, blockchain_job_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  getJob: db.prepare('SELECT * FROM jobs WHERE id = ?'),
  
  getJobsByOwner: db.prepare('SELECT * FROM jobs WHERE owner = ? ORDER BY created_at DESC'),
  
  getActiveJobs: db.prepare('SELECT * FROM jobs WHERE status = 0 ORDER BY next_execution ASC'),
  
  getJobsForExecution: db.prepare(`
    SELECT * FROM jobs 
    WHERE status = 0 AND next_execution <= ?
    ORDER BY next_execution ASC
  `),
  
  updateJob: db.prepare(`
    UPDATE jobs SET
      next_execution = ?,
      executions = ?,
      status = ?,
      updated_at = ?
    WHERE id = ?
  `),
  
  updateJobStatus: db.prepare(`
    UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?
  `),
  
  deleteJob: db.prepare('DELETE FROM jobs WHERE id = ?'),
  
  // Executions
  createExecution: db.prepare(`
    INSERT INTO executions (
      job_id, tx_hash, amount_in, amount_out, price, success, error, executed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  getExecutionsByJob: db.prepare(`
    SELECT * FROM executions WHERE job_id = ? ORDER BY executed_at DESC
  `),
  
  getExecutionsByOwner: db.prepare(`
    SELECT e.* FROM executions e
    JOIN jobs j ON e.job_id = j.id
    WHERE j.owner = ?
    ORDER BY e.executed_at DESC
    LIMIT ?
  `),
  
  // Audit logs
  createAuditLog: db.prepare(`
    INSERT INTO audit_logs (action, entity_type, entity_id, user_address, details, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  
  getAuditLogs: db.prepare(`
    SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?
  `)
};

export { db, statements };
