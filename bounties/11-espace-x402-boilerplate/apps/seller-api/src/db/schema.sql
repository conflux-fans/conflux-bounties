CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  rate_limit INT NOT NULL DEFAULT 60,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  amount TEXT NOT NULL,
  token TEXT NOT NULL,
  nonce TEXT UNIQUE NOT NULL,
  expiry BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payer TEXT,
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id),
  endpoint TEXT NOT NULL,
  invoice_id TEXT REFERENCES invoices(id),
  status_code INT NOT NULL,
  response_time_ms INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS endpoint_pricing (
  endpoint TEXT PRIMARY KEY,
  price TEXT NOT NULL,
  token TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tier TEXT NOT NULL DEFAULT 'premium'
);

CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_address TEXT NOT NULL,
  total_spent TEXT NOT NULL DEFAULT '0',
  spend_cap TEXT NOT NULL,
  daily_budget TEXT NOT NULL,
  daily_spent TEXT NOT NULL DEFAULT '0',
  daily_reset_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for analytics queries (SELECT ... WHERE status = 'paid')
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Audit log for admin operations
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  performed_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent spending controls (admin can pause/resume agents)
CREATE TABLE IF NOT EXISTS agent_controls (
  agent_address TEXT PRIMARY KEY,
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  paused_at TIMESTAMPTZ,
  paused_by TEXT,
  reason TEXT
);

-- Disputes / refund requests (user-facing)
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  requester TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

-- Seed default pricing (USDT0 uses 6 decimals: 1 USDT0 = 1_000_000)
-- Token address '0x00..00' is a placeholder — updated automatically on first
-- API start via USDT0_ADDRESS env var, or manually via PUT /admin/pricing.
INSERT INTO endpoint_pricing (endpoint, price, token, description, tier)
VALUES
  ('/data/instant', '10000', '0x0000000000000000000000000000000000000000', 'Instant lookup (no escrow)', 'premium'),
  ('/data/premium', '100000', '0x0000000000000000000000000000000000000000', 'Premium data feed', 'premium'),
  ('/compute/simulate', '500000', '0x0000000000000000000000000000000000000000', 'Compute simulation', 'premium')
ON CONFLICT (endpoint) DO NOTHING;
