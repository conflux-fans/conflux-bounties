import type { WebhookDelivery } from '../../types';
import type {
  IDeliveryQueue,
  IRetryScheduler,
  IQueuePersistence,
  QueueProcessorOptions
} from './interfaces';
import { RetryScheduler } from './RetryScheduler';
import { QueuePersistence } from './QueuePersistence';
import { DatabaseConnection } from '../../database/connection';

export class DeliveryQueue implements IDeliveryQueue {
  private retryScheduler: IRetryScheduler;
  private persistence: IQueuePersistence;
  private processingCount: number = 0;
  private isProcessing: boolean = false;
  private processingInterval?: ReturnType<typeof setInterval> | undefined;
  private cleanupInterval?: ReturnType<typeof setInterval> | undefined;
  private options: QueueProcessorOptions;

  constructor(
    db: DatabaseConnection,
    options: Partial<QueueProcessorOptions> = {}
  ) {
    this.options = {
      maxConcurrentDeliveries: 10,
      processingInterval: 1000, // 1 second
      retryBaseDelay: 1000, // 1 second
      maxRetryDelay: 300000, // 5 minutes
      cleanupInterval: 3600000, // 1 hour
      cleanupAge: 24, // 24 hours
      ...options
    };

    this.retryScheduler = new RetryScheduler(
      this.options.retryBaseDelay,
      this.options.maxRetryDelay
    );
    this.persistence = new QueuePersistence(db);
  }

  async enqueue(delivery: WebhookDelivery): Promise<void> {
    // Ensure delivery has required fields
    const queueDelivery: WebhookDelivery = {
      ...delivery,
      status: 'pending',
      attempts: 0
    };

    // Remove nextRetry if it exists to set it as undefined
    delete (queueDelivery as any).nextRetry;

    await this.persistence.saveDelivery(queueDelivery);
  }

  async dequeue(): Promise<WebhookDelivery | null> {
    if (this.processingCount >= this.options.maxConcurrentDeliveries) {
      return null;
    }

    const delivery = await this.persistence.getNextDelivery();
    if (delivery) {
      this.processingCount++;
    }

    return delivery;
  }

  async markComplete(deliveryId: string): Promise<void> {
    await this.persistence.updateDeliveryStatus(deliveryId, 'completed');
    this.processingCount = Math.max(0, this.processingCount - 1);
  }

  async markFailed(deliveryId: string, error: string): Promise<void> {
    await this.persistence.updateDeliveryStatus(deliveryId, 'failed', error);
    this.processingCount = Math.max(0, this.processingCount - 1);
  }

  async scheduleRetry(deliveryId: string, retryAt: Date): Promise<void> {
    // For now, we'll assume the delivery exists and increment attempts
    // In a real implementation, you might want to fetch the current delivery first
    await this.persistence.updateRetrySchedule(deliveryId, retryAt, 1);
    this.processingCount = Math.max(0, this.processingCount - 1);
  }

  async getQueueSize(): Promise<number> {
    const metrics = await this.persistence.getQueueMetrics();
    return metrics.pendingCount;
  }

  async getProcessingCount(): Promise<number> {
    return this.processingCount;
  }

  /**
   * Start the queue processor
   */
  startProcessing(processor: (delivery: WebhookDelivery) => Promise<void>): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    // Start processing interval
    this.processingInterval = setInterval(async () => {
      try {
        await this.processQueue(processor);
      } catch (error) {
        console.error('Queue processing error:', error);
      }
    }, this.options.processingInterval);

    // Start cleanup interval
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.performMaintenance();
      } catch (error) {
        console.error('Queue maintenance error:', error);
      }
    }, this.options.cleanupInterval);
  }

  /**
   * Stop the queue processor
   */
  stopProcessing(): void {
    this.isProcessing = false;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Process deliveries from the queue
   */
  private async processQueue(processor: (delivery: WebhookDelivery) => Promise<void>): Promise<void> {
    while (this.processingCount < this.options.maxConcurrentDeliveries) {
      const delivery = await this.dequeue();
      if (!delivery) {
        break;
      }

      // Process delivery asynchronously
      this.processDelivery(delivery, processor).catch(error => {
        console.error(`Failed to process delivery ${delivery.id}:`, error);
        this.processingCount = Math.max(0, this.processingCount - 1);
      });
    }
  }

  /**
   * Process a single delivery
   */
  private async processDelivery(
    delivery: WebhookDelivery,
    processor: (delivery: WebhookDelivery) => Promise<void>
  ): Promise<void> {
    try {
      await processor(delivery);
      await this.markComplete(delivery.id);
    } catch (error) {
      delivery.attempts++;

      if (this.retryScheduler.shouldRetry(delivery)) {
        const nextRetry = this.retryScheduler.calculateNextRetry(delivery.attempts);
        await this.persistence.updateRetrySchedule(delivery.id, nextRetry, delivery.attempts);
        this.processingCount = Math.max(0, this.processingCount - 1);
      } else {
        await this.markFailed(delivery.id, error instanceof Error ? error.message : String(error));
      }
    }
  }

  /**
   * Perform queue maintenance tasks
   */
  private async performMaintenance(): Promise<void> {
    const cleanupAge = new Date(Date.now() - (this.options.cleanupAge * 60 * 60 * 1000));

    // Clean up old completed deliveries
    const cleanedCount = await this.persistence.cleanupCompletedDeliveries(cleanupAge);
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} old deliveries`);
    }

    // Reset stuck deliveries
    const resetCount = await this.persistence.resetStuckDeliveries(300000); // 5 minutes
    if (resetCount > 0) {
      console.log(`Reset ${resetCount} stuck deliveries`);
      this.processingCount = Math.max(0, this.processingCount - resetCount);
    }
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    const metrics = await this.persistence.getQueueMetrics();
    return {
      ...metrics,
      processingCount: this.processingCount,
      maxConcurrentDeliveries: this.options.maxConcurrentDeliveries
    };
  }

  /**
   * Get retry scheduler for testing
   */
  getRetryScheduler(): IRetryScheduler {
    return this.retryScheduler;
  }
}