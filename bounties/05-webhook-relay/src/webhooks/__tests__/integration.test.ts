import { QueueProcessor } from '../QueueProcessor';
import { DeliveryQueue } from '../queue/DeliveryQueue';
import { WebhookSender } from '../WebhookSender';
import { HttpClient } from '../HttpClient';
import { DeliveryTracker } from '../DeliveryTracker';
import { Logger } from '../../monitoring/Logger';
import { DatabaseConnection } from '../../database/connection';
import type { WebhookDelivery, WebhookConfig, DeliveryResult } from '../../types';
import type { IWebhookConfigProvider } from '../interfaces';

// Mock external dependencies
jest.mock('../../database/connection');
jest.mock('../../monitoring/Logger');

describe('Queue to Delivery Integration', () => {
  let queueProcessor: QueueProcessor;
  let deliveryQueue: DeliveryQueue;
  let webhookSender: WebhookSender;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockDeliveryTracker: jest.Mocked<DeliveryTracker>;
  let mockLogger: jest.Mocked<Logger>;
  let mockWebhookConfigProvider: jest.Mocked<IWebhookConfigProvider>;
  let mockDb: jest.Mocked<DatabaseConnection>;

  const sampleWebhookConfig: WebhookConfig = {
    id: 'webhook-1',
    url: 'https://example.com/webhook',
    format: 'generic',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' },
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
    payload: {
      eventName: 'Transfer',
      contractAddress: '0x123',
      blockNumber: 12345,
      transactionHash: '0xabc',
      args: { from: '0x456', to: '0x789', value: '1000' }
    },
    attempts: 0,
    maxAttempts: 3,
    status: 'pending'
  };

  beforeEach(() => {
    // Create mocks
    mockDb = new DatabaseConnection({} as any) as jest.Mocked<DatabaseConnection>;
    mockLogger = new Logger() as jest.Mocked<Logger>;
    
    // Mock HTTP client
    mockHttpClient = {
      post: jest.fn(),
      client: {} as any
    } as unknown as jest.Mocked<HttpClient>;

    // Mock delivery tracker
    mockDeliveryTracker = {
      trackDelivery: jest.fn(),
      getDeliveryStats: jest.fn(),
      getRecentDeliveries: jest.fn(),
      clearHistory: jest.fn()
    } as unknown as jest.Mocked<DeliveryTracker>;

    // Mock webhook config provider
    mockWebhookConfigProvider = {
      getWebhookConfig: jest.fn().mockResolvedValue(sampleWebhookConfig),
      loadWebhookConfigs: jest.fn().mockResolvedValue(undefined),
      refreshConfigs: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<IWebhookConfigProvider>;

    // Setup logger mocks
    mockLogger.info = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.debug = jest.fn();

    // Create real instances with mocked dependencies
    deliveryQueue = new DeliveryQueue(mockDb, {
      maxConcurrentDeliveries: 5,
      processingInterval: 100, // Fast processing for tests
      retryBaseDelay: 100,
      maxRetryDelay: 1000,
      cleanupInterval: 10000,
      cleanupAge: 1
    });

    webhookSender = new WebhookSender(mockHttpClient, mockDeliveryTracker);
    
    queueProcessor = new QueueProcessor(
      deliveryQueue,
      webhookSender,
      mockLogger,
      {
        webhookConfigProvider: mockWebhookConfigProvider,
        maxConcurrentDeliveries: 5,
        processingInterval: 100
      }
    );
  });

  afterEach(async () => {
    await queueProcessor.stop();
    jest.clearAllMocks();
  });

  describe('successful delivery flow', () => {
    it('should process delivery from queue to successful webhook delivery', async () => {
      // Mock successful HTTP response
      const successResult: DeliveryResult = {
        success: true,
        statusCode: 200,
        responseTime: 150
      };
      mockHttpClient.post.mockResolvedValue(successResult);
      mockDeliveryTracker.trackDelivery.mockResolvedValue();

      // Mock queue persistence methods
      const mockPersistence = deliveryQueue['persistence'] as any;
      mockPersistence.saveDelivery = jest.fn().mockResolvedValue(undefined);
      mockPersistence.getNextDelivery = jest.fn()
        .mockResolvedValueOnce(sampleDelivery)
        .mockResolvedValue(null); // No more deliveries
      mockPersistence.updateDeliveryStatus = jest.fn().mockResolvedValue(undefined);
      mockPersistence.getQueueMetrics = jest.fn().mockResolvedValue({
        pendingCount: 0,
        processingCount: 0,
        completedCount: 1,
        failedCount: 0
      });

      // Start processing
      await queueProcessor.start();

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify HTTP client was called with correct parameters (formatted payload)
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          contractAddress: sampleDelivery.event.contractAddress,
          eventName: sampleDelivery.event.eventName,
          blockNumber: sampleDelivery.event.blockNumber,
          transactionHash: sampleDelivery.event.transactionHash,
          logIndex: sampleDelivery.event.logIndex,
          args: sampleDelivery.event.args,
          timestamp: expect.any(String),
        }),
        sampleWebhookConfig.headers,
        sampleWebhookConfig.timeout
      );

      // Verify delivery was tracked
      expect(mockDeliveryTracker.trackDelivery).toHaveBeenCalledWith(
        sampleDelivery,
        successResult
      );

      // Verify delivery was marked as complete
      expect(mockPersistence.updateDeliveryStatus).toHaveBeenCalledWith(
        'delivery-1',
        'completed'
      );

      // Verify stats
      const stats = await queueProcessor.getStats();
      expect(stats.successfulDeliveries).toBe(1);
      expect(stats.totalProcessed).toBe(1);
      expect(stats.failedDeliveries).toBe(0);
    });
  });

  describe('failed delivery with retry flow', () => {
    it('should handle failed delivery and schedule retry', async () => {
      // Mock failed HTTP response
      const failureResult: DeliveryResult = {
        success: false,
        statusCode: 500,
        responseTime: 100,
        error: 'Internal Server Error'
      };
      mockHttpClient.post.mockResolvedValue(failureResult);
      mockDeliveryTracker.trackDelivery.mockResolvedValue();

      // Mock queue persistence methods
      const mockPersistence = deliveryQueue['persistence'] as any;
      mockPersistence.saveDelivery = jest.fn().mockResolvedValue(undefined);
      mockPersistence.getNextDelivery = jest.fn()
        .mockResolvedValueOnce(sampleDelivery)
        .mockResolvedValue(null);
      mockPersistence.updateRetrySchedule = jest.fn().mockResolvedValue(undefined);
      mockPersistence.getQueueMetrics = jest.fn().mockResolvedValue({
        pendingCount: 1,
        processingCount: 0,
        completedCount: 0,
        failedCount: 0
      });

      // Start processing
      await queueProcessor.start();

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify HTTP client was called
      expect(mockHttpClient.post).toHaveBeenCalled();

      // Verify delivery was tracked with failure
      expect(mockDeliveryTracker.trackDelivery).toHaveBeenCalledWith(
        sampleDelivery,
        failureResult
      );

      // Verify retry was scheduled (since attempts < maxAttempts)
      expect(mockPersistence.updateRetrySchedule).toHaveBeenCalledWith(
        'delivery-1',
        expect.any(Date),
        1
      );

      // Verify stats
      const stats = await queueProcessor.getStats();
      expect(stats.failedDeliveries).toBe(1);
      expect(stats.totalProcessed).toBe(1);
    });
  });

  describe('max retry attempts exceeded', () => {
    it('should mark delivery as failed after max retry attempts', async () => {
      // Create delivery with max attempts reached
      const maxAttemptsDelivery: WebhookDelivery = {
        ...sampleDelivery,
        attempts: 3,
        maxAttempts: 3
      };

      // Mock failed HTTP response
      const failureResult: DeliveryResult = {
        success: false,
        statusCode: 404,
        responseTime: 50,
        error: 'Not Found'
      };
      mockHttpClient.post.mockResolvedValue(failureResult);
      mockDeliveryTracker.trackDelivery.mockResolvedValue();

      // Mock queue persistence methods
      const mockPersistence = deliveryQueue['persistence'] as any;
      mockPersistence.getNextDelivery = jest.fn()
        .mockResolvedValueOnce(maxAttemptsDelivery)
        .mockResolvedValue(null);
      mockPersistence.updateDeliveryStatus = jest.fn().mockResolvedValue(undefined);
      mockPersistence.getQueueMetrics = jest.fn().mockResolvedValue({
        pendingCount: 0,
        processingCount: 0,
        completedCount: 0,
        failedCount: 1
      });

      // Start processing
      await queueProcessor.start();

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify delivery was marked as failed
      expect(mockPersistence.updateDeliveryStatus).toHaveBeenCalledWith(
        'delivery-1',
        'failed',
        'Not Found'
      );

      // Verify stats
      const stats = await queueProcessor.getStats();
      expect(stats.failedDeliveries).toBe(1);
      expect(stats.totalProcessed).toBe(1);
    });
  });

  describe('concurrent delivery processing', () => {
    it('should process multiple deliveries concurrently', async () => {
      const delivery1: WebhookDelivery = { ...sampleDelivery, id: 'delivery-1' };
      const delivery2: WebhookDelivery = { ...sampleDelivery, id: 'delivery-2' };
      const delivery3: WebhookDelivery = { ...sampleDelivery, id: 'delivery-3' };

      // Mock successful HTTP responses
      const successResult: DeliveryResult = {
        success: true,
        statusCode: 200,
        responseTime: 100
      };
      mockHttpClient.post.mockResolvedValue(successResult);
      mockDeliveryTracker.trackDelivery.mockResolvedValue();

      // Mock queue persistence to return multiple deliveries
      const mockPersistence = deliveryQueue['persistence'] as any;
      mockPersistence.getNextDelivery = jest.fn()
        .mockResolvedValueOnce(delivery1)
        .mockResolvedValueOnce(delivery2)
        .mockResolvedValueOnce(delivery3)
        .mockResolvedValue(null);
      mockPersistence.updateDeliveryStatus = jest.fn().mockResolvedValue(undefined);
      mockPersistence.getQueueMetrics = jest.fn().mockResolvedValue({
        pendingCount: 0,
        processingCount: 0,
        completedCount: 3,
        failedCount: 0
      });

      // Start processing
      await queueProcessor.start();

      // Wait for all deliveries to be processed
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify all deliveries were processed
      expect(mockHttpClient.post).toHaveBeenCalledTimes(3);
      expect(mockDeliveryTracker.trackDelivery).toHaveBeenCalledTimes(3);
      expect(mockPersistence.updateDeliveryStatus).toHaveBeenCalledTimes(3);

      // Verify stats
      const stats = await queueProcessor.getStats();
      expect(stats.successfulDeliveries).toBe(3);
      expect(stats.totalProcessed).toBe(3);
    });
  });

  describe('webhook configuration validation', () => {
    it('should reject delivery with invalid webhook configuration', async () => {
      // Set invalid webhook config
      const invalidConfig: WebhookConfig = {
        ...sampleWebhookConfig,
        url: 'invalid-url',
        timeout: -1
      };
      
      // Mock the webhook config provider to return invalid config
      mockWebhookConfigProvider.getWebhookConfig.mockResolvedValueOnce(invalidConfig);

      // Mock queue persistence methods
      const mockPersistence = deliveryQueue['persistence'] as any;
      mockPersistence.getNextDelivery = jest.fn()
        .mockResolvedValueOnce(sampleDelivery)
        .mockResolvedValue(null);
      mockPersistence.updateDeliveryStatus = jest.fn().mockResolvedValue(undefined);
      mockPersistence.getQueueMetrics = jest.fn().mockResolvedValue({
        pendingCount: 0,
        processingCount: 0,
        completedCount: 0,
        failedCount: 1
      });

      // Start processing
      await queueProcessor.start();

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify HTTP client was not called due to validation failure
      expect(mockHttpClient.post).not.toHaveBeenCalled();

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Webhook delivery failed',
        expect.any(Error),
        expect.objectContaining({
          deliveryId: 'delivery-1',
          webhookId: 'webhook-1',
          attempt: expect.any(Number),
          maxAttempts: 3,
          error: expect.stringContaining('Invalid webhook configuration'),
          processingTime: expect.any(Number)
        })
      );

      // Verify stats
      const stats = await queueProcessor.getStats();
      expect(stats.failedDeliveries).toBe(1);
    });
  });

  describe('error handling and recovery', () => {
    it('should handle HTTP client exceptions gracefully', async () => {
      // Create a fresh delivery object to ensure correct initial state
      const testDelivery: WebhookDelivery = {
        ...sampleDelivery,
        attempts: 0,
        maxAttempts: 3
      };

      // Mock HTTP client to throw exception
      mockHttpClient.post.mockRejectedValue(new Error('Network timeout'));

      // Mock queue persistence methods
      const mockPersistence = deliveryQueue['persistence'] as any;
      mockPersistence.getNextDelivery = jest.fn()
        .mockResolvedValueOnce(testDelivery)
        .mockResolvedValue(null);
      mockPersistence.updateRetrySchedule = jest.fn().mockResolvedValue(undefined);
      mockPersistence.updateDeliveryStatus = jest.fn().mockResolvedValue(undefined);
      mockPersistence.getQueueMetrics = jest.fn().mockResolvedValue({
        pendingCount: 1,
        processingCount: 0,
        completedCount: 0,
        failedCount: 0
      });

      // Start processing
      await queueProcessor.start();

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Webhook delivery failed',
        expect.any(Error),
        expect.objectContaining({
          deliveryId: 'delivery-1',
          webhookId: 'webhook-1',
          attempt: expect.any(Number),
          maxAttempts: 3,
          error: 'Network timeout',
          processingTime: expect.any(Number)
        })
      );

      // Verify retry was scheduled (since attempts < maxAttempts)
      expect(mockPersistence.updateRetrySchedule).toHaveBeenCalledWith(
        'delivery-1',
        expect.any(Date),
        1 // attempts should be 1 after first failure
      );

      // Verify stats
      const stats = await queueProcessor.getStats();
      expect(stats.failedDeliveries).toBe(1);
    });
  });
});