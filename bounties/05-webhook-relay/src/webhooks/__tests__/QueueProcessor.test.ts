import { QueueProcessor } from '../QueueProcessor';
import { Logger } from '../../monitoring/Logger';
import { DeadLetterQueue } from '../queue/DeadLetterQueue';
import type { WebhookDelivery, WebhookConfig, DeliveryResult } from '../../types';
import type { IDeliveryQueue } from '../queue/interfaces';
import type { IWebhookSender } from '../interfaces';

// Mock dependencies
jest.mock('../../monitoring/Logger');
jest.mock('../queue/DeadLetterQueue');

describe('QueueProcessor', () => {
  let queueProcessor: QueueProcessor;
  let mockDeliveryQueue: jest.Mocked<IDeliveryQueue>;
  let mockWebhookSender: jest.Mocked<IWebhookSender>;
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
      stopProcessing: jest.fn()
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
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('start', () => {
    it('should start the queue processor successfully', async () => {
      await queueProcessor.start();

      expect(mockDeliveryQueue.startProcessing).toHaveBeenCalledWith(
        expect.any(Function)
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Starting queue processor', {
        maxConcurrentDeliveries: 10,
        processingInterval: 1000
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Queue processor started successfully');
      expect(queueProcessor.isRunning()).toBe(true);
    });

    it('should not start if already running', async () => {
      await queueProcessor.start();
      await queueProcessor.start();

      expect(mockDeliveryQueue.startProcessing).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith('Queue processor is already running');
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
        processingCount: 2
      });
    });
  });

  describe('webhook delivery processing', () => {
    let deliveryProcessor: (delivery: WebhookDelivery) => Promise<void>;

    beforeEach(async () => {
      // Set up webhook config
      queueProcessor.setWebhookConfig('webhook-1', sampleWebhookConfig);

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
      expect(mockWebhookSender.sendWebhook).toHaveBeenCalledWith(sampleDelivery);
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

    it('should handle missing webhook configuration', async () => {
      const deliveryWithMissingConfig: WebhookDelivery = {
        ...sampleDelivery,
        webhookId: 'missing-webhook'
      };

      await expect(deliveryProcessor(deliveryWithMissingConfig)).rejects.toThrow(
        'Webhook configuration not found for ID: missing-webhook'
      );

      expect(mockWebhookSender.sendWebhook).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Webhook delivery failed',
        expect.any(Error), // Error object for missing config
        {
          deliveryId: 'delivery-1',
          webhookId: 'missing-webhook',
          attempt: 1,
          maxAttempts: 3,
          error: 'Webhook configuration not found for ID: missing-webhook',
          processingTime: expect.any(Number)
        }
      );
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

  describe('webhook configuration management', () => {
    it('should set and get webhook configuration', () => {
      queueProcessor.setWebhookConfig('webhook-1', sampleWebhookConfig);
      
      const config = queueProcessor.getWebhookConfig('webhook-1');
      expect(config).toEqual(sampleWebhookConfig);
    });

    it('should remove webhook configuration', () => {
      queueProcessor.setWebhookConfig('webhook-1', sampleWebhookConfig);
      queueProcessor.removeWebhookConfig('webhook-1');
      
      const config = queueProcessor.getWebhookConfig('webhook-1');
      expect(config).toBeNull();
    });

    it('should return null for non-existent webhook configuration', () => {
      const config = queueProcessor.getWebhookConfig('non-existent');
      expect(config).toBeNull();
    });
  });

  describe('custom webhook config provider', () => {
    it('should use custom webhook config provider', async () => {
      const customProvider = jest.fn().mockResolvedValue(sampleWebhookConfig);
      queueProcessor.setWebhookConfigProvider(customProvider);

      await queueProcessor.start();
      const deliveryProcessor = (mockDeliveryQueue.startProcessing as jest.Mock).mock.calls[0][0];

      mockWebhookSender.sendWebhook.mockResolvedValue({
        success: true,
        statusCode: 200,
        responseTime: 100
      });

      await deliveryProcessor(sampleDelivery);

      expect(customProvider).toHaveBeenCalledWith('webhook-1');
      expect(mockWebhookSender.sendWebhook).toHaveBeenCalled();
    });
  });

  describe('constructor options', () => {
    it('should use custom options', () => {
      const customProcessor = new QueueProcessor(
        mockDeliveryQueue,
        mockWebhookSender,
        mockLogger,
        {
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
          deadLetterQueue: mockDeadLetterQueue
        }
      );

      // Set up webhook config
      queueProcessorWithDLQ.setWebhookConfig('webhook-1', sampleWebhookConfig);

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
        mockLogger
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
        mockLogger
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
        mockLogger
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
      const customProvider = jest.fn().mockResolvedValue(null);
      queueProcessor.setWebhookConfigProvider(customProvider);

      await expect(deliveryProcessor(sampleDelivery)).rejects.toThrow(
        'Webhook configuration not found for ID: webhook-1'
      );

      expect(customProvider).toHaveBeenCalledWith('webhook-1');
      expect(mockWebhookSender.sendWebhook).not.toHaveBeenCalled();
    });

    it('should handle webhook config provider that throws an error', async () => {
      const providerError = new Error('Config provider database error');
      const customProvider = jest.fn().mockRejectedValue(providerError);
      queueProcessor.setWebhookConfigProvider(customProvider);

      await expect(deliveryProcessor(sampleDelivery)).rejects.toThrow('Config provider database error');

      expect(customProvider).toHaveBeenCalledWith('webhook-1');
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

      const customProvider = jest.fn().mockResolvedValue(invalidConfig);
      queueProcessor.setWebhookConfigProvider(customProvider);

      mockWebhookSender.validateWebhookConfig.mockReturnValue({
        isValid: false,
        errors: [
          { field: 'url', message: 'Invalid URL format', value: 'invalid-url' }
        ]
      });

      await expect(deliveryProcessor(sampleDelivery)).rejects.toThrow(
        'Invalid webhook configuration: Invalid URL format'
      );

      expect(customProvider).toHaveBeenCalledWith('webhook-1');
      expect(mockWebhookSender.validateWebhookConfig).toHaveBeenCalledWith(invalidConfig);
      expect(mockWebhookSender.sendWebhook).not.toHaveBeenCalled();
    });
  });

  describe('edge cases and error paths', () => {
    let deliveryProcessor: (delivery: WebhookDelivery) => Promise<void>;

    beforeEach(async () => {
      queueProcessor.setWebhookConfig('webhook-1', sampleWebhookConfig);
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

      expect(mockWebhookSender.sendWebhook).toHaveBeenCalledWith(deliveryWithoutEvent);
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
});