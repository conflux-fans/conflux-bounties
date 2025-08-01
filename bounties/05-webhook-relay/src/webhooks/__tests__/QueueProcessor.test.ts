import { QueueProcessor } from '../QueueProcessor';
import { Logger } from '../../monitoring/Logger';
import type { WebhookDelivery, WebhookConfig, DeliveryResult } from '../../types';
import type { IDeliveryQueue } from '../queue/interfaces';
import type { IWebhookSender } from '../interfaces';

// Mock dependencies
jest.mock('../../monitoring/Logger');

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
});