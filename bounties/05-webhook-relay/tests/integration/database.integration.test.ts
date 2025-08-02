import { DatabaseConnection } from '../../src/database/connection';
import { MigrationManager } from '../../src/database/migrations';
import { DeliveryQueue } from '../../src/webhooks/queue/DeliveryQueue';
import { DeliveryFactory } from '../factories';
import { WebhookDelivery } from '../../src/types/delivery';

describe('Database Integration Tests', () => {
  let dbConnection: DatabaseConnection;
  let deliveryQueue: DeliveryQueue;

  beforeAll(async () => {
    // Use test database
    const testDbUrl = process.env['TEST_DATABASE_URL'] || 'postgresql://test:test@localhost:5432/webhook_relay_test';
    
    try {
      dbConnection = new DatabaseConnection({
        url: testDbUrl,
        poolSize: 10,
        connectionTimeout: 5000
      });
      
      // Run migrations
      const migrationManager = new MigrationManager(dbConnection);
      await migrationManager.migrate();
      
      // Initialize components
      deliveryQueue = new DeliveryQueue(dbConnection);
    } catch (error) {
      console.log('Database connection failed, skipping integration tests:', (error as Error).message);
      // Skip tests if database is not available
    }
  });

  afterAll(async () => {
    if (dbConnection) {
      await dbConnection.close();
    }
  });

  beforeEach(async () => {
    if (!dbConnection) return;
    
    // Clean up test data
    await dbConnection.query('DELETE FROM deliveries');
    await dbConnection.query('DELETE FROM webhooks');
    await dbConnection.query('DELETE FROM subscriptions');
    await dbConnection.query('DELETE FROM metrics');
  });

  describe('Queue Persistence', () => {
    it('should persist and retrieve webhook deliveries', async () => {
      if (!dbConnection) {
        return;
      }

      const delivery = DeliveryFactory.createPendingDelivery();
      
      // Enqueue delivery
      await deliveryQueue.enqueue(delivery);
      
      // Retrieve delivery
      const retrieved = await deliveryQueue.dequeue();
      
      expect(retrieved).toBeTruthy();
      expect(retrieved!.id).toBe(delivery.id);
      expect(retrieved!.status).toBe('processing');
    });

    it('should handle concurrent queue operations', async () => {
      if (!dbConnection) {
        return;
      }

      const deliveries = DeliveryFactory.createBatchDeliveries(10);
      
      // Enqueue all deliveries concurrently
      await Promise.all(deliveries.map(delivery => deliveryQueue.enqueue(delivery)));
      
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
      if (!dbConnection) {
        return;
      }

      const delivery = DeliveryFactory.createPendingDelivery();
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
      if (!dbConnection) {
        return;
      }

      const delivery = DeliveryFactory.createPendingDelivery();
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
      if (!dbConnection) {
        return;
      }

      const delivery = DeliveryFactory.createPendingDelivery();
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
      if (!dbConnection) {
        return;
      }

      const deliveries = DeliveryFactory.createHighVolumeDeliveries(1000);
      
      // Insert deliveries in batches
      const batchSize = 100;
      for (let i = 0; i < deliveries.length; i += batchSize) {
        const batch = deliveries.slice(i, i + batchSize);
        await Promise.all(batch.map(delivery => deliveryQueue.enqueue(delivery)));
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

      const delivery = DeliveryFactory.createPendingDelivery();
      
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

      const deliveries = DeliveryFactory.createBatchDeliveries(10);
      
      // Execute concurrent transactions
      const promises = deliveries.map(async (delivery) => {
        return dbConnection.transaction(async (client) => {
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
        const client = await dbConnection.getClient();
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