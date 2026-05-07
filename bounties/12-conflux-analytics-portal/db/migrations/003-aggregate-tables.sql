/**
 * Migration 003: Aggregate tables
 * Creates daily_activity, daily_fees, contract_daily_stats,
 * token_daily_stats, and dapp_tags.
 */

CREATE TABLE IF NOT EXISTS daily_activity (
  date            DATE PRIMARY KEY,
  tx_count        INTEGER NOT NULL DEFAULT 0,
  active_accounts INTEGER NOT NULL DEFAULT 0,
  new_contracts   INTEGER NOT NULL DEFAULT 0,
  total_gas_used  NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily_fees (
  date          DATE PRIMARY KEY,
  avg_gas_price NUMERIC NOT NULL DEFAULT 0,
  total_burned  NUMERIC NOT NULL DEFAULT 0,
  total_tips    NUMERIC NOT NULL DEFAULT 0,
  tx_count      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contract_daily_stats (
  contract_address TEXT NOT NULL,
  date             DATE NOT NULL,
  tx_count         INTEGER NOT NULL DEFAULT 0,
  unique_callers   INTEGER NOT NULL DEFAULT 0,
  gas_used         NUMERIC NOT NULL DEFAULT 0,
  PRIMARY KEY (contract_address, date)
);

CREATE INDEX IF NOT EXISTS idx_contract_stats_date ON contract_daily_stats (date);
CREATE INDEX IF NOT EXISTS idx_contract_stats_tx ON contract_daily_stats (tx_count DESC);

CREATE TABLE IF NOT EXISTS token_daily_stats (
  token_address    TEXT NOT NULL,
  date             DATE NOT NULL,
  transfer_count   INTEGER NOT NULL DEFAULT 0,
  unique_senders   INTEGER NOT NULL DEFAULT 0,
  unique_receivers INTEGER NOT NULL DEFAULT 0,
  volume           NUMERIC NOT NULL DEFAULT 0,
  PRIMARY KEY (token_address, date)
);

CREATE INDEX IF NOT EXISTS idx_token_stats_date ON token_daily_stats (date);

CREATE TABLE IF NOT EXISTS dapp_tags (
  contract_address TEXT PRIMARY KEY,
  dapp_name        TEXT NOT NULL,
  category         TEXT NOT NULL,
  logo_url         TEXT
);
