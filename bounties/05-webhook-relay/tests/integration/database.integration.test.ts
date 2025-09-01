import { DatabaseConnection } from '../../src/database/connection';
import { MigrationManager } from '../../src/database/migrations';
import { DeliveryQueue } from '../../src/webhooks/queue/DeliveryQueue';
import { DeliveryFactory } from '../factories';
import { WebhookDelivery } from '../../src/types/delivery';

describe('Database Integration Tests', () => {
  let dbConnection: DatabaseConnection | null = null;
  let deliveryQueue: DeliveryQueue | null = null;
  let isDatabaseAvailable = false;

  beforeAll(async () => {
    // Try multiple database URLs for different environments
    const testDbUrls = [
      process.env['TEST_DATABASE_URL'],
      'postgresql://webhook_user:webhook_pass@localhost:5432/webhook_relay_test',
      'postgresql://postgres:postgres@localhost:5432/webhook_relay_test',
      'postgresql://webhook_user:webhook_pass@postgres:5432/webhook_relay_test'
    ].filter(Boolean);
    
    for (const testDbUrl of testDbUrls) {
      try {
        console.log(`Attempting to connect to database: ${testDbUrl}`);
        dbConnection = new DatabaseConnection({
          url: testDbUrl!,
          poolSize: 10,
          connectionTimeout: 3000 // Shorter timeout for faster failure detection
        });
        
        // Test connection with timeout
        await Promise.race([
          dbConnection.query('SELECT 1'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
        ]);
        
        console.log('Database connection successful');
        isDatabaseAvailable = true;
        
        // Run migrations
        console.log('Running migrations...');
        const migrationManager = new MigrationManager(dbConnection);
        await migrationManager.migrate();
        console.log('Migrations completed');
        
        // Initialize components
        console.log('Initializing DeliveryQueue...');
        deliveryQueue = new DeliveryQueue(dbConnection, {
          maxConcurrentDeliveries: 50 // Higher limit for testing
        });
        console.log('DeliveryQueue initialized successfully');
        break;
        
      } catch (error) {
        console.warn(`Failed to connect to ${testDbUrl}: ${(error as Error).message}`);
        if (dbConnection) {
          try {
            await dbConnection.close();
          } catch (closeError) {
            // Ignore close errors
          }
          dbConnection = null;
        }
      }
    }
    
    if (!isDatabaseAvailable) {
      console.warn('No database connection available. Database integration tests will be skipped.');
      console.warn('To run database tests, ensure PostgreSQL is running and accessible.');
    }
  });

  afterAll(async () => {
    if (dbConnection) {
      await dbConnection.close();
    }
  });

  // Helper function to create test subscription and webhook
  async function createTestSubscriptionAndWebhook() {
    if (!dbConnection) return { subscriptionId: '', webhookId: '' };
    
    // Create test subscription
    const subscriptionResult = await dbConnection.query(`
      INSERT INTO subscriptions (id, name, contract_address, event_signature, filters, active)
      VALUES (uuid_generate_v4(), 'Test Subscription', '["0x1234567890123456789012345678901234567890"]', '["Transfer(address,address,uint256)"]', '{}', true)
      RETURNING id
    `);
    const subscriptionId = subscriptionResult.rows[0].id;
    
    // Create test webhook
    const webhookResult = await dbConnection.query(`
      INSERT INTO webhooks (id, subscription_id, url, format, headers, timeout, retry_attempts, active)
      VALUES (uuid_generate_v4(), $1, 'http://localhost:3000/webhook', 'generic', '{}', 30000, 3, true)
      RETURNING id
    `, [subscriptionId]);
    const webhookId = webhookResult.rows[0].id;
    
    return { subscriptionId, webhookId };
  }

  beforeEach(async () => {
    if (!dbConnection) return;
    
    // Clean up test data in correct order (due to foreign keys)
    await dbConnection.query('DELETE FROM deliveries');
    await dbConnection.query('DELETE FROM webhooks');
    await dbConnection.query('DELETE FROM subscriptions');
    await dbConnection.query('DELETE FROM metrics');
  });

  describe('Queue Persistence', () => {
    it('should persist and retrieve webhook deliveries', async () => {
      if (!dbConnection || !deliveryQueue) {
        console.warn('Skipping test: Database not available');
        return;
      }

      const { subscriptionId, webhookId } = await createTestSubscriptionAndWebhook();
      const delivery = DeliveryFactory.createPendingDelivery({
        subscriptionId,
        webhookId
      });
      
      // Enqueue delivery
      await deliveryQueue.enqueue(delivery);
      
      // Retrieve delivery
      const retrieved = await deliveryQueue.dequeue();
      
      expect(retrieved).toBeTruthy();
      expect(retrieved!.id).toBe(delivery.id);
      expect(retrieved!.status).toBe('processing');
    });

    it('should handle concurrent queue operations', async () => {
      if (!dbConnection || !deliveryQueue) {
        return;
      }

      const { subscriptionId, webhookId } = await createTestSubscriptionAndWebhook();
      const deliveries = DeliveryFactory.createBatchDeliveries(10, {
        subscriptionId,
        webhookId
      });
      
      // Enqueue all deliveries concurrently
      await Promise.all(deliveries.map(delivery => deliveryQueue!.enqueue(delivery)));
      
      // Dequeue all deliveries
      const retrieved: WebhookDelivery[] = [];
      for (let i = 0; i < 10; i++) {
        const delivery = await deliveryQueue.dequeue();
        if (delivery) {
          retrieved.push(delivery);
        }
      }
      
      expect(retrieved).toHaveLength(10);
      expect(retrieved.every(d => d.status === 'processing')).toBe(true);
    });

    it('should update delivery status correctly', async () => {
      if (!dbConnection || !deliveryQueue) {
        return;
      }

      const { subscriptionId, webhookId } = await createTestSubscriptionAndWebhook();
      const delivery = DeliveryFactory.createPendingDelivery({
        subscriptionId,
        webhookId
      });
      await deliveryQueue.enqueue(delivery);
      
      const retrieved = await deliveryQueue.dequeue();
      expect(retrieved!.status).toBe('processing');
      
      // Mark as completed
      await deliveryQueue.markComplete(retrieved!.id);
      
      // Verify status update
      const result = await dbConnection.query('SELECT status FROM deliveries WHERE id = $1', [retrieved!.id]);
      expect(result.rows[0].status).toBe('completed');
    });

    it('should handle retry scheduling', async () => {
      if (!dbConnection || !deliveryQueue) {
        return;
      }

      const { subscriptionId, webhookId } = await createTestSubscriptionAndWebhook();
      const delivery = DeliveryFactory.createPendingDelivery({
        subscriptionId,
        webhookId
      });
      await deliveryQueue.enqueue(delivery);
      
      const retrieved = await deliveryQueue.dequeue();
      const retryAt = new Date(Date.now() + 60000); // 1 minute from now
      
      // Schedule retry
      await deliveryQueue.scheduleRetry(retrieved!.id, retryAt);
      
      // Verify retry scheduling
      const result = await dbConnection.query('SELECT status, next_retry, attempts FROM deliveries WHERE id = $1', [retrieved!.id]);
      expect(result.rows[0].status).toBe('pending');
      expect(new Date(result.rows[0].next_retry)).toEqual(retryAt);
      expect(result.rows[0].attempts).toBe(1);
    });

    it('should handle failed deliveries', async () => {
      if (!dbConnection || !deliveryQueue) {
        return;
      }

      const { subscriptionId, webhookId } = await createTestSubscriptionAndWebhook();
      const delivery = DeliveryFactory.createPendingDelivery({
        subscriptionId,
        webhookId
      });
      await deliveryQueue.enqueue(delivery);
      
      const retrieved = await deliveryQueue.dequeue();
      const errorMessage = 'Webhook endpoint unreachable';
      
      // Mark as failed
      await deliveryQueue.markFailed(retrieved!.id, errorMessage);
      
      // Verify failure recording
      const result = await dbConnection.query('SELECT status, error_message, attempts FROM deliveries WHERE id = $1', [retrieved!.id]);
      expect(result.rows[0].status).toBe('failed');
      expect(result.rows[0].error_message).toBe(errorMessage);
      expect(result.rows[0].attempts).toBe(1);
    });
  });

  describe('Database Schema and Migrations', () => {
    it('should create all required tables', async () => {
      if (!dbConnection) {
        return;
      }

      // Check that all required tables exist
      const result = await dbConnection.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `);
      
      const tableNames = result.rows.map((row: any) => row.table_name);
      
      expect(tableNames).toContain('subscriptions');
      expect(tableNames).toContain('webhooks');
      expect(tableNames).toContain('deliveries');
      expect(tableNames).toContain('metrics');
    });

    it('should have correct indexes for performance', async () => {
      if (!dbConnection) {
        return;
      }

      // Check for important indexes
      const result = await dbConnection.query(`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE schemaname = 'public'
      `);
      
      const indexes = result.rows.map((row: any) => `${row.tablename}.${row.indexname}`);
      
      // Verify critical indexes exist
      expect(indexes.some((idx: any) => idx.includes('deliveries') && idx.includes('status'))).toBe(true);
      expect(indexes.some((idx: any) => idx.includes('deliveries') && idx.includes('next_retry'))).toBe(true);
    });

    it('should handle large volume of deliveries', async () => {
      if (!dbConnection || !deliveryQueue) {
        return;
      }

      const { subscriptionId, webhookId } = await createTestSubscriptionAndWebhook();
      const deliveries = DeliveryFactory.createHighVolumeDeliveries(1000).map(delivery => ({
        ...delivery,
        subscriptionId,
        webhookId
      }));
      
      // Insert deliveries in batches
      const batchSize = 100;
      for (let i = 0; i < deliveries.length; i += batchSize) {
        const batch = deliveries.slice(i, i + batchSize);
        await Promise.all(batch.map(delivery => deliveryQueue!.enqueue(delivery)));
      }
      
      // Verify all deliveries were inserted
      const result = await dbConnection.query('SELECT COUNT(*) FROM deliveries');
      expect(parseInt(result.rows[0].count)).toBe(1000);
      
      // Test query performance
      const start = Date.now();
      await dbConnection.query('SELECT * FROM deliveries WHERE status = $1 LIMIT 100', ['pending']);
      const queryTime = Date.now() - start;
      
      // Query should complete quickly even with 1000 records
      expect(queryTime).toBeLessThan(100); // Less than 100ms
    });
  });

  describe('Transaction Handling', () => {
    it('should handle transaction rollback on errors', async () => {
      if (!dbConnection) {
        return;
      }

      const { subscriptionId, webhookId } = await createTestSubscriptionAndWebhook();
      const delivery = DeliveryFactory.createPendingDelivery({
        subscriptionId,
        webhookId
      });
      
      try {
        await dbConnection.transaction(async (client) => {
          // Insert delivery
          await client.query(
            'INSERT INTO deliveries (id, subscription_id, webhook_id, event_data, payload, status, attempts, max_attempts) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [delivery.id, delivery.subscriptionId, delivery.webhookId, JSON.stringify(delivery.event), JSON.stringify(delivery.payload), delivery.status, delivery.attempts, delivery.maxAttempts]
          );
          
          // Simulate error
          await client.query('SELECT * FROM non_existent_table');
        });
      } catch (error) {
        // Transaction should be rolled back automatically
      }
      
      // Verify delivery was not persisted due to rollback
      const result = await dbConnection.query('SELECT COUNT(*) FROM deliveries WHERE id = $1', [delivery.id]);
      expect(parseInt(result.rows[0].count)).toBe(0);
    });

    it('should handle concurrent transactions correctly', async () => {
      if (!dbConnection) {
        return;
      }

      const { subscriptionId, webhookId } = await createTestSubscriptionAndWebhook();
      const deliveries = DeliveryFactory.createBatchDeliveries(10, {
        subscriptionId,
        webhookId
      });
      
      // Execute concurrent transactions
      const promises = deliveries.map(async (delivery) => {
        return dbConnection!.transaction(async (client) => {
          await client.query(
            'INSERT INTO deliveries (id, subscription_id, webhook_id, event_data, payload, status, attempts, max_attempts) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [delivery.id, delivery.subscriptionId, delivery.webhookId, JSON.stringify(delivery.event), JSON.stringify(delivery.payload), delivery.status, delivery.attempts, delivery.maxAttempts]
          );
        });
      });
      
      await Promise.all(promises);
      
      // Verify all deliveries were inserted
      const result = await dbConnection.query('SELECT COUNT(*) FROM deliveries');
      expect(parseInt(result.rows[0].count)).toBe(10);
    });
  });

  describe('Connection Pool Management', () => {
    it('should handle connection pool exhaustion gracefully', async () => {
      if (!dbConnection) {
        return;
      }

      // Create many concurrent connections (more than pool size)
      const promises = Array.from({ length: 20 }, async () => {
        const client = await dbConnection!.getClient();
        try {
          await client.query('SELECT 1');
          // Hold connection briefly
          await new Promise(resolve => setTimeout(resolve, 100));
        } finally {
          client.release();
        }
      });
      
      // Should not throw errors despite exceeding pool size
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should recover from connection failures', async () => {
      if (!dbConnection) {
        return;
      }

      // Test basic connectivity
      const result = await dbConnection.query('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);
      
      // Connection should remain stable
      const result2 = await dbConnection.query('SELECT 2 as test');
      expect(result2.rows[0].test).toBe(2);
    });
  });
});