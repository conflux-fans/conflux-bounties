/**
 * Migration 002: Token tables
 * Creates token_transfers, tokens, and token_holders tables.
 */

CREATE TABLE IF NOT EXISTS tokens (
  address      TEXT PRIMARY KEY,
  name         TEXT NOT NULL DEFAULT '',
  symbol       TEXT NOT NULL DEFAULT '',
  decimals     INTEGER NOT NULL DEFAULT 18,
  total_supply NUMERIC
);

CREATE TABLE IF NOT EXISTS token_transfers (
  tx_hash       TEXT NOT NULL,
  log_index     INTEGER NOT NULL,
  token_address TEXT NOT NULL,
  "from"        TEXT NOT NULL,
  "to"          TEXT NOT NULL,
  value         NUMERIC NOT NULL,
  block_number  BIGINT NOT NULL,
  timestamp     BIGINT NOT NULL,
  UNIQUE (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_token_transfers_token ON token_transfers (token_address);
CREATE INDEX IF NOT EXISTS idx_token_transfers_block ON token_transfers (block_number);
CREATE INDEX IF NOT EXISTS idx_token_transfers_from ON token_transfers ("from");
CREATE INDEX IF NOT EXISTS idx_token_transfers_to ON token_transfers ("to");
CREATE INDEX IF NOT EXISTS idx_token_transfers_timestamp ON token_transfers (timestamp);

CREATE TABLE IF NOT EXISTS token_holders (
  token_address  TEXT NOT NULL,
  holder_address TEXT NOT NULL,
  balance        NUMERIC NOT NULL DEFAULT 0,
  last_updated   BIGINT NOT NULL,
  PRIMARY KEY (token_address, holder_address)
);

CREATE INDEX IF NOT EXISTS idx_token_holders_balance ON token_holders (token_address, balance DESC);
