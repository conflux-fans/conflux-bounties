import type { IDeliveryQueue, IRetryScheduler } from './queue/interfaces';
import type { IWebhookSender, IWebhookConfigProvider } from './interfaces';
import type { WebhookDelivery } from '../types';
import { Logger } from '../monitoring/Logger';
import { DeadLetterQueue } from './queue/DeadLetterQueue';
import { RetryScheduler } from './queue/RetryScheduler';
import { MetricsCollector } from '../monitoring/MetricsCollector';

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
  maxConcurrentDeliveries: number;
  rateLimitedCount: number;
  queueBacklogWarnings: number;
}

export interface ProcessorOptions {
  maxConcurrentDeliveries?: number;
  processingInterval?: number;
  webhookConfigProvider: IWebhookConfigProvider;
  deadLetterQueue?: DeadLetterQueue;
  retryScheduler?: IRetryScheduler;
  retryBaseDelay?: number;
  retryMaxDelay?: number;
  queueBacklogThreshold?: number;
  metricsCollector?: MetricsCollector;
}

export class QueueProcessor implements IQueueProcessor {
  private deliveryQueue: IDeliveryQueue;
  private webhookSender: IWebhookSender;
  private logger: Logger;
  private webhookConfigProvider: IWebhookConfigProvider;
  private deadLetterQueue: DeadLetterQueue | undefined;
  private retryScheduler: IRetryScheduler;
  private isProcessing: boolean = false;
  private stats: QueueProcessorStats;
  private options: Omit<Required<ProcessorOptions>, 'deadLetterQueue' | 'retryScheduler' | 'metricsCollector' | 'webhookConfigProvider'>;
  private metricsCollector: MetricsCollector | undefined;
  private activeDeliveries: Set<string> = new Set();
  private lastBacklogWarning: number = 0;
  private readonly BACKLOG_WARNING_INTERVAL = 60000; // 1 minute

  constructor(
    deliveryQueue: IDeliveryQueue,
    webhookSender: IWebhookSender,
    logger: Logger,
    options: ProcessorOptions
  ) {
    this.deliveryQueue = deliveryQueue;
    this.webhookSender = webhookSender;
    this.logger = logger;
    this.webhookConfigProvider = options.webhookConfigProvider;
    this.deadLetterQueue = options.deadLetterQueue;
    this.metricsCollector = options.metricsCollector;

    // Initialize retry scheduler with provided options or defaults
    this.retryScheduler = options.retryScheduler || new RetryScheduler(
      options.retryBaseDelay || 1000,  // 1 second base delay
      options.retryMaxDelay || 300000  // 5 minutes max delay
    );

    this.options = {
      maxConcurrentDeliveries: options.maxConcurrentDeliveries || 10,
      processingInterval: options.processingInterval || 1000,
      retryBaseDelay: options.retryBaseDelay || 1000,
      retryMaxDelay: options.retryMaxDelay || 300000,
      queueBacklogThreshold: options.queueBacklogThreshold || 100
    };

    this.stats = {
      isRunning: false,
      totalProcessed: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      currentQueueSize: 0,
      processingCount: 0,
      maxConcurrentDeliveries: this.options.maxConcurrentDeliveries,
      rateLimitedCount: 0,
      queueBacklogWarnings: 0
    };
  }

  async start(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn('Queue processor is already running');
      return;
    }

    this.logger.info('Starting queue processor', {
      maxConcurrentDeliveries: this.options.maxConcurrentDeliveries,
      processingInterval: this.options.processingInterval,
      queueBacklogThreshold: this.options.queueBacklogThreshold
    });

    try {
      // Load webhook configurations before starting processing
      await this.webhookConfigProvider.loadWebhookConfigs();
      this.logger.info('Webhook configurations loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load webhook configurations during startup', error instanceof Error ? error : new Error(String(error)));
      throw new Error('Cannot start queue processor without webhook configurations');
    }

    this.isProcessing = true;
    this.stats.isRunning = true;

    // Start the queue processing with the webhook delivery handler
    this.deliveryQueue.startProcessing(this.processWebhookDeliveryWithRateLimit.bind(this));

    // Start monitoring queue backlog
    this.startBacklogMonitoring();

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
    this.stats.processingCount = this.activeDeliveries.size;
    this.stats.maxConcurrentDeliveries = this.options.maxConcurrentDeliveries;

    // Record metrics if collector is available
    if (this.metricsCollector) {
      this.metricsCollector.recordGauge('queue_processor_active_deliveries', this.activeDeliveries.size);
      this.metricsCollector.recordGauge('queue_processor_max_concurrent', this.options.maxConcurrentDeliveries);
      this.metricsCollector.recordGauge('queue_processor_queue_size', this.stats.currentQueueSize);
      this.metricsCollector.recordGauge('queue_processor_rate_limited_total', this.stats.rateLimitedCount);
    }

    return { ...this.stats };
  }

  /**
   * Process a webhook delivery with rate limiting controls
   */
  private async processWebhookDeliveryWithRateLimit(delivery: WebhookDelivery): Promise<void> {
    // Check if we have available delivery slots
    if (this.activeDeliveries.size >= this.options.maxConcurrentDeliveries) {
      this.stats.rateLimitedCount++;
      
      if (this.metricsCollector) {
        this.metricsCollector.incrementCounter('queue_processor_rate_limited_total');
      }

      this.logger.debug('Rate limit reached, delivery will be retried later', {
        deliveryId: delivery.id,
        activeDeliveries: this.activeDeliveries.size,
        maxConcurrent: this.options.maxConcurrentDeliveries
      });

      // Throw error to trigger retry mechanism
      throw new Error('Rate limit exceeded - max concurrent deliveries reached');
    }

    // Acquire delivery slot
    this.activeDeliveries.add(delivery.id);

    try {
      await this.processWebhookDelivery(delivery);
    } finally {
      // Always release the delivery slot
      this.activeDeliveries.delete(delivery.id);
    }
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
      const webhookConfig = await this.webhookConfigProvider.getWebhookConfig(delivery.webhookId);

      if (!webhookConfig) {
        const error = new Error(`Webhook configuration not found for ID: ${delivery.webhookId}`);
        
        // Move to dead letter queue immediately for missing config - this is not retryable
        if (this.deadLetterQueue) {
          await this.deadLetterQueue.addFailedDelivery(
            delivery,
            'Webhook configuration not found',
            error.message
          );
          
          this.logger.warn('Delivery moved to dead letter queue - webhook config not found', {
            deliveryId: delivery.id,
            webhookId: delivery.webhookId,
            error: error.message
          });
          
          // Don't throw error to avoid retry - this is a permanent failure
          return;
        }
        
        throw error;
      }

      // Validate webhook configuration
      const validation = this.webhookSender.validateWebhookConfig(webhookConfig);
      if (!validation.isValid) {
        const errorMessage = validation.errors.map(e => e.message).join(', ');
        throw new Error(`Invalid webhook configuration: ${errorMessage}`);
      }

      // Send the webhook with the configuration
      const result = await this.webhookSender.sendWebhook(delivery, webhookConfig);

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

      // Re-throw the error so the DeliveryQueue can handle retry logic with exponential backoff
      throw error;
    } finally {
      this.stats.totalProcessed++;
    }
  }

  /**
   * Get webhook configuration provider (for testing and monitoring)
   */
  getWebhookConfigProvider(): IWebhookConfigProvider {
    return this.webhookConfigProvider;
  }

  /**
   * Refresh webhook configurations from the provider
   */
  async refreshWebhookConfigs(): Promise<void> {
    try {
      await this.webhookConfigProvider.refreshConfigs();
      this.logger.info('Webhook configurations refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh webhook configurations', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
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

  /**
   * Get retry scheduler for testing and configuration
   */
  getRetryScheduler(): IRetryScheduler {
    return this.retryScheduler;
  }

  /**
   * Set custom retry scheduler
   */
  setRetryScheduler(retryScheduler: IRetryScheduler): void {
    this.retryScheduler = retryScheduler;
  }

  /**
   * Start monitoring queue backlog and log warnings when threshold is exceeded
   */
  private startBacklogMonitoring(): void {
    setInterval(async () => {
      if (!this.isProcessing) {
        return;
      }

      try {
        const queueSize = await this.deliveryQueue.getQueueSize();
        const activeCount = this.activeDeliveries.size;
        
        // Check if queue backlog exceeds threshold
        if (queueSize > this.options.queueBacklogThreshold) {
          const now = Date.now();
          
          // Only log warning if enough time has passed since last warning
          if (now - this.lastBacklogWarning > this.BACKLOG_WARNING_INTERVAL) {
            this.stats.queueBacklogWarnings++;
            this.lastBacklogWarning = now;

            this.logger.warn('Queue backlog threshold exceeded', {
              queueSize,
              threshold: this.options.queueBacklogThreshold,
              activeDeliveries: activeCount,
              maxConcurrent: this.options.maxConcurrentDeliveries,
              utilizationPercent: Math.round((activeCount / this.options.maxConcurrentDeliveries) * 100)
            });

            if (this.metricsCollector) {
              this.metricsCollector.incrementCounter('queue_processor_backlog_warnings_total');
              this.metricsCollector.recordGauge('queue_processor_backlog_size', queueSize);
            }
          }
        }

        // Record current metrics
        if (this.metricsCollector) {
          this.metricsCollector.recordGauge('queue_processor_queue_size', queueSize);
          this.metricsCollector.recordGauge('queue_processor_active_deliveries', activeCount);
          
          const utilizationPercent = (activeCount / this.options.maxConcurrentDeliveries) * 100;
          this.metricsCollector.recordGauge('queue_processor_utilization_percent', utilizationPercent);
        }

      } catch (error) {
        this.logger.error('Error monitoring queue backlog', error as Error);
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Get current delivery slot utilization
   */
  getDeliverySlotUtilization(): { active: number; max: number; utilizationPercent: number } {
    const active = this.activeDeliveries.size;
    const max = this.options.maxConcurrentDeliveries;
    const utilizationPercent = Math.round((active / max) * 100);

    return { active, max, utilizationPercent };
  }

  /**
   * Check if delivery slots are available
   */
  hasAvailableDeliverySlots(): boolean {
    return this.activeDeliveries.size < this.options.maxConcurrentDeliveries;
  }

  /**
   * Get active delivery IDs (for debugging/monitoring)
   */
  getActiveDeliveryIds(): string[] {
    return Array.from(this.activeDeliveries);
  }
}