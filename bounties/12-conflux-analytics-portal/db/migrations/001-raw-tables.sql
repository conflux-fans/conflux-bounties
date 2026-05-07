/**
 * Migration 001: Raw tables
 * Creates the core sync_state, blocks, and transactions tables.
 */

CREATE TABLE IF NOT EXISTS sync_state (
  id         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_block BIGINT NOT NULL DEFAULT 0,
  last_block_hash TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sync_state (id, last_block, last_block_hash)
VALUES (1, 0, '')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS blocks (
  number          BIGINT PRIMARY KEY,
  hash            TEXT NOT NULL UNIQUE,
  parent_hash     TEXT NOT NULL,
  timestamp       BIGINT NOT NULL,
  gas_used        NUMERIC NOT NULL,
  gas_limit       NUMERIC NOT NULL,
  base_fee_per_gas NUMERIC,
  tx_count        INTEGER NOT NULL DEFAULT 0,
  miner           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blocks_timestamp ON blocks (timestamp);

CREATE TABLE IF NOT EXISTS transactions (
  hash                   TEXT PRIMARY KEY,
  block_number           BIGINT NOT NULL REFERENCES blocks(number) ON DELETE CASCADE,
  "from"                 TEXT NOT NULL,
  "to"                   TEXT,
  value                  NUMERIC NOT NULL,
  gas_used               NUMERIC NOT NULL,
  gas_price              NUMERIC NOT NULL,
  max_fee_per_gas        NUMERIC,
  max_priority_fee_per_gas NUMERIC,
  status                 TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  timestamp              BIGINT NOT NULL,
  input                  TEXT NOT NULL DEFAULT '0x'
);

CREATE INDEX IF NOT EXISTS idx_transactions_block ON transactions (block_number);
CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions ("from");
CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions ("to");
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions (timestamp);
