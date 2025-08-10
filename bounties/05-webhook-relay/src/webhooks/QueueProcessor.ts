import type { IDeliveryQueue } from './queue/interfaces';
import type { IWebhookSender } from './interfaces';
import type { WebhookDelivery, WebhookConfig } from '../types';
import { Logger } from '../monitoring/Logger';
import { DeadLetterQueue } from './queue/DeadLetterQueue';

export interface IQueueProcessor {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  getStats(): Promise<QueueProcessorStats>;
}

export interface QueueProcessorStats {
  isRunning: boolean;
  totalProcessed: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  currentQueueSize: number;
  processingCount: number;
}

export interface ProcessorOptions {
  maxConcurrentDeliveries?: number;
  processingInterval?: number;
  webhookConfigProvider?: (webhookId: string) => Promise<WebhookConfig | null>;
  deadLetterQueue?: DeadLetterQueue;
}

export class QueueProcessor implements IQueueProcessor {
  private deliveryQueue: IDeliveryQueue;
  private webhookSender: IWebhookSender;
  private logger: Logger;
  private deadLetterQueue: DeadLetterQueue | undefined;
  private isProcessing: boolean = false;
  private stats: QueueProcessorStats;
  private options: Omit<Required<ProcessorOptions>, 'deadLetterQueue'>;
  private webhookConfigs: Map<string, WebhookConfig> = new Map();

  constructor(
    deliveryQueue: IDeliveryQueue,
    webhookSender: IWebhookSender,
    logger: Logger,
    options: ProcessorOptions = {}
  ) {
    this.deliveryQueue = deliveryQueue;
    this.webhookSender = webhookSender;
    this.logger = logger;
    this.deadLetterQueue = options.deadLetterQueue;

    this.options = {
      maxConcurrentDeliveries: options.maxConcurrentDeliveries || 10,
      processingInterval: options.processingInterval || 1000,
      webhookConfigProvider: options.webhookConfigProvider || this.defaultWebhookConfigProvider.bind(this)
    };

    this.stats = {
      isRunning: false,
      totalProcessed: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      currentQueueSize: 0,
      processingCount: 0
    };
  }

  async start(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn('Queue processor is already running');
      return;
    }

    this.logger.info('Starting queue processor', {
      maxConcurrentDeliveries: this.options.maxConcurrentDeliveries,
      processingInterval: this.options.processingInterval
    });

    this.isProcessing = true;
    this.stats.isRunning = true;

    // Start the queue processing with the webhook delivery handler
    this.deliveryQueue.startProcessing(this.processWebhookDelivery.bind(this));

    this.logger.info('Queue processor started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isProcessing) {
      this.logger.warn('Queue processor is not running');
      return;
    }

    this.logger.info('Stopping queue processor');

    this.isProcessing = false;
    this.stats.isRunning = false;

    // Stop the queue processing
    this.deliveryQueue.stopProcessing();

    this.logger.info('Queue processor stopped successfully');
  }

  isRunning(): boolean {
    return this.isProcessing;
  }

  async getStats(): Promise<QueueProcessorStats> {
    // Update current queue metrics
    this.stats.currentQueueSize = await this.deliveryQueue.getQueueSize();
    this.stats.processingCount = await this.deliveryQueue.getProcessingCount();

    return { ...this.stats };
  }

  /**
   * Process a webhook delivery from the queue
   */
  private async processWebhookDelivery(delivery: WebhookDelivery): Promise<void> {
    const startTime = Date.now();

    this.logger.debug('Processing webhook delivery', {
      deliveryId: delivery.id,
      webhookId: delivery.webhookId,
      attempt: delivery.attempts + 1,
      maxAttempts: delivery.maxAttempts
    });

    try {
      // Get webhook configuration
      const webhookConfig = await this.options.webhookConfigProvider(delivery.webhookId);

      if (!webhookConfig) {
        throw new Error(`Webhook configuration not found for ID: ${delivery.webhookId}`);
      }

      // Validate webhook configuration
      const validation = this.webhookSender.validateWebhookConfig(webhookConfig);
      if (!validation.isValid) {
        const errorMessage = validation.errors.map(e => e.message).join(', ');
        throw new Error(`Invalid webhook configuration: ${errorMessage}`);
      }

      // Set webhook config for the sender (if it supports it)
      if ('setWebhookConfigForTesting' in this.webhookSender) {
        (this.webhookSender as any).setWebhookConfigForTesting(delivery.webhookId, webhookConfig);
      }

      // Send the webhook
      const result = await this.webhookSender.sendWebhook(delivery);

      if (result.success) {
        this.stats.successfulDeliveries++;
        this.logger.info('Webhook delivery successful', {
          deliveryId: delivery.id,
          webhookId: delivery.webhookId,
          statusCode: result.statusCode,
          responseTime: result.responseTime,
          processingTime: Date.now() - startTime
        });
      } else {
        // If the webhook sender returns success: false, it means the delivery failed
        // but was handled gracefully (e.g., tracked in delivery tracker)
        throw new Error(result.error || 'Webhook delivery failed');
      }

    } catch (error) {
      this.stats.failedDeliveries++;

      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error('Webhook delivery failed', error instanceof Error ? error : undefined, {
        deliveryId: delivery.id,
        webhookId: delivery.webhookId,
        attempt: delivery.attempts + 1,
        maxAttempts: delivery.maxAttempts,
        error: errorMessage,
        processingTime: Date.now() - startTime
      });

      // Re-throw the error so the queue can handle retry logic
      throw error;
    } finally {
      this.stats.totalProcessed++;
    }
  }

  /**
   * Default webhook config provider - looks up from internal map
   */
  private async defaultWebhookConfigProvider(webhookId: string): Promise<WebhookConfig | null> {
    return this.webhookConfigs.get(webhookId) || null;
  }

  /**
   * Set webhook configuration (for testing or manual configuration)
   */
  setWebhookConfig(webhookId: string, config: WebhookConfig): void {
    this.webhookConfigs.set(webhookId, config);
  }

  /**
   * Remove webhook configuration
   */
  removeWebhookConfig(webhookId: string): void {
    this.webhookConfigs.delete(webhookId);
  }

  /**
   * Get webhook configuration
   */
  getWebhookConfig(webhookId: string): WebhookConfig | null {
    return this.webhookConfigs.get(webhookId) || null;
  }

  /**
   * Set custom webhook config provider
   */
  setWebhookConfigProvider(provider: (webhookId: string) => Promise<WebhookConfig | null>): void {
    this.options.webhookConfigProvider = provider;
  }

  /**
   * Handle delivery that has exhausted all retry attempts
   */
  async handleMaxRetriesExceeded(delivery: WebhookDelivery, lastError: string): Promise<void> {
    if (this.deadLetterQueue) {
      try {
        await this.deadLetterQueue.addFailedDelivery(
          delivery,
          'Max retry attempts exceeded',
          lastError
        );

        this.logger.warn('Delivery moved to dead letter queue', {
          deliveryId: delivery.id,
          webhookId: delivery.webhookId,
          attempts: delivery.attempts,
          maxAttempts: delivery.maxAttempts,
          lastError
        });
      } catch (error) {
        this.logger.error('Failed to add delivery to dead letter queue', error as Error, {
          deliveryId: delivery.id,
          webhookId: delivery.webhookId
        });
      }
    } else {
      this.logger.error('Delivery failed permanently - no dead letter queue configured', undefined, {
        deliveryId: delivery.id,
        webhookId: delivery.webhookId,
        attempts: delivery.attempts,
        maxAttempts: delivery.maxAttempts,
        lastError
      });
    }
  }

  /**
   * Get dead letter queue statistics
   */
  async getDeadLetterStats() {
    if (this.deadLetterQueue) {
      return await this.deadLetterQueue.getStats();
    }
    return null;
  }

  /**
   * Retry a delivery from the dead letter queue
   */
  async retryFromDeadLetter(entryId: string): Promise<boolean> {
    if (!this.deadLetterQueue) {
      this.logger.warn('Cannot retry from dead letter queue - not configured');
      return false;
    }

    try {
      const delivery = await this.deadLetterQueue.retryDelivery(entryId);
      if (delivery) {
        await this.deliveryQueue.enqueue(delivery);
        this.logger.info('Delivery requeued from dead letter queue', {
          deliveryId: delivery.id,
          entryId
        });
        return true;
      } else {
        this.logger.warn('Dead letter entry not found', { entryId });
        return false;
      }
    } catch (error) {
      this.logger.error('Failed to retry delivery from dead letter queue', error as Error, {
        entryId
      });
      return false;
    }
  }
}