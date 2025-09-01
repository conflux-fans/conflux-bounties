import { PoolClient } from 'pg';
import type { WebhookDelivery } from '../../types';
import type { IQueuePersistence, QueueMetrics } from './interfaces';
import { DatabaseConnection } from '../../database/connection';

export class QueuePersistence implements IQueuePersistence {
  constructor(private db: DatabaseConnection) {}

  async saveDelivery(delivery: WebhookDelivery): Promise<void> {
    const query = `
      INSERT INTO deliveries (
        id, subscription_id, webhook_id, event_data, payload,
        status, attempts, max_attempts, next_retry, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        attempts = EXCLUDED.attempts,
        next_retry = EXCLUDED.next_retry,
        last_attempt = NOW()
    `;

    const params = [
      delivery.id,
      delivery.subscriptionId,
      delivery.webhookId,
      JSON.stringify(delivery.event),
      JSON.stringify(delivery.payload),
      delivery.status,
      delivery.attempts,
      delivery.maxAttempts,
      delivery.nextRetry || null
    ];

    await this.db.query(query, params);
  }

  async getNextDelivery(): Promise<WebhookDelivery | null> {
    return await this.db.transaction(async (client: PoolClient) => {
      // Get the next delivery that's ready to be processed
      const selectQuery = `
        SELECT id, subscription_id, webhook_id, event_data, payload,
               status, attempts, max_attempts, next_retry, created_at
        FROM deliveries
        WHERE status = 'pending' 
          AND (next_retry IS NULL OR next_retry <= NOW())
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;

      const result = await client.query(selectQuery);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      
      // Mark as processing
      const updateQuery = `
        UPDATE deliveries 
        SET status = 'processing', last_attempt = NOW()
        WHERE id = $1
      `;
      
      await client.query(updateQuery, [row.id]);

      return {
        id: row.id,
        subscriptionId: row.subscription_id,
        webhookId: row.webhook_id,
        event: row.event_data, // JSONB columns are automatically parsed
        payload: row.payload,   // JSONB columns are automatically parsed
        status: 'processing',
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
        nextRetry: row.next_retry
      };
    });
  }

  async updateDeliveryStatus(deliveryId: string, status: string, error?: string): Promise<void> {
    const isCompleted = status === 'completed' || status === 'failed';
    const query = `
      UPDATE deliveries 
      SET status = $2, 
          error_message = $3,
          completed_at = CASE WHEN $4 THEN NOW() ELSE completed_at END,
          last_attempt = NOW()
      WHERE id = $1
    `;

    await this.db.query(query, [deliveryId, status, error || '', isCompleted]);
  }

  async incrementAttempts(deliveryId: string): Promise<void> {
    const query = `
      UPDATE deliveries 
      SET attempts = attempts + 1,
          last_attempt = NOW()
      WHERE id = $1
    `;

    await this.db.query(query, [deliveryId]);
  }

  async updateRetrySchedule(deliveryId: string, nextRetry: Date, attempts: number): Promise<void> {
    const query = `
      UPDATE deliveries 
      SET next_retry = $2, 
          attempts = $3, 
          status = 'pending',
          last_attempt = NOW()
      WHERE id = $1
    `;

    await this.db.query(query, [deliveryId, nextRetry, attempts]);
  }

  async getQueueMetrics(): Promise<QueueMetrics> {
    const query = `
      SELECT 
        status,
        COUNT(*) as count
      FROM deliveries
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY status
    `;

    const result = await this.db.query(query);
    
    const metrics: QueueMetrics = {
      pendingCount: 0,
      processingCount: 0,
      completedCount: 0,
      failedCount: 0
    };

    result.rows.forEach((row: any) => {
      switch (row.status) {
        case 'pending':
          metrics.pendingCount = parseInt(row.count);
          break;
        case 'processing':
          metrics.processingCount = parseInt(row.count);
          break;
        case 'completed':
          metrics.completedCount = parseInt(row.count);
          break;
        case 'failed':
          metrics.failedCount = parseInt(row.count);
          break;
      }
    });

    return metrics;
  }

  async cleanupCompletedDeliveries(olderThan: Date): Promise<number> {
    const query = `
      DELETE FROM deliveries 
      WHERE status IN ('completed', 'failed') 
        AND completed_at < $1
    `;

    const result = await this.db.query(query, [olderThan]);
    return result.rowCount || 0;
  }

  /**
   * Get deliveries that are stuck in processing state for too long
   * These might need to be reset to pending
   */
  async getStuckDeliveries(stuckThreshold: number = 300000): Promise<WebhookDelivery[]> {
    const query = `
      SELECT id, subscription_id, webhook_id, event_data, payload,
             status, attempts, max_attempts, next_retry, created_at
      FROM deliveries
      WHERE status = 'processing' 
        AND last_attempt < NOW() - INTERVAL '${stuckThreshold} milliseconds'
    `;

    const result = await this.db.query(query);
    
    return result.rows.map((row: any) => ({
      id: row.id,
      subscriptionId: row.subscription_id,
      webhookId: row.webhook_id,
      event: row.event_data, // JSONB columns are automatically parsed
      payload: row.payload,   // JSONB columns are automatically parsed
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      nextRetry: row.next_retry
    }));
  }

  /**
   * Reset stuck deliveries back to pending status
   */
  async resetStuckDeliveries(stuckThreshold: number = 300000): Promise<number> {
    const query = `
      UPDATE deliveries 
      SET status = 'pending', next_retry = NOW()
      WHERE status = 'processing' 
        AND last_attempt < NOW() - INTERVAL '${stuckThreshold} milliseconds'
    `;

    const result = await this.db.query(query);
    return result.rowCount || 0;
  }
}