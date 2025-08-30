import { QueueProcessor } from '../QueueProcessor';
import { Logger } from '../../monitoring/Logger';
import { DeadLetterQueue } from '../queue/DeadLetterQueue';
import type { WebhookDelivery, WebhookConfig, DeliveryResult } from '../../types';
import type { IDeliveryQueue } from '../queue/interfaces';
import type { IWebhookSender, IWebhookConfigProvider } from '../interfaces';

// Mock dependencies
jest.mock('../../monitoring/Logger');
jest.mock('../queue/DeadLetterQueue');

describe('QueueProcessor', () => {
  let queueProcessor: QueueProcessor;
  let mockDeliveryQueue: jest.Mocked<IDeliveryQueue>;
  let mockWebhookSender: jest.Mocked<IWebhookSender>;
  let mockWebhookConfigProvider: jest.Mocked<IWebhookConfigProvider>;
  let mockLogger: jest.Mocked<Logger>;


  const sampleWebhookConfig: WebhookConfig = {
    id: 'webhook-1',
    url: 'https://example.com/webhook',
    format: 'generic',
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
    retryAttempts: 3
  };

  const sampleDelivery: WebhookDelivery = {
    id: 'delivery-1',
    subscriptionId: 'sub-1',
    webhookId: 'webhook-1',
    event: {
      contractAddress: '0x123',
      eventName: 'Transfer',
      blockNumber: 12345,
      transactionHash: '0xabc',
      logIndex: 0,
      args: { from: '0x456', to: '0x789', value: '1000' },
      timestamp: new Date()
    },
    payload: { test: 'data' },
    attempts: 0,
    maxAttempts: 3,
    status: 'pending'
  };

  beforeEach(() => {
    // Create proper mock objects
    mockDeliveryQueue = {
      enqueue: jest.fn(),
      dequeue: jest.fn(),
      markComplete: jest.fn(),
      markFailed: jest.fn(),
      scheduleRetry: jest.fn(),
      getQueueSize: jest.fn().mockResolvedValue(0),
      getProcessingCount: jest.fn().mockResolvedValue(0),
      startProcessing: jest.fn(),
      stopProcessing: jest.fn(),
      getStats: jest.fn().mockResolvedValue({
        pendingCount: 0,
        processingCount: 0,
        completedCount: 0,
        failedCount: 0,
        maxConcurrentDeliveries: 10
      })
    };

    mockWebhookSender = {
      sendWebhook: jest.fn().mockResolvedValue({
        success: true,
        statusCode: 200,
        responseTime: 100
      } as DeliveryResult),
      validateWebhookConfig: jest.fn().mockReturnValue({
        isValid: true,
        errors: []
      })
    };

    mockWebhookConfigProvider = {
      getWebhookConfig: jest.fn().mockResolvedValue(sampleWebhookConfig),
      loadWebhookConfigs: jest.fn().mockResolvedValue(undefined),
      refreshConfigs: jest.fn().mockResolvedValue(undefined)
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis(),
      setLevel: jest.fn()
    } as unknown as jest.Mocked<Logger>;

    queueProcessor = new QueueProcessor(
      mockDeliveryQueue,
      mockWebhookSender,
      mockLogger,
      {
        webhookConfigProvider: mockWebhookConfigProvider
      }
    );
  });

  afterEach(async () => {
    // Clean up queue processor with timeout
    if (queueProcessor) {
      try {
        await Promise.race([
          queueProcessor.stop(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('QueueProcessor stop timeout')), 3000))
        ]);
      } catch (error) {
        console.warn('Error stopping queue processor:', error);
      }
    }

    // Clean up global resources
    if ((global as any).cleanupGlobalResources) {
      try {
        await (global as any).cleanupGlobalResources();
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('start', () => {
    it('should start the queue processor successfully', async () => {
      await queueProcessor.start();

      expect(mockWebhookConfigProvider.loadWebhookConfigs).toHaveBeenCalled();
      expect(mockDeliveryQueue.startProcessing).toHaveBeenCalledWith(
        expect.any(Function)
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Starting queue processor', {
        maxConcurrentDeliveries: 10,
        processingInterval: 1000,
        queueBacklogThreshold: 100
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Webhook configurations loaded successfully');
      expect(mockLogger.info).toHaveBeenCalledWith('Queue processor started successfully');
      expect(queueProcessor.isRunning()).toBe(true);
    });

    it('should not start if already running', async () => {
      await queueProcessor.start();
      await queueProcessor.start();

      expect(mockDeliveryQueue.startProcessing).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith('Queue processor is already running');
    });

    it('should fail to start if webhook config loading fails', async () => {
      const configError = new Error('Database connection failed');
      mockWebhookConfigProvider.loadWebhookConfigs.mockRejectedValue(configError);

      await expect(queueProcessor.start()).rejects.toThrow('Cannot start queue processor without webhook configurations');

      expect(mockWebhookConfigProvider.loadWebhookConfigs).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to load webhook configurations during startup', configError);
      expect(mockDeliveryQueue.startProcessing).not.toHaveBeenCalled();
      expect(queueProcessor.isRunning()).toBe(false);
    });
  });

  describe('stop', () => {
    it('should stop the queue processor successfully', async () => {
      await queueProcessor.start();
      await queueProcessor.stop();

      expect(mockDeliveryQueue.stopProcessing).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Stopping queue processor');
      expect(mockLogger.info).toHaveBeenCalledWith('Queue processor stopped successfully');
      expect(queueProcessor.isRunning()).toBe(false);
    });

    it('should not stop if not running', async () => {
      await queueProcessor.stop();

      expect(mockDeliveryQueue.stopProcessing).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Queue processor is not running');
    });
  });

  describe('getStats', () => {
    it('should return current statistics', async () => {
      mockDeliveryQueue.getQueueSize.mockResolvedValue(5);
      mockDeliveryQueue.getProcessingCount.mockResolvedValue(2);

      const stats = await queueProcessor.getStats();

      expect(stats).toEqual({
        isRunning: false,
        totalProcessed: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        currentQueueSize: 5,
        processingCount: 0,
        maxConcurrentDeliveries: 10,
        rateLimitedCount: 0,
        queueBacklogWarnings: 0
      });
    });
  });

  describe('webhook delivery processing', () => {
    let deliveryProcessor: (delivery: WebhookDelivery) => Promise<void>;

    beforeEach(async () => {
      await queueProcessor.start();

      // Capture the delivery processor function
      expect(mockDeliveryQueue.startProcessing).toHaveBeenCalled();
      deliveryProcessor = (mockDeliveryQueue.startProcessing as jest.Mock).mock.calls[0][0];
    });

    it('should process webhook delivery successfully', async () => {
      const successResult: DeliveryResult = {
        success: true,
        statusCode: 200,
        responseTime: 150
      };
      mockWebhookSender.sendWebhook.mockResolvedValue(successResult);

      await deliveryProcessor(sampleDelivery);

      expect(mockWebhookSender.validateWebhookConfig).toHaveBeenCalledWith(sampleWebhookConfig);
      expect(mockWebhookSender.sendWebhook).toHaveBeenCalledWith(sampleDelivery, sampleWebhookConfig);
      expect(mockLogger.info).toHaveBeenCalledWith('Webhook delivery successful', {
        deliveryId: 'delivery-1',
        webhookId: 'webhook-1',
        statusCode: 200,
        responseTime: 150,
        processingTime: expect.any(Number)
      });

      const stats = await queueProcessor.getStats();
      expect(stats.successfulDeliveries).toBe(1);
      expect(stats.totalProcessed).toBe(1);
    });

    it('should handle webhook delivery failure', async () => {
      const failureResult: DeliveryResult = {
        success: false,
        responseTime: 100,
        error: 'Connection timeout'
      };
      mockWebhookSender.sendWebhook.mockResolvedValue(failureResult);

      await expect(deliveryProcessor(sampleDelivery)).rejects.toThrow('Connection timeout');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Webhook delivery failed',
        expect.any(Error), // Error object created when result.success is false
        {
          deliveryId: 'delivery-1',
          webhookId: 'webhook-1',
          attempt: 1,
          maxAttempts: 3,
          error: 'Connection timeout',
          processingTime: expect.any(Number)
        }
      );

      const stats = await queueProcessor.getStats();
      expect(stats.failedDeliveries).toBe(1);
      expect(stats.totalProcessed).toBe(1);
    });

    it('should handle missing webhook configuration without dead letter queue', async () => {
      const deliveryWithMissingConfig: WebhookDelivery = {
        ...sampleDelivery,
        webhookId: 'missing-webhook'
      };

      mockWebhookConfigProvider.getWebhookConfig.mockResolvedValue(null);

      await expect(deliveryProcessor(deliveryWithMissingConfig)).rejects.toThrow(
        'Webhook configuration not found for ID: missing-webhook'
      );

      expect(mockWebhookConfigProvider.getWebhookConfig).toHaveBeenCalledWith('missing-webhook');
      expect(mockWebhookSender.sendWebhook).not.toHaveBeenCalled();
    });

    it('should move delivery to dead letter queue when webhook config not found', async () => {
      // Create processor with dead letter queue
      const mockDeadLetterQueue = {
        addFailedDelivery: jest.fn().mockResolvedValue(undefined)
      } as any;

      const processorWithDLQ = new QueueProcessor(
        mockDeliveryQueue,
        mockWebhookSender,
        mockLogger,
        {
          webhookConfigProvider: mockWebhookConfigProvider,
          deadLetterQueue: mockDeadLetterQueue
        }
      );

      await processorWithDLQ.start();
      const dlqDeliveryProcessor = (mockDeliveryQueue.startProcessing as jest.Mock).mock.calls[1][0];

      const deliveryWithMissingConfig: WebhookDelivery = {
        ...sampleDelivery,
        webhookId: 'missing-webhook'
      };

      mockWebhookConfigProvider.getWebhookConfig.mockResolvedValue(null);

      // Should not throw - should handle gracefully by moving to DLQ
      await dlqDeliveryProcessor(deliveryWithMissingConfig);

      expect(mockDeadLetterQueue.addFailedDelivery).toHaveBeenCalledWith(
        deliveryWithMissingConfig,
        'Webhook configuration not found',
        'Webhook configuration not found for ID: missing-webhook'
      );
      expect(mockWebhookSender.sendWebhook).not.toHaveBeenCalled();
    });

    it('should handle invalid webhook configuration', async () => {
      mockWebhookSender.validateWebhookConfig.mockReturnValue({
        isValid: false,
        errors: [
          { field: 'url', message: 'Invalid URL format', value: 'invalid-url' }
        ]
      });

      await expect(deliveryProcessor(sampleDelivery)).rejects.toThrow(
        'Invalid webhook configuration: Invalid URL format'
      );

      expect(mockWebhookSender.sendWebhook).not.toHaveBeenCalled();
    });

    it('should handle webhook sender exceptions', async () => {
      mockWebhookSender.sendWebhook.mockRejectedValue(new Error('Network error'));

      await expect(deliveryProcessor(sampleDelivery)).rejects.toThrow('Network error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Webhook delivery failed',
        expect.any(Error), // Error object for network error
        {
          deliveryId: 'delivery-1',
          webhookId: 'webhook-1',
          attempt: 1,
          maxAttempts: 3,
          error: 'Network error',
          processingTime: expect.any(Number)
        }
      );
    });

    it('should handle webhook delivery failure without error message', async () => {
      const failureResult: DeliveryResult = {
        success: false,
        responseTime: 100
        // No error property
      };
      mockWebhookSender.sendWebhook.mockResolvedValue(failureResult);

      await expect(deliveryProcessor(sampleDelivery)).rejects.toThrow('Webhook delivery failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Webhook delivery failed',
        expect.any(Error),
        {
          deliveryId: 'delivery-1',
          webhookId: 'webhook-1',
          attempt: 1,
          maxAttempts: 3,
          error: 'Webhook delivery failed',
          processingTime: expect.any(Number)
        }
      );
    });

    it('should handle non-Error exceptions during webhook delivery', async () => {
      // Mock webhook sender to throw a non-Error object
      mockWebhookSender.sendWebhook.mockRejectedValue('String error');

      await expect(deliveryProcessor(sampleDelivery)).rejects.toBe('String error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Webhook delivery failed',
        undefined, // Non-Error objects are passed as undefined to logger
        {
          deliveryId: 'delivery-1',
          webhookId: 'webhook-1',
          attempt: 1,
          maxAttempts: 3,
          error: 'String error',
          processingTime: expect.any(Number)
        }
      );
    });
  });

  describe('webhook configuration provider integration', () => {
    it('should get webhook configuration provider', () => {
      const provider = queueProcessor.getWebhookConfigProvider();
      expect(provider).toBe(mockWebhookConfigProvider);
    });

    it('should refresh webhook configurations', async () => {
      await queueProcessor.refreshWebhookConfigs();
      
      expect(mockWebhookConfigProvider.refreshConfigs).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Webhook configurations refreshed successfully');
    });

    it('should handle refresh webhook configurations error', async () => {
      const refreshError = new Error('Refresh failed');
      mockWebhookConfigProvider.refreshConfigs.mockRejectedValue(refreshError);

      await expect(queueProcessor.refreshWebhookConfigs()).rejects.toThrow('Refresh failed');
      
      expect(mockWebhookConfigProvider.refreshConfigs).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to refresh webhook configurations', refreshError);
    });
  });



  describe('constructor options', () => {
    it('should use custom options', () => {
      const customProcessor = new QueueProcessor(
        mockDeliveryQueue,
        mockWebhookSender,
        mockLogger,
        {
          webhookConfigProvider: mockWebhookConfigProvider,
          maxConcurrentDeliveries: 20,
          processingInterval: 2000
        }
      );

      expect(customProcessor).toBeDefined();
    });
  });

  describe('dead letter queue functionality', () => {
    let mockDeadLetterQueue: jest.Mocked<DeadLetterQueue>;
    let queueProcessorWithDLQ: QueueProcessor;

    beforeEach(async () => {
      // Create mock dead letter queue
      mockDeadLetterQueue = {
        addFailedDelivery: jest.fn().mockResolvedValue(undefined),
        getFailedDeliveries: jest.fn(),
        removeFailedDelivery: jest.fn(),
        cleanup: jest.fn(),
        start: jest.fn(),
        stop: jest.fn()
      } as unknown as jest.Mocked<DeadLetterQueue>;

      // Create queue processor with dead letter queue
      queueProcessorWithDLQ = new QueueProcessor(
        mockDeliveryQueue,
        mockWebhookSender,
        mockLogger,
        {
          webhookConfigProvider: mockWebhookConfigProvider,
          deadLetterQueue: mockDeadLetterQueue
        }
      );

      await queueProcessorWithDLQ.start();

      // Verify the processor started
      expect(mockDeliveryQueue.startProcessing).toHaveBeenCalled();
    });

    it('should handle max retries exceeded with dead letter queue', async () => {
      const exhaustedDelivery: WebhookDelivery = {
        ...sampleDelivery,
        attempts: 3,
        maxAttempts: 3
      };

      // Call handleMaxRetriesExceeded directly
      await queueProcessorWithDLQ.handleMaxRetriesExceeded(exhaustedDelivery, 'Connection timeout');

      // Verify dead letter queue was called
      expect(mockDeadLetterQueue.addFailedDelivery).toHaveBeenCalledWith(
        exhaustedDelivery,
        'Max retry attempts exceeded',
        'Connection timeout'
      );

      expect(mockLogger.warn).toHaveBeenCalledWith('Delivery moved to dead letter queue', {
        deliveryId: 'delivery-1',
        webhookId: 'webhook-1',
        attempts: 3,
        maxAttempts: 3,
        lastError: 'Connection timeout'
      });
    });

    it('should handle dead letter queue errors gracefully', async () => {
      const exhaustedDelivery: WebhookDelivery = {
        ...sampleDelivery,
        attempts: 3,
        maxAttempts: 3
      };

      // Mock dead letter queue to fail
      const dlqError = new Error('Dead letter queue storage failed');
      mockDeadLetterQueue.addFailedDelivery.mockRejectedValue(dlqError);

      // Call handleMaxRetriesExceeded directly
      await queueProcessorWithDLQ.handleMaxRetriesExceeded(exhaustedDelivery, 'Connection timeout');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to add delivery to dead letter queue',
        dlqError,
        {
          deliveryId: 'delivery-1',
          webhookId: 'webhook-1'
        }
      );
    });

    it('should handle max retries exceeded without dead letter queue', async () => {
      // Use processor without dead letter queue
      const processorWithoutDLQ = new QueueProcessor(
        mockDeliveryQueue,
        mockWebhookSender,
        mockLogger,
        {
          webhookConfigProvider: mockWebhookConfigProvider
        }
      );

      const exhaustedDelivery: WebhookDelivery = {
        ...sampleDelivery,
        attempts: 3,
        maxAttempts: 3
      };

      // Call handleMaxRetriesExceeded directly
      await processorWithoutDLQ.handleMaxRetriesExceeded(exhaustedDelivery, 'Connection timeout');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Delivery failed permanently - no dead letter queue configured',
        undefined,
        {
          deliveryId: 'delivery-1',
          webhookId: 'webhook-1',
          attempts: 3,
          maxAttempts: 3,
          lastError: 'Connection timeout'
        }
      );
    });

    it('should get dead letter queue statistics when configured', async () => {
      const mockStats = { totalFailed: 5, oldestEntry: new Date() };
      mockDeadLetterQueue.getStats = jest.fn().mockResolvedValue(mockStats);

      const stats = await queueProcessorWithDLQ.getDeadLetterStats();

      expect(stats).toEqual(mockStats);
      expect(mockDeadLetterQueue.getStats).toHaveBeenCalled();
    });

    it('should return null for dead letter queue statistics when not configured', async () => {
      const processorWithoutDLQ = new QueueProcessor(
        mockDeliveryQueue,
        mockWebhookSender,
        mockLogger,
        {
          webhookConfigProvider: mockWebhookConfigProvider
        }
      );

      const stats = await processorWithoutDLQ.getDeadLetterStats();

      expect(stats).toBeNull();
    });

    it('should retry delivery from dead letter queue when configured', async () => {
      const mockDelivery = { ...sampleDelivery };
      mockDeadLetterQueue.retryDelivery = jest.fn().mockResolvedValue(mockDelivery);

      const result = await queueProcessorWithDLQ.retryFromDeadLetter('entry-123');

      expect(result).toBe(true);
      expect(mockDeadLetterQueue.retryDelivery).toHaveBeenCalledWith('entry-123');
      expect(mockDeliveryQueue.enqueue).toHaveBeenCalledWith(mockDelivery);
      expect(mockLogger.info).toHaveBeenCalledWith('Delivery requeued from dead letter queue', {
        deliveryId: 'delivery-1',
        entryId: 'entry-123'
      });
    });

    it('should handle retry from dead letter queue when not configured', async () => {
      const processorWithoutDLQ = new QueueProcessor(
        mockDeliveryQueue,
        mockWebhookSender,
        mockLogger,
        {
          webhookConfigProvider: mockWebhookConfigProvider
        }
      );

      const result = await processorWithoutDLQ.retryFromDeadLetter('entry-123');

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Cannot retry from dead letter queue - not configured');
    });

    it('should handle retry from dead letter queue when entry not found', async () => {
      mockDeadLetterQueue.retryDelivery = jest.fn().mockResolvedValue(null);

      const result = await queueProcessorWithDLQ.retryFromDeadLetter('entry-123');

      expect(result).toBe(false);
      expect(mockDeadLetterQueue.retryDelivery).toHaveBeenCalledWith('entry-123');
      expect(mockLogger.warn).toHaveBeenCalledWith('Dead letter entry not found', {
        entryId: 'entry-123'
      });
    });

    it('should handle retry from dead letter queue errors', async () => {
      const retryError = new Error('Retry operation failed');
      mockDeadLetterQueue.retryDelivery = jest.fn().mockRejectedValue(retryError);

      const result = await queueProcessorWithDLQ.retryFromDeadLetter('entry-123');

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to retry delivery from dead letter queue', retryError, {
        entryId: 'entry-123'
      });
    });
  });

  describe('webhook config provider error scenarios', () => {
    let deliveryProcessor: (delivery: WebhookDelivery) => Promise<void>;

    beforeEach(async () => {
      await queueProcessor.start();
      deliveryProcessor = (mockDeliveryQueue.startProcessing as jest.Mock).mock.calls[0][0];
    });

    it('should handle webhook config provider that returns null', async () => {
      mockWebhookConfigProvider.getWebhookConfig.mockResolvedValue(null);

      await expect(deliveryProcessor(sampleDelivery)).rejects.toThrow(
        'Webhook configuration not found for ID: webhook-1'
      );

      expect(mockWebhookConfigProvider.getWebhookConfig).toHaveBeenCalledWith('webhook-1');
      expect(mockWebhookSender.sendWebhook).not.toHaveBeenCalled();
    });

    it('should handle webhook config provider that throws an error', async () => {
      const providerError = new Error('Config provider database error');
      mockWebhookConfigProvider.getWebhookConfig.mockRejectedValue(providerError);

      await expect(deliveryProcessor(sampleDelivery)).rejects.toThrow('Config provider database error');

      expect(mockWebhookConfigProvider.getWebhookConfig).toHaveBeenCalledWith('webhook-1');
      expect(mockWebhookSender.sendWebhook).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Webhook delivery failed',
        providerError,
        {
          deliveryId: 'delivery-1',
          webhookId: 'webhook-1',
          attempt: 1,
          maxAttempts: 3,
          error: 'Config provider database error',
          processingTime: expect.any(Number)
        }
      );
    });

    it('should handle webhook config provider that returns invalid config', async () => {
      const invalidConfig: WebhookConfig = {
        ...sampleWebhookConfig,
        url: 'invalid-url'
      };

      mockWebhookConfigProvider.getWebhookConfig.mockResolvedValue(invalidConfig);

      mockWebhookSender.validateWebhookConfig.mockReturnValue({
        isValid: false,
        errors: [
          { field: 'url', message: 'Invalid URL format', value: 'invalid-url' }
        ]
      });

      await expect(deliveryProcessor(sampleDelivery)).rejects.toThrow(
        'Invalid webhook configuration: Invalid URL format'
      );

      expect(mockWebhookConfigProvider.getWebhookConfig).toHaveBeenCalledWith('webhook-1');
      expect(mockWebhookSender.validateWebhookConfig).toHaveBeenCalledWith(invalidConfig);
      expect(mockWebhookSender.sendWebhook).not.toHaveBeenCalled();
    });
  });

  describe('retry logic integration', () => {
    it('should have access to retry scheduler with exponential backoff', () => {
      const retryScheduler = queueProcessor.getRetryScheduler();
      
      expect(retryScheduler).toBeDefined();
      
      // Test exponential backoff delays: 1s, 2s, 4s, 8s, etc.
      expect(retryScheduler.getBackoffDelay(0)).toBeGreaterThanOrEqual(1000); // ~1s
      expect(retryScheduler.getBackoffDelay(1)).toBeGreaterThanOrEqual(2000); // ~2s  
      expect(retryScheduler.getBackoffDelay(2)).toBeGreaterThanOrEqual(4000); // ~4s
      expect(retryScheduler.getBackoffDelay(3)).toBeGreaterThanOrEqual(8000); // ~8s
    });

    it('should allow setting custom retry scheduler', () => {
      const customRetryScheduler = {
        calculateNextRetry: jest.fn().mockReturnValue(new Date()),
        shouldRetry: jest.fn().mockReturnValue(true),
        getBackoffDelay: jest.fn().mockReturnValue(5000)
      };

      queueProcessor.setRetryScheduler(customRetryScheduler);
      
      const retrievedScheduler = queueProcessor.getRetryScheduler();
      expect(retrievedScheduler).toBe(customRetryScheduler);
    });

    it('should verify retry scheduler calculates correct exponential delays', () => {
      const retryScheduler = queueProcessor.getRetryScheduler();
      
      // Test that delays follow exponential pattern
      const delay0 = retryScheduler.getBackoffDelay(0);
      const delay1 = retryScheduler.getBackoffDelay(1);
      const delay2 = retryScheduler.getBackoffDelay(2);
      
      // Each delay should be approximately double the previous (allowing for jitter)
      expect(delay1).toBeGreaterThan(delay0 * 1.5); // At least 1.5x due to jitter
      expect(delay2).toBeGreaterThan(delay1 * 1.5); // At least 1.5x due to jitter
    });

    it('should verify shouldRetry logic works correctly', () => {
      const retryScheduler = queueProcessor.getRetryScheduler();
      
      const deliveryWithRetriesLeft: WebhookDelivery = {
        ...sampleDelivery,
        attempts: 1,
        maxAttempts: 3,
        status: 'failed'
      };
      
      const deliveryMaxRetriesReached: WebhookDelivery = {
        ...sampleDelivery,
        attempts: 3,
        maxAttempts: 3,
        status: 'failed'
      };
      
      const completedDelivery: WebhookDelivery = {
        ...sampleDelivery,
        attempts: 1,
        maxAttempts: 3,
        status: 'completed'
      };
      
      expect(retryScheduler.shouldRetry(deliveryWithRetriesLeft)).toBe(true);
      expect(retryScheduler.shouldRetry(deliveryMaxRetriesReached)).toBe(false);
      expect(retryScheduler.shouldRetry(completedDelivery)).toBe(false);
    });
  });

  describe('edge cases and error paths', () => {
    let deliveryProcessor: (delivery: WebhookDelivery) => Promise<void>;

    beforeEach(async () => {
      await queueProcessor.start();
      deliveryProcessor = (mockDeliveryQueue.startProcessing as jest.Mock).mock.calls[0][0];
    });

    it('should handle delivery with missing event data', async () => {
      const deliveryWithoutEvent: WebhookDelivery = {
        ...sampleDelivery,
        event: undefined as any
      };

      mockWebhookSender.sendWebhook.mockResolvedValue({
        success: true,
        statusCode: 200,
        responseTime: 100
      });

      await deliveryProcessor(deliveryWithoutEvent);

      expect(mockWebhookSender.sendWebhook).toHaveBeenCalledWith(deliveryWithoutEvent, sampleWebhookConfig);
      expect(mockLogger.info).toHaveBeenCalledWith('Webhook delivery successful', expect.any(Object));
    });

    it('should handle delivery with zero max attempts', async () => {
      const deliveryWithZeroAttempts: WebhookDelivery = {
        ...sampleDelivery,
        maxAttempts: 0,
        attempts: 0
      };

      mockWebhookSender.sendWebhook.mockResolvedValue({
        success: false,
        responseTime: 100,
        error: 'Test error'
      });

      await expect(deliveryProcessor(deliveryWithZeroAttempts)).rejects.toThrow('Test error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Webhook delivery failed',
        expect.any(Error),
        {
          deliveryId: 'delivery-1',
          webhookId: 'webhook-1',
          attempt: 1,
          maxAttempts: 0,
          error: 'Test error',
          processingTime: expect.any(Number)
        }
      );
    });

    it('should handle webhook sender returning undefined result', async () => {
      mockWebhookSender.sendWebhook.mockResolvedValue(undefined as any);

      await expect(deliveryProcessor(sampleDelivery)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Webhook delivery failed',
        expect.any(Error),
        expect.objectContaining({
          deliveryId: 'delivery-1',
          webhookId: 'webhook-1'
        })
      );
    });

    it('should handle webhook config validation with multiple errors', async () => {
      mockWebhookSender.validateWebhookConfig.mockReturnValue({
        isValid: false,
        errors: [
          { field: 'url', message: 'Invalid URL format', value: 'invalid-url' },
          { field: 'timeout', message: 'Timeout must be positive', value: -1 }
        ]
      });

      await expect(deliveryProcessor(sampleDelivery)).rejects.toThrow(
        'Invalid webhook configuration: Invalid URL format'
      );

      expect(mockWebhookSender.sendWebhook).not.toHaveBeenCalled();
    });
  });

  describe('rate limiting controls', () => {
    let deliveryProcessor: (delivery: WebhookDelivery) => Promise<void>;
    let mockMetricsCollector: any;

    beforeEach(async () => {
      // Create mock metrics collector
      mockMetricsCollector = {
        incrementCounter: jest.fn(),
        recordGauge: jest.fn()
      };

      // Create new processor with metrics collector and low concurrent limit
      queueProcessor = new QueueProcessor(
        mockDeliveryQueue,
        mockWebhookSender,
        mockLogger,
        {
          webhookConfigProvider: mockWebhookConfigProvider,
          maxConcurrentDeliveries: 2,
          processingInterval: 1000,
          metricsCollector: mockMetricsCollector,
          queueBacklogThreshold: 5
        }
      );
      await queueProcessor.start();

      // Capture the delivery processor function
      deliveryProcessor = (mockDeliveryQueue.startProcessing as jest.Mock).mock.calls[0][0];
    });

    it('should enforce concurrent delivery limits', async () => {
      // Mock webhook sender to simulate long-running deliveries
      let resolveDelivery1!: () => void;
      let resolveDelivery2!: () => void;
      let resolveDelivery3!: () => void;

      const delivery1Promise = new Promise<void>((resolve) => {
        resolveDelivery1 = resolve;
      });
      const delivery2Promise = new Promise<void>((resolve) => {
        resolveDelivery2 = resolve;
      });
      const delivery3Promise = new Promise<void>((resolve) => {
        resolveDelivery3 = resolve;
      });

      mockWebhookSender.sendWebhook
        .mockImplementationOnce(() => delivery1Promise.then(() => ({ success: true, statusCode: 200, responseTime: 100 })))
        .mockImplementationOnce(() => delivery2Promise.then(() => ({ success: true, statusCode: 200, responseTime: 100 })))
        .mockImplementationOnce(() => delivery3Promise.then(() => ({ success: true, statusCode: 200, responseTime: 100 })));

      // Start first two deliveries (should fill up the concurrent limit)
      const delivery1 = { ...sampleDelivery, id: 'delivery-1' };
      const delivery2 = { ...sampleDelivery, id: 'delivery-2' };
      const delivery3 = { ...sampleDelivery, id: 'delivery-3' };

      const process1 = deliveryProcessor(delivery1);
      const process2 = deliveryProcessor(delivery2);

      // Wait a bit to ensure they start processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Third delivery should be rate limited
      await expect(deliveryProcessor(delivery3)).rejects.toThrow('Rate limit exceeded');

      // Verify rate limiting metrics were recorded
      expect(mockMetricsCollector.incrementCounter).toHaveBeenCalledWith('queue_processor_rate_limited_total');

      // Complete the first two deliveries
      resolveDelivery1();
      resolveDelivery2();
      await Promise.all([process1, process2]);

      // Now the third delivery should be able to proceed
      const process3 = deliveryProcessor(delivery3);
      resolveDelivery3();
      await process3;

      expect(mockWebhookSender.sendWebhook).toHaveBeenCalledTimes(3);
    });

    it('should track delivery slot utilization', () => {
      const utilization = queueProcessor.getDeliverySlotUtilization();
      
      expect(utilization).toEqual({
        active: 0,
        max: 2,
        utilizationPercent: 0
      });
    });

    it('should check available delivery slots', () => {
      expect(queueProcessor.hasAvailableDeliverySlots()).toBe(true);
    });

    it('should track active delivery IDs', async () => {
      // Mock a long-running delivery
      let resolveDelivery!: () => void;
      const deliveryPromise = new Promise<void>((resolve) => {
        resolveDelivery = resolve;
      });

      mockWebhookSender.sendWebhook.mockImplementationOnce(() => 
        deliveryPromise.then(() => ({ success: true, statusCode: 200, responseTime: 100 }))
      );

      const delivery = { ...sampleDelivery, id: 'test-delivery' };
      const processPromise = deliveryProcessor(delivery);

      // Wait a bit for processing to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check active deliveries
      const activeIds = queueProcessor.getActiveDeliveryIds();
      expect(activeIds).toContain('test-delivery');

      // Complete the delivery
      resolveDelivery();
      await processPromise;

      // Check that delivery is no longer active
      const activeIdsAfter = queueProcessor.getActiveDeliveryIds();
      expect(activeIdsAfter).not.toContain('test-delivery');
    });

    it('should record metrics during getStats', async () => {
      mockDeliveryQueue.getQueueSize.mockResolvedValue(10);

      await queueProcessor.getStats();

      expect(mockMetricsCollector.recordGauge).toHaveBeenCalledWith('queue_processor_active_deliveries', 0);
      expect(mockMetricsCollector.recordGauge).toHaveBeenCalledWith('queue_processor_max_concurrent', 2);
      expect(mockMetricsCollector.recordGauge).toHaveBeenCalledWith('queue_processor_queue_size', 10);
      expect(mockMetricsCollector.recordGauge).toHaveBeenCalledWith('queue_processor_rate_limited_total', 0);
    });
  });
});