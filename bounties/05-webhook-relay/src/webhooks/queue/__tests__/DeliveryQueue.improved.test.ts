import { DeliveryQueue } from '../DeliveryQueue';
import { DatabaseConnection } from '../../../database/connection';
import type { WebhookDelivery } from '../../../types';

// Mock the dependencies
jest.mock('../../../database/connection');
jest.mock('../RetryScheduler');
jest.mock('../QueuePersistence');

describe('DeliveryQueue Simple Tests', () => {
  let queue: DeliveryQueue;
  let mockDb: jest.Mocked<DatabaseConnection>;
  
  const mockDelivery: WebhookDelivery = {
    id: 'test-delivery-1',
    subscriptionId: 'sub-1',
    webhookId: 'webhook-1',
    event: {
      contractAddress: '0x123',
      eventName: 'Transfer',
      blockNumber: 100,
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
    jest.clearAllMocks();
    
    mockDb = {
      query: jest.fn(),
      transaction: jest.fn(),
      getClient: jest.fn(),
      healthCheck: jest.fn(),
      close: jest.fn(),
      getPoolInfo: jest.fn()
    } as any;

    queue = new DeliveryQueue(mockDb);
  });

  afterEach(() => {
    queue.stopProcessing();
  });

  it('should create queue instance', () => {
    expect(queue).toBeDefined();
  });

  it('should enqueue delivery', async () => {
    const mockPersistence = (queue as any).persistence;
    mockPersistence.saveDelivery = jest.fn().mockResolvedValue(undefined);

    await queue.enqueue(mockDelivery);

    expect(mockPersistence.saveDelivery).toHaveBeenCalled();
  });

  it('should mark failed with incrementAttempts', async () => {
    const mockPersistence = (queue as any).persistence;
    mockPersistence.incrementAttempts = jest.fn().mockResolvedValue(undefined);
    mockPersistence.updateDeliveryStatus = jest.fn().mockResolvedValue(undefined);

    await queue.markFailed('delivery-1', 'Network error');

    expect(mockPersistence.incrementAttempts).toHaveBeenCalledWith('delivery-1');
    expect(mockPersistence.updateDeliveryStatus).toHaveBeenCalledWith('delivery-1', 'failed', 'Network error');
  });

  it('should dequeue delivery', async () => {
    const mockPersistence = (queue as any).persistence;
    mockPersistence.getNextDelivery = jest.fn().mockResolvedValue(mockDelivery);

    const result = await queue.dequeue();

    expect(result).toEqual(mockDelivery);
    expect(await queue.getProcessingCount()).toBe(1);
  });

  it('should return null when at concurrent limit', async () => {
    const mockPersistence = (queue as any).persistence;
    mockPersistence.getNextDelivery = jest.fn().mockResolvedValue(mockDelivery);

    // Fill up to the limit (default is 10)
    for (let i = 0; i < 10; i++) {
      await queue.dequeue();
    }

    // Should return null when at limit
    const result = await queue.dequeue();
    expect(result).toBeNull();
  });

  it('should mark complete and decrement processing count', async () => {
    const mockPersistence = (queue as any).persistence;
    mockPersistence.updateDeliveryStatus = jest.fn().mockResolvedValue(undefined);
    mockPersistence.getNextDelivery = jest.fn().mockResolvedValue(mockDelivery);

    // First dequeue to increment processing count
    await queue.dequeue();
    expect(await queue.getProcessingCount()).toBe(1);

    await queue.markComplete('delivery-1');

    expect(mockPersistence.updateDeliveryStatus).toHaveBeenCalledWith('delivery-1', 'completed');
    expect(await queue.getProcessingCount()).toBe(0);
  });

  it('should schedule retry', async () => {
    const mockPersistence = (queue as any).persistence;
    mockPersistence.updateRetrySchedule = jest.fn().mockResolvedValue(undefined);

    const retryDate = new Date('2023-01-01T10:00:00Z');
    await queue.scheduleRetry('delivery-1', retryDate);

    expect(mockPersistence.updateRetrySchedule).toHaveBeenCalledWith('delivery-1', retryDate, 1);
  });

  it('should get queue size', async () => {
    const mockPersistence = (queue as any).persistence;
    mockPersistence.getQueueMetrics = jest.fn().mockResolvedValue({
      pendingCount: 5,
      processingCount: 2,
      completedCount: 10,
      failedCount: 1
    });

    const size = await queue.getQueueSize();

    expect(size).toBe(5);
  });

  it('should get stats', async () => {
    const mockPersistence = (queue as any).persistence;
    mockPersistence.getQueueMetrics = jest.fn().mockResolvedValue({
      pendingCount: 5,
      processingCount: 2,
      completedCount: 10,
      failedCount: 1
    });

    const stats = await queue.getStats();

    expect(stats).toEqual({
      pendingCount: 5,
      processingCount: 0, // Current processing count
      completedCount: 10,
      failedCount: 1,
      maxConcurrentDeliveries: 10
    });
  });

  it('should start and stop processing', () => {
    const mockProcessor = jest.fn().mockResolvedValue(undefined);
    
    queue.startProcessing(mockProcessor);
    expect((queue as any).isProcessing).toBe(true);
    
    queue.stopProcessing();
    expect((queue as any).isProcessing).toBe(false);
  });

  it('should not start processing if already processing', () => {
    const mockProcessor = jest.fn().mockResolvedValue(undefined);
    
    queue.startProcessing(mockProcessor);
    const firstInterval = (queue as any).processingInterval;
    
    queue.startProcessing(mockProcessor);
    const secondInterval = (queue as any).processingInterval;
    
    expect(firstInterval).toBe(secondInterval);
    
    queue.stopProcessing();
  });

  it('should test processDelivery success path', async () => {
    const mockPersistence = (queue as any).persistence;
    mockPersistence.updateDeliveryStatus = jest.fn().mockResolvedValue(undefined);

    const mockProcessor = jest.fn().mockResolvedValue(undefined);
    
    // Call processDelivery directly
    await (queue as any).processDelivery(mockDelivery, mockProcessor);
    
    expect(mockProcessor).toHaveBeenCalledWith(mockDelivery);
    expect(mockPersistence.updateDeliveryStatus).toHaveBeenCalledWith(mockDelivery.id, 'completed');
  });

  it('should test processDelivery retry path', async () => {
    const mockPersistence = (queue as any).persistence;
    const mockRetryScheduler = (queue as any).retryScheduler;
    
    mockPersistence.updateRetrySchedule = jest.fn().mockResolvedValue(undefined);
    mockRetryScheduler.shouldRetry = jest.fn().mockReturnValue(true);
    mockRetryScheduler.calculateNextRetry = jest.fn().mockReturnValue(new Date('2023-01-01T10:00:00Z'));

    const mockProcessor = jest.fn().mockRejectedValue(new Error('Network timeout'));
    const deliveryForRetry = { ...mockDelivery, attempts: 1 };
    
    await (queue as any).processDelivery(deliveryForRetry, mockProcessor);
    
    expect(mockRetryScheduler.shouldRetry).toHaveBeenCalled();
    expect(mockRetryScheduler.calculateNextRetry).toHaveBeenCalledWith(2);
    expect(mockPersistence.updateRetrySchedule).toHaveBeenCalled();
  });

  it('should test processDelivery failure path without dead letter queue', async () => {
    const mockPersistence = (queue as any).persistence;
    const mockRetryScheduler = (queue as any).retryScheduler;
    
    mockPersistence.updateDeliveryStatus = jest.fn().mockResolvedValue(undefined);
    mockRetryScheduler.shouldRetry = jest.fn().mockReturnValue(false);

    const mockProcessor = jest.fn().mockRejectedValue(new Error('Permanent failure'));
    const deliveryForFailure = { ...mockDelivery, attempts: 3 };
    
    await (queue as any).processDelivery(deliveryForFailure, mockProcessor);
    
    expect(mockRetryScheduler.shouldRetry).toHaveBeenCalled();
    expect(mockPersistence.updateDeliveryStatus).toHaveBeenCalledWith(
      deliveryForFailure.id, 
      'failed', 
      'Permanent failure'
    );
  });

  it('should test processDelivery with dead letter queue success', async () => {
    // Create mock instances
    const mockDLQInstance = {
      addFailedDelivery: jest.fn().mockResolvedValue(undefined)
    };
    const mockLoggerInstance = {
      warn: jest.fn(),
      error: jest.fn()
    };
    
    // Create queue with dead letter queue and logger
    const queueWithDLQ = new DeliveryQueue(
      mockDb, 
      { maxConcurrentDeliveries: 2 },
      mockDLQInstance as any,
      mockLoggerInstance as any
    );
    
    const mockPersistenceWithDLQ = (queueWithDLQ as any).persistence;
    const mockRetrySchedulerWithDLQ = (queueWithDLQ as any).retryScheduler;
    
    mockPersistenceWithDLQ.updateDeliveryStatus = jest.fn().mockResolvedValue(undefined);
    mockRetrySchedulerWithDLQ.shouldRetry = jest.fn().mockReturnValue(false);

    const mockProcessor = jest.fn().mockRejectedValue(new Error('Max retries exceeded'));
    const deliveryForFailure = { ...mockDelivery, attempts: 3 };
    
    await (queueWithDLQ as any).processDelivery(deliveryForFailure, mockProcessor);
    
    expect(mockDLQInstance.addFailedDelivery).toHaveBeenCalledWith(
      deliveryForFailure,
      'Max retry attempts exceeded',
      'Max retries exceeded'
    );
    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
      'Delivery moved to dead letter queue after max retries',
      expect.objectContaining({
        deliveryId: deliveryForFailure.id,
        webhookId: deliveryForFailure.webhookId
      })
    );
  });

  it('should test processDelivery with dead letter queue failure', async () => {
    // Create mock instances
    const mockDLQInstance = {
      addFailedDelivery: jest.fn().mockRejectedValue(new Error('DLQ failed'))
    };
    const mockLoggerInstance = {
      warn: jest.fn(),
      error: jest.fn()
    };
    
    // Create queue with dead letter queue and logger
    const queueWithDLQ = new DeliveryQueue(
      mockDb, 
      { maxConcurrentDeliveries: 2 },
      mockDLQInstance as any,
      mockLoggerInstance as any
    );
    
    const mockPersistenceWithDLQ = (queueWithDLQ as any).persistence;
    const mockRetrySchedulerWithDLQ = (queueWithDLQ as any).retryScheduler;
    
    mockPersistenceWithDLQ.updateDeliveryStatus = jest.fn().mockResolvedValue(undefined);
    mockRetrySchedulerWithDLQ.shouldRetry = jest.fn().mockReturnValue(false);

    const mockProcessor = jest.fn().mockRejectedValue(new Error('Max retries exceeded'));
    const deliveryForFailure = { ...mockDelivery, attempts: 3 };
    
    await (queueWithDLQ as any).processDelivery(deliveryForFailure, mockProcessor);
    
    expect(mockDLQInstance.addFailedDelivery).toHaveBeenCalled();
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'Failed to add delivery to dead letter queue',
      expect.any(Error),
      expect.objectContaining({
        deliveryId: deliveryForFailure.id,
        webhookId: deliveryForFailure.webhookId
      })
    );
  });

  it('should test processDelivery without dead letter queue', async () => {
    // Create mock logger instance
    const mockLoggerInstance = {
      warn: jest.fn(),
      error: jest.fn()
    };
    
    // Create queue with logger but no dead letter queue
    const queueWithoutDLQ = new DeliveryQueue(
      mockDb, 
      { maxConcurrentDeliveries: 2 },
      undefined, // no dead letter queue
      mockLoggerInstance as any
    );
    
    const mockPersistenceWithoutDLQ = (queueWithoutDLQ as any).persistence;
    const mockRetrySchedulerWithoutDLQ = (queueWithoutDLQ as any).retryScheduler;
    
    mockPersistenceWithoutDLQ.updateDeliveryStatus = jest.fn().mockResolvedValue(undefined);
    mockRetrySchedulerWithoutDLQ.shouldRetry = jest.fn().mockReturnValue(false);

    const mockProcessor = jest.fn().mockRejectedValue(new Error('Max retries exceeded'));
    const deliveryForFailure = { ...mockDelivery, attempts: 3 };
    
    await (queueWithoutDLQ as any).processDelivery(deliveryForFailure, mockProcessor);
    
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'Delivery failed permanently - no dead letter queue configured',
      undefined,
      expect.objectContaining({
        deliveryId: deliveryForFailure.id,
        webhookId: deliveryForFailure.webhookId
      })
    );
  });

  it('should test processQueue with delivery processing', async () => {
    const mockPersistence = (queue as any).persistence;
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Mock getNextDelivery to return a delivery then null
    mockPersistence.getNextDelivery = jest.fn()
      .mockResolvedValueOnce(mockDelivery)
      .mockResolvedValueOnce(null);
    
    // Mock processDelivery to throw an error
    const originalProcessDelivery = (queue as any).processDelivery;
    (queue as any).processDelivery = jest.fn().mockRejectedValue(new Error('Process delivery error'));

    // Call processQueue directly to test the error handling
    const mockProcessor = jest.fn().mockResolvedValue(undefined);
    await (queue as any).processQueue(mockProcessor);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `Failed to process delivery ${mockDelivery.id}:`, 
      expect.any(Error)
    );
    
    // Restore original method
    (queue as any).processDelivery = originalProcessDelivery;
    consoleErrorSpy.mockRestore();
  });

  it('should test performMaintenance with cleanup', async () => {
    const mockPersistence = (queue as any).persistence;
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    mockPersistence.cleanupCompletedDeliveries = jest.fn().mockResolvedValue(5);
    mockPersistence.resetStuckDeliveries = jest.fn().mockResolvedValue(0);
    
    await (queue as any).performMaintenance();
    
    expect(mockPersistence.cleanupCompletedDeliveries).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Cleaned up 5 old deliveries');
    
    consoleSpy.mockRestore();
  });

  it('should test performMaintenance with stuck deliveries', async () => {
    const mockPersistence = (queue as any).persistence;
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    mockPersistence.cleanupCompletedDeliveries = jest.fn().mockResolvedValue(0);
    mockPersistence.resetStuckDeliveries = jest.fn().mockResolvedValue(3);
    
    await (queue as any).performMaintenance();
    
    expect(mockPersistence.resetStuckDeliveries).toHaveBeenCalledWith(300000);
    expect(consoleSpy).toHaveBeenCalledWith('Reset 3 stuck deliveries');
    
    consoleSpy.mockRestore();
  });

  it('should get retry scheduler', () => {
    const scheduler = queue.getRetryScheduler();
    expect(scheduler).toBeDefined();
    expect(typeof scheduler.shouldRetry).toBe('function');
  });

  it('should handle processing count edge cases', async () => {
    const mockPersistence = (queue as any).persistence;
    mockPersistence.updateDeliveryStatus = jest.fn().mockResolvedValue(undefined);
    mockPersistence.incrementAttempts = jest.fn().mockResolvedValue(undefined);
    mockPersistence.updateRetrySchedule = jest.fn().mockResolvedValue(undefined);

    // Test markComplete when processing count is already 0
    await queue.markComplete('delivery-1');
    expect(await queue.getProcessingCount()).toBe(0);

    // Test markFailed when processing count is already 0
    await queue.markFailed('delivery-2', 'error');
    expect(await queue.getProcessingCount()).toBe(0);

    // Test scheduleRetry when processing count is already 0
    await queue.scheduleRetry('delivery-3', new Date());
    expect(await queue.getProcessingCount()).toBe(0);
  });
});