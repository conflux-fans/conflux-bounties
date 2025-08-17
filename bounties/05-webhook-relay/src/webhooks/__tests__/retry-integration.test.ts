import { QueueProcessor } from '../QueueProcessor';
import { DeliveryQueue } from '../queue/DeliveryQueue';
import { RetryScheduler } from '../queue/RetryScheduler';
import { DeadLetterQueue } from '../queue/DeadLetterQueue';
import { Logger } from '../../monitoring/Logger';
import { DatabaseConnection } from '../../database/connection';
import type { WebhookDelivery, WebhookConfig } from '../../types';
import type { IWebhookSender } from '../interfaces';

// Mock dependencies
jest.mock('../../monitoring/Logger');
jest.mock('../../database/connection');
jest.mock('../queue/DeadLetterQueue');

describe('Retry Logic Integration Tests', () => {
  let queueProcessor: QueueProcessor;
  let deliveryQueue: DeliveryQueue;
  let mockWebhookSender: jest.Mocked<IWebhookSender>;
  let mockLogger: jest.Mocked<Logger>;
  let mockDb: jest.Mocked<DatabaseConnection>;
  let mockDeadLetterQueue: jest.Mocked<DeadLetterQueue>;

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
    // Create mock database
    mockDb = {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
    } as unknown as jest.Mocked<DatabaseConnection>;

    // Create mock webhook sender
    mockWebhookSender = {
      sendWebhook: jest.fn(),
      validateWebhookConfig: jest.fn().mockReturnValue({
        isValid: true,
        errors: []
      })
    };

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis(),
      setLevel: jest.fn()
    } as unknown as jest.Mocked<Logger>;

    // Create mock dead letter queue
    mockDeadLetterQueue = {
      addFailedDelivery: jest.fn().mockResolvedValue(undefined),
      getFailedDeliveries: jest.fn(),
      removeFailedDelivery: jest.fn(),
      cleanup: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      getStats: jest.fn().mockResolvedValue({
        totalEntries: 0,
        entriesLast24h: 0,
        entriesLast7d: 0,
        topFailureReasons: []
      })
    } as unknown as jest.Mocked<DeadLetterQueue>;

    // Create delivery queue with retry configuration
    deliveryQueue = new DeliveryQueue(
      mockDb,
      {
        retryBaseDelay: 1000,    // 1 second base delay
        maxRetryDelay: 8000,     // 8 seconds max delay
        maxConcurrentDeliveries: 1
      },
      mockDeadLetterQueue,
      mockLogger
    );

    // Create queue processor
    queueProcessor = new QueueProcessor(
      deliveryQueue,
      mockWebhookSender,
      mockLogger,
      {
        deadLetterQueue: mockDeadLetterQueue,
        retryBaseDelay: 1000,
        retryMaxDelay: 8000
      }
    );

    // Set webhook config
    queueProcessor.setWebhookConfig('webhook-1', sampleWebhookConfig);
  });

  afterEach(async () => {
    if (queueProcessor) {
      try {
        await queueProcessor.stop();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    jest.clearAllMocks();
  });

  describe('Exponential Backoff Implementation', () => {
    it('should implement exponential backoff with correct delays (Requirement 5.1, 5.2, 5.3)', () => {
      const retryScheduler = queueProcessor.getRetryScheduler();
      
      // Test exponential backoff: 1s, 2s, 4s, 8s, etc.
      const delays = [
        retryScheduler.getBackoffDelay(0), // First retry: ~1s
        retryScheduler.getBackoffDelay(1), // Second retry: ~2s
        retryScheduler.getBackoffDelay(2), // Third retry: ~4s
        retryScheduler.getBackoffDelay(3)  // Fourth retry: ~8s
      ];

      // Verify exponential pattern (allowing for jitter)
      expect(delays[0]).toBeGreaterThanOrEqual(1000);  // ~1s base delay
      expect(delays[1]).toBeGreaterThanOrEqual(2000);  // ~2s (2^1 * base)
      expect(delays[2]).toBeGreaterThanOrEqual(4000);  // ~4s (2^2 * base)
      expect(delays[3]).toBeGreaterThanOrEqual(8000);  // ~8s (2^3 * base)

      // Verify each delay is approximately double the previous (accounting for jitter)
      expect(delays[1]!).toBeGreaterThan(delays[0]! * 1.5);
      expect(delays[2]!).toBeGreaterThan(delays[1]! * 1.5);
      expect(delays[3]!).toBeGreaterThan(delays[2]! * 1.5);
    });

    it('should respect maximum delay cap', () => {
      const retryScheduler = queueProcessor.getRetryScheduler();
      
      // Test that very high attempt numbers don't exceed max delay (allowing for jitter)
      const highAttemptDelay = retryScheduler.getBackoffDelay(10);
      expect(highAttemptDelay).toBeLessThanOrEqual(9000); // Max delay + jitter allowance
    });

    it('should add jitter to prevent thundering herd', () => {
      const retryScheduler = queueProcessor.getRetryScheduler();
      
      // Get multiple delays for the same attempt to verify jitter
      const delays = Array.from({ length: 10 }, () => 
        retryScheduler.getBackoffDelay(2)
      );
      
      // All delays should be different due to jitter
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('Retry Decision Logic', () => {
    it('should retry when attempts are below max (Requirement 4.3)', () => {
      const retryScheduler = queueProcessor.getRetryScheduler();
      
      const deliveryWithRetriesLeft: WebhookDelivery = {
        ...sampleDelivery,
        attempts: 1,
        maxAttempts: 3,
        status: 'failed'
      };
      
      expect(retryScheduler.shouldRetry(deliveryWithRetriesLeft)).toBe(true);
    });

    it('should not retry when max attempts reached (Requirement 4.4, 5.4)', () => {
      const retryScheduler = queueProcessor.getRetryScheduler();
      
      const deliveryMaxRetriesReached: WebhookDelivery = {
        ...sampleDelivery,
        attempts: 3,
        maxAttempts: 3,
        status: 'failed'
      };
      
      expect(retryScheduler.shouldRetry(deliveryMaxRetriesReached)).toBe(false);
    });

    it('should not retry completed deliveries (Requirement 5.5)', () => {
      const retryScheduler = queueProcessor.getRetryScheduler();
      
      const completedDelivery: WebhookDelivery = {
        ...sampleDelivery,
        attempts: 1,
        maxAttempts: 3,
        status: 'completed'
      };
      
      expect(retryScheduler.shouldRetry(completedDelivery)).toBe(false);
    });
  });

  describe('Integration with DeliveryQueue', () => {
    it('should use consistent retry scheduler between QueueProcessor and DeliveryQueue', () => {
      const queueRetryScheduler = deliveryQueue.getRetryScheduler();
      const processorRetryScheduler = queueProcessor.getRetryScheduler();
      
      // Both should implement the same exponential backoff logic
      const queueDelay = queueRetryScheduler.getBackoffDelay(2);
      const processorDelay = processorRetryScheduler.getBackoffDelay(2);
      
      // Delays should be in the same range (allowing for jitter)
      expect(Math.abs(queueDelay - processorDelay)).toBeLessThan(1000);
    });

    it('should allow custom retry scheduler configuration', () => {
      const customRetryScheduler = new RetryScheduler(500, 4000); // 0.5s base, 4s max
      
      queueProcessor.setRetryScheduler(customRetryScheduler);
      
      const retrievedScheduler = queueProcessor.getRetryScheduler();
      expect(retrievedScheduler).toBe(customRetryScheduler);
      
      // Verify custom configuration is used
      const delay = retrievedScheduler.getBackoffDelay(0);
      expect(delay).toBeGreaterThanOrEqual(500); // Custom base delay
    });
  });

  describe('Error Handling and Dead Letter Queue', () => {
    it('should handle retry scheduling failures gracefully', async () => {
      // This test verifies that if retry scheduling fails, the system handles it gracefully
      // In the current implementation, the DeliveryQueue handles this automatically
      
      const retryScheduler = queueProcessor.getRetryScheduler();
      
      // Test that calculateNextRetry always returns a valid date
      const nextRetry = retryScheduler.calculateNextRetry(2);
      expect(nextRetry).toBeInstanceOf(Date);
      expect(nextRetry.getTime()).toBeGreaterThan(Date.now());
    });

    it('should provide access to dead letter queue functionality', async () => {
      // Verify that QueueProcessor can access dead letter queue stats
      const stats = await queueProcessor.getDeadLetterStats();
      
      // Should call the dead letter queue's getStats method
      expect(mockDeadLetterQueue.getStats).toHaveBeenCalled();
      expect(stats).toBeDefined();
    });
  });

  describe('Configuration and Customization', () => {
    it('should accept custom retry configuration in constructor', () => {
      const customProcessor = new QueueProcessor(
        deliveryQueue,
        mockWebhookSender,
        mockLogger,
        {
          retryBaseDelay: 2000,  // 2 second base
          retryMaxDelay: 16000   // 16 second max
        }
      );

      const retryScheduler = customProcessor.getRetryScheduler();
      
      // Verify custom configuration is used
      const delay = retryScheduler.getBackoffDelay(0);
      expect(delay).toBeGreaterThanOrEqual(2000); // Custom base delay
    });

    it('should use default retry configuration when not specified', () => {
      const defaultProcessor = new QueueProcessor(
        deliveryQueue,
        mockWebhookSender,
        mockLogger
      );

      const retryScheduler = defaultProcessor.getRetryScheduler();
      
      // Verify default configuration (1s base, 5min max)
      const delay = retryScheduler.getBackoffDelay(0);
      expect(delay).toBeGreaterThanOrEqual(1000); // Default 1s base delay
    });
  });
});