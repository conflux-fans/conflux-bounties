-- Database initialization script for Docker deployment
-- This script creates the necessary tables and indexes for the webhook relay system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Event subscriptions configuration
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  contract_address VARCHAR(42) NOT NULL,
  event_signature VARCHAR(200) NOT NULL,
  filters JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Webhook endpoint configurations
CREATE TABLE IF NOT EXISTS webhooks (
  id VARCHAR(100) PRIMARY KEY,
  subscription_id VARCHAR(100) REFERENCES subscriptions(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  format VARCHAR(50) NOT NULL CHECK (format IN ('zapier', 'make', 'n8n', 'generic')),
  headers JSONB DEFAULT '{}',
  timeout INTEGER DEFAULT 30000,
  retry_attempts INTEGER DEFAULT 3,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Webhook delivery queue and history
CREATE TABLE IF NOT EXISTS deliveries (
  id VARCHAR(100) PRIMARY KEY,
  subscription_id VARCHAR(100) REFERENCES subscriptions(id),
  webhook_id VARCHAR(100) REFERENCES webhooks(id),
  event_data JSONB NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_retry TIMESTAMP,
  last_attempt TIMESTAMP,
  response_status INTEGER,
  response_time INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- System metrics and monitoring
CREATE TABLE IF NOT EXISTS metrics (
  id VARCHAR(100) PRIMARY KEY,
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC NOT NULL,
  labels JSONB DEFAULT '{}',
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_contract ON subscriptions(contract_address);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_webhooks_subscription ON webhooks(subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_next_retry ON deliveries(next_retry) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at);
CREATE INDEX IF NOT EXISTS idx_deliveries_webhook ON deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_metrics_name_timestamp ON metrics(metric_name, timestamp);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for subscriptions table
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some example data for testing (optional)
-- This will only run if the subscriptions table is empty
DO $$
