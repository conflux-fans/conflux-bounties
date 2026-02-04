import { sql } from "drizzle-orm";
import { db } from "./client";

/**
 * Creates tables if they don't exist.
 * Uses raw SQL to avoid needing generated migration files.
 */
export async function migrate() {
  console.log("Running database migrations...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      contract_address VARCHAR(42) NOT NULL,
      submitter_address VARCHAR(42) NOT NULL,
      metadata_cid TEXT,
      content_hash VARCHAR(66),
      raw_metadata JSONB NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      tx_hash VARCHAR(66),
      rejection_reason TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_submissions_contract ON submissions (contract_address)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions (status)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_submissions_submitter ON submissions (submitter_address)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS moderation_logs (
      id SERIAL PRIMARY KEY,
      submission_id INTEGER NOT NULL REFERENCES submissions(id),
      action VARCHAR(20) NOT NULL,
      moderator_address VARCHAR(42) NOT NULL,
      reason TEXT,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ipfs_pins (
      id SERIAL PRIMARY KEY,
      cid TEXT NOT NULL,
      submission_id INTEGER NOT NULL REFERENCES submissions(id),
      provider VARCHAR(20) NOT NULL DEFAULT 'pinata',
      pin_status VARCHAR(20) NOT NULL DEFAULT 'queued',
      size_bytes BIGINT,
      last_verified TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ipfs_pins_cid ON ipfs_pins (cid)
  `);

  console.log("Database migrations complete.");
}
