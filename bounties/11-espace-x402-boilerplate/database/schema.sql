-- x402 Fullstack — PostgreSQL 16 Schema
-- Creates all tables needed for payment tracking and API usage.

BEGIN;

-- Payments log: every settled x402 payment
CREATE TABLE IF NOT EXISTS x402_payments (
    id              BIGSERIAL PRIMARY KEY,
    invoice_id      VARCHAR(64) NOT NULL,
    payer_address   VARCHAR(42) NOT NULL DEFAULT '',
    token_address   VARCHAR(42) NOT NULL,
    token_symbol    VARCHAR(16) NOT NULL,
    amount          VARCHAR(78) NOT NULL,
    tx_hash         VARCHAR(66) NOT NULL DEFAULT '',
    network         VARCHAR(20) NOT NULL,              -- CAIP-2: "eip155:71"
    payment_method  VARCHAR(10) NOT NULL CHECK (payment_method IN ('native', 'erc20', 'eip3009')),
    endpoint        VARCHAR(128) NOT NULL DEFAULT '',
    settled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_x402_payments_payer ON x402_payments (payer_address);
CREATE INDEX idx_x402_payments_created ON x402_payments (created_at DESC);
CREATE INDEX idx_x402_payments_tx ON x402_payments (tx_hash);
CREATE INDEX idx_x402_payments_network ON x402_payments (network);
CREATE INDEX idx_x402_payments_invoice ON x402_payments (invoice_id);

-- AI query log: each paid AI API call
CREATE TABLE IF NOT EXISTS x402_ai_queries (
    id              BIGSERIAL PRIMARY KEY,
    payment_id      BIGINT REFERENCES x402_payments(id) ON DELETE SET NULL,
    question        TEXT NOT NULL,
    answer          TEXT NOT NULL,
    model           VARCHAR(64) NOT NULL,
    tokens_used     INTEGER NOT NULL DEFAULT 0,
    latency_ms      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_x402_ai_queries_payment ON x402_ai_queries (payment_id);
CREATE INDEX idx_x402_ai_queries_created ON x402_ai_queries (created_at DESC);

-- Rate limit tracking (per-payer, per-endpoint)
CREATE TABLE IF NOT EXISTS x402_rate_limits (
    id              BIGSERIAL PRIMARY KEY,
    payer           VARCHAR(42) NOT NULL,
    endpoint        VARCHAR(128) NOT NULL,
    window_start    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_count   INTEGER NOT NULL DEFAULT 1,
    UNIQUE (payer, endpoint, window_start)
);

CREATE INDEX idx_x402_rate_limits_payer ON x402_rate_limits (payer, endpoint);

-- Invoice tracking for pending payments
CREATE TABLE IF NOT EXISTS x402_invoices (
    id              BIGSERIAL PRIMARY KEY,
    invoice_id      VARCHAR(64) NOT NULL UNIQUE,
    payer           VARCHAR(42),
    token_symbol    VARCHAR(16) NOT NULL,
    amount          VARCHAR(78) NOT NULL,
    chain_id        INTEGER NOT NULL,
    endpoint        VARCHAR(128) NOT NULL,
    status          VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')),
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_x402_invoices_status ON x402_invoices (status, expires_at);

COMMIT;
