import { DatabaseConnection } from '../../database/connection';
import { WebhookDelivery } from '../../types';
import { Logger } from '../../monitoring/Logger';

export interface DeadLetterQueueOptions {
  maxRetentionDays: number;
  cleanupInterval: number;
}

export interface DeadLetterEntry {
  id: string;
  originalDelivery: WebhookDelivery;
  failureReason: string;
  failedAt: Date;
  attempts: number;
  lastError: string;
}

/**
 * Dead Letter Queue for webhook deliveries that have exhausted all retry attempts
 * Provides storage, retrieval, and cleanup of failed deliveries for analysis
 */
export class DeadLetterQueue {
  private readonly db: DatabaseConnection;
  private readonly logger: Logger;
  private readonly options: DeadLetterQueueOptions;
  private cleanupTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    db: DatabaseConnection,
    logger: Logger,
    options: Partial<DeadLetterQueueOptions> = {}
  ) {
    this.db = db;
    this.logger = logger;
    this.options = {
      maxRetentionDays: options.maxRetentionDays || 30,
      cleanupInterval: options.cleanupInterval || 24 * 60 * 60 * 1000 // 24 hours
    };
  }

  /**
   * Add a failed delivery to the dead letter queue
   */
  async addFailedDelivery(
    delivery: WebhookDelivery,
    failureReason: string,
    lastError: string
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO dead_letter_queue (
          id, subscription_id, webhook_id, event_data, payload,
          failure_reason, failed_at, attempts, last_error
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      const values = [
        delivery.id,
        delivery.subscriptionId,
        delivery.webhookId,
        JSON.stringify(delivery.event),
        JSON.stringify(delivery.payload),
        failureReason,
        new Date(),
        delivery.attempts,
        lastError
      ];

      await this.db.query(query, values);

      this.logger.info('Delivery added to dead letter queue', {
        deliveryId: delivery.id,
        subscriptionId: delivery.subscriptionId,
        webhookId: delivery.webhookId,
        attempts: delivery.attempts,
        failureReason
      });

    } catch (error) {
      this.logger.error('Failed to add delivery to dead letter queue', error as Error, {
        deliveryId: delivery.id
      });
      throw error;
    }
  }

  /**
   * Get failed deliveries from the dead letter queue
   */
  async getFailedDeliveries(
    limit: number = 100,
    offset: number = 0
  ): Promise<DeadLetterEntry[]> {
    try {
      const query = `
        SELECT 
          id, subscription_id, webhook_id, event_data, payload,
          failure_reason, failed_at, attempts, last_error
        FROM dead_letter_queue
        ORDER BY failed_at DESC
        LIMIT $1 OFFSET $2
      `;

      const result = await this.db.query(query, [limit, offset]);

      return result.rows.map((row: any) => ({
        id: row.id,
        originalDelivery: {
          id: row.id,
          subscriptionId: row.subscription_id,
          webhookId: row.webhook_id,
          event: JSON.parse(row.event_data),
          payload: JSON.parse(row.payload),
          attempts: row.attempts,
          maxAttempts: 0, // Not relevant for dead letter entries
          status: 'failed' as const
        },
        failureReason: row.failure_reason,
        failedAt: new Date(row.failed_at),
        attempts: row.attempts,
        lastError: row.last_error
      }));

    } catch (error) {
      this.logger.error('Failed to retrieve dead letter queue entries', error as Error);
      throw error;
    }
  }

  /**
   * Get failed deliveries for a specific webhook
   */
  async getFailedDeliveriesForWebhook(
    webhookId: string,
    limit: number = 50
  ): Promise<DeadLetterEntry[]> {
    try {
      const query = `
        SELECT 
          id, subscription_id, webhook_id, event_data, payload,
          failure_reason, failed_at, attempts, last_error
        FROM dead_letter_queue
        WHERE webhook_id = $1
        ORDER BY failed_at DESC
        LIMIT $2
      `;

      const result = await this.db.query(query, [webhookId, limit]);

      return result.rows.map((row: any) => ({
        id: row.id,
        originalDelivery: {
          id: row.id,
          subscriptionId: row.subscription_id,
          webhookId: row.webhook_id,
          event: JSON.parse(row.event_data),
          payload: JSON.parse(row.payload),
          attempts: row.attempts,
          maxAttempts: 0,
          status: 'failed' as const
        },
        failureReason: row.failure_reason,
        failedAt: new Date(row.failed_at),
        attempts: row.attempts,
        lastError: row.last_error
      }));

    } catch (error) {
      this.logger.error('Failed to retrieve dead letter queue entries for webhook', error as Error, {
        webhookId
      });
      throw error;
    }
  }

  /**
   * Get statistics about the dead letter queue
   */
  async getStats(): Promise<{
    totalEntries: number;
    entriesLast24h: number;
    entriesLast7d: number;
    topFailureReasons: Array<{ reason: string; count: number }>;
  }> {
    try {
      const totalQuery = 'SELECT COUNT(*) as count FROM dead_letter_queue';
      const totalResult = await this.db.query(totalQuery);

      const last24hQuery = `
        SELECT COUNT(*) as count FROM dead_letter_queue 
        WHERE failed_at > NOW() - INTERVAL '24 hours'
      `;
      const last24hResult = await this.db.query(last24hQuery);

      const last7dQuery = `
        SELECT COUNT(*) as count FROM dead_letter_queue 
        WHERE failed_at > NOW() - INTERVAL '7 days'
      `;
      const last7dResult = await this.db.query(last7dQuery);

      const topReasonsQuery = `
        SELECT failure_reason as reason, COUNT(*) as count
        FROM dead_letter_queue
        GROUP BY failure_reason
        ORDER BY count DESC
        LIMIT 10
      `;
      const topReasonsResult = await this.db.query(topReasonsQuery);

      return {
        totalEntries: parseInt(totalResult.rows[0].count),
        entriesLast24h: parseInt(last24hResult.rows[0].count),
        entriesLast7d: parseInt(last7dResult.rows[0].count),
        topFailureReasons: topReasonsResult.rows.map((row: any) => ({
          reason: row.reason,
          count: parseInt(row.count)
        }))
      };

    } catch (error) {
      this.logger.error('Failed to get dead letter queue statistics', error as Error);
      throw error;
    }
  }

  /**
   * Retry a failed delivery from the dead letter queue
   */
  async retryDelivery(entryId: string): Promise<WebhookDelivery | null> {
    try {
      const query = `
        SELECT 
          id, subscription_id, webhook_id, event_data, payload, attempts
        FROM dead_letter_queue
        WHERE id = $1
      `;

      const result = await this.db.query(query, [entryId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const delivery: WebhookDelivery = {
        id: row.id,
        subscriptionId: row.subscription_id,
        webhookId: row.webhook_id,
        event: JSON.parse(row.event_data),
        payload: JSON.parse(row.payload),
        attempts: 0, // Reset attempts for retry
        maxAttempts: 3, // Default retry attempts
        status: 'pending'
      };

      // Remove from dead letter queue
      await this.removeEntry(entryId);

      this.logger.info('Delivery retrieved from dead letter queue for retry', {
        deliveryId: entryId
      });

      return delivery;

    } catch (error) {
      this.logger.error('Failed to retry delivery from dead letter queue', error as Error, {
        entryId
      });
      throw error;
    }
  }

  /**
   * Remove an entry from the dead letter queue
   */
  async removeEntry(entryId: string): Promise<void> {
    try {
      const query = 'DELETE FROM dead_letter_queue WHERE id = $1';
      await this.db.query(query, [entryId]);

      this.logger.debug('Entry removed from dead letter queue', { entryId });

    } catch (error) {
      this.logger.error('Failed to remove entry from dead letter queue', error as Error, {
        entryId
      });
      throw error;
    }
  }

  /**
   * Start automatic cleanup of old entries
   */
  startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldEntries().catch(error => {
        this.logger.error('Dead letter queue cleanup failed', error as Error);
      });
    }, this.options.cleanupInterval);

    this.logger.info('Dead letter queue cleanup started', {
      maxRetentionDays: this.options.maxRetentionDays,
      cleanupInterval: this.options.cleanupInterval
    });
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
      this.logger.info('Dead letter queue cleanup stopped');
    }
  }

  /**
   * Clean up old entries beyond retention period
   */
  private async cleanupOldEntries(): Promise<void> {
    try {
      const query = `
        DELETE FROM dead_letter_queue 
        WHERE failed_at < NOW() - INTERVAL '${this.options.maxRetentionDays} days'
      `;

      const result = await this.db.query(query);
      const deletedCount = result.rowCount || 0;

      if (deletedCount > 0) {
        this.logger.info('Dead letter queue cleanup completed', {
          deletedEntries: deletedCount,
          retentionDays: this.options.maxRetentionDays
        });
      }

    } catch (error) {
      this.logger.error('Failed to cleanup old dead letter queue entries', error as Error);
      throw error;
    }
  }
}