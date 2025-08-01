import { DatabaseConnection } from './connection';
import { PoolClient } from 'pg';

export interface Migration {
  version: string;
  name: string;
  up: string;
  down: string;
}

export class MigrationManager {
  private db: DatabaseConnection;
  private migrations: Migration[] = [];

  constructor(db: DatabaseConnection) {
    this.db = db;
    this.loadMigrations();
  }

  private loadMigrations(): void {
    // Migration 001: Initial schema
    this.migrations.push({
      version: '001',
      name: 'initial_schema',
      up: `
        -- Create migrations tracking table
        CREATE TABLE IF NOT EXISTS migrations (
          version VARCHAR(10) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          applied_at TIMESTAMP DEFAULT NOW()
        );

        -- Event subscriptions configuration
        CREATE TABLE subscriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(100) NOT NULL,
          contract_address VARCHAR(42) NOT NULL,
          event_signature VARCHAR(200) NOT NULL,
          filters JSONB DEFAULT '{}',
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        -- Webhook endpoint configurations
        CREATE TABLE webhooks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
          url VARCHAR(500) NOT NULL,
          format VARCHAR(50) NOT NULL CHECK (format IN ('zapier', 'make', 'n8n', 'generic')),
          headers JSONB DEFAULT '{}',
          timeout INTEGER DEFAULT 30000,
          retry_attempts INTEGER DEFAULT 3,
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW()
        );

        -- Webhook delivery queue and history
        CREATE TABLE deliveries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          subscription_id UUID REFERENCES subscriptions(id),
          webhook_id UUID REFERENCES webhooks(id),
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
        CREATE TABLE metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          metric_name VARCHAR(100) NOT NULL,
          metric_value NUMERIC NOT NULL,
          labels JSONB DEFAULT '{}',
          timestamp TIMESTAMP DEFAULT NOW()
        );

        -- Indexes for performance
        CREATE INDEX idx_subscriptions_contract ON subscriptions(contract_address);
        CREATE INDEX idx_subscriptions_active ON subscriptions(active);
        CREATE INDEX idx_deliveries_status ON deliveries(status);
        CREATE INDEX idx_deliveries_next_retry ON deliveries(next_retry) WHERE status = 'pending';
        CREATE INDEX idx_deliveries_created_at ON deliveries(created_at);
        CREATE INDEX idx_metrics_name_timestamp ON metrics(metric_name, timestamp);
      `,
      down: `
        DROP TABLE IF EXISTS metrics CASCADE;
        DROP TABLE IF EXISTS deliveries CASCADE;
        DROP TABLE IF EXISTS webhooks CASCADE;
        DROP TABLE IF EXISTS subscriptions CASCADE;
        DROP TABLE IF EXISTS migrations CASCADE;
      `
    });

    // Migration 002: Add dead letter queue
    this.migrations.push({
      version: '002',
      name: 'add_dead_letter_queue',
      up: `
        -- Dead letter queue for failed deliveries
        CREATE TABLE dead_letter_queue (
          id UUID PRIMARY KEY,
          subscription_id UUID,
          webhook_id UUID,
          event_data JSONB NOT NULL,
          payload JSONB NOT NULL,
          failure_reason VARCHAR(500) NOT NULL,
          failed_at TIMESTAMP DEFAULT NOW(),
          attempts INTEGER NOT NULL,
          last_error TEXT
        );

        -- Indexes for dead letter queue
        CREATE INDEX idx_dead_letter_failed_at ON dead_letter_queue(failed_at);
        CREATE INDEX idx_dead_letter_webhook_id ON dead_letter_queue(webhook_id);
        CREATE INDEX idx_dead_letter_failure_reason ON dead_letter_queue(failure_reason);
      `,
      down: `
        DROP TABLE IF EXISTS dead_letter_queue CASCADE;
      `
    });
  }

  async initializeMigrationsTable(): Promise<void> {
    const createMigrationsTable = `
      CREATE TABLE IF NOT EXISTS migrations (
        version VARCHAR(10) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `;
    
    await this.db.query(createMigrationsTable);
  }

  async getAppliedMigrations(): Promise<string[]> {
    try {
      const result = await this.db.query('SELECT version FROM migrations ORDER BY version');
      return result.rows.map((row: any) => row.version);
    } catch (error) {
      // If migrations table doesn't exist, return empty array
      return [];
    }
  }

  async getPendingMigrations(): Promise<Migration[]> {
    const appliedVersions = await this.getAppliedMigrations();
    return this.migrations.filter(migration => !appliedVersions.includes(migration.version));
  }

  async runMigration(migration: Migration, client: PoolClient): Promise<void> {
    try {
      // Execute the migration SQL
      await client.query(migration.up);
      
      // Record the migration as applied
      await client.query(
        'INSERT INTO migrations (version, name) VALUES ($1, $2)',
        [migration.version, migration.name]
      );
      
      console.log(`Migration ${migration.version} (${migration.name}) applied successfully`);
    } catch (error) {
      throw new Error(`Failed to apply migration ${migration.version}: ${error}`);
    }
  }

  async rollbackMigration(migration: Migration, client: PoolClient): Promise<void> {
    try {
      // Execute the rollback SQL
      await client.query(migration.down);
      
      // Remove the migration record
      await client.query('DELETE FROM migrations WHERE version = $1', [migration.version]);
      
      console.log(`Migration ${migration.version} (${migration.name}) rolled back successfully`);
    } catch (error) {
      throw new Error(`Failed to rollback migration ${migration.version}: ${error}`);
    }
  }

  async migrate(): Promise<void> {
    await this.initializeMigrationsTable();
    const pendingMigrations = await this.getPendingMigrations();
    
    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Running ${pendingMigrations.length} pending migrations...`);
    
    for (const migration of pendingMigrations) {
      await this.db.transaction(async (client) => {
        await this.runMigration(migration, client);
      });
    }
    
    console.log('All migrations completed successfully');
  }

  async rollback(targetVersion?: string): Promise<void> {
    const appliedVersions = await this.getAppliedMigrations();
    
    if (appliedVersions.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    // If no target version specified, rollback the last migration
    const versionsToRollback = targetVersion 
      ? appliedVersions.filter(v => v > targetVersion).reverse()
      : [appliedVersions[appliedVersions.length - 1]];

    console.log(`Rolling back ${versionsToRollback.length} migrations...`);
    
    for (const version of versionsToRollback) {
      const migration = this.migrations.find(m => m.version === version);
      if (!migration) {
        throw new Error(`Migration ${version} not found`);
      }
      
      await this.db.transaction(async (client) => {
        await this.rollbackMigration(migration, client);
      });
    }
    
    console.log('Rollback completed successfully');
  }

  async getStatus(): Promise<{ applied: string[], pending: string[] }> {
    const applied = await this.getAppliedMigrations();
    const pending = (await this.getPendingMigrations()).map(m => m.version);
    
    return { applied, pending };
  }
}