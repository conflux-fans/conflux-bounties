/**
 * Migration 004: API tables
 * Creates api_keys, shared_views, and webhook_subscriptions.
 */

CREATE TABLE IF NOT EXISTS api_keys (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  rate_limit INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shared_views (
  slug       TEXT PRIMARY KEY,
  config     JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shared_views_expires ON shared_views (expires_at);

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url        TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('daily_digest')),
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
