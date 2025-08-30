import { EventProcessor } from '../EventProcessor';
import { EventListener } from '../EventListener';
import { FilterEngine } from '../../filtering/FilterEngine';
import { DeliveryQueue } from '../../webhooks/queue/DeliveryQueue';
import { DatabaseConnection } from '../../database/connection';
import type { 
  EventSubscription, 
  BlockchainEvent, 
  WebhookConfig,
  NetworkConfig 
} from '../../types';

// Mock dependencies
jest.mock('../EventListener');
jest.mock('../../filtering/FilterEngine');
jest.mock('../../webhooks/queue/DeliveryQueue');
jest.mock('../../database/connection');

describe('EventProcessor', () => {
  let eventProcessor: EventProcessor;
  let mockEventListener: jest.Mocked<EventListener>;
  let mockFilterEngine: jest.Mocked<FilterEngine>;
  let mockDeliveryQueue: jest.Mocked<DeliveryQueue>;

  let mockDb: jest.Mocked<DatabaseConnection>;

  // Helper function to add timeout to async operations
  const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T> => {
    let timeoutHandle: NodeJS.Timeout;
    
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([
      promise.finally(() => clearTimeout(timeoutHandle)),
      timeoutPromise
    ]);
  };

  const mockNetworkConfig: NetworkConfig = {
    rpcUrl: 'https://test.confluxrpc.com',
    wsUrl: 'wss://test.confluxrpc.com/ws',
    chainId: 1,
    confirmations: 1
  };

  const mockWebhookConfig: WebhookConfig = {
    id: 'webhook-1',
    url: 'https://example.com/webhook',
    format: 'generic',
    headers: {},
    timeout: 30000,
    retryAttempts: 3
  };

  const mockSubscription: EventSubscription = {
    id: 'sub-1',
    contractAddress: '0x1234567890123456789012345678901234567890',
    eventSignature: 'Transfer(address,address,uint256)',
    filters: { from: '0xabcd' },
    webhooks: [mockWebhookConfig]
  };

  const mockEvent: BlockchainEvent = {
    contractAddress: '0x1234567890123456789012345678901234567890',
    eventName: 'Transfer',
    blockNumber: 12345,
    transactionHash: '0xabcdef',
    logIndex: 0,
    args: { from: '0xabcd', to: '0xefgh', value: '1000' },
    timestamp: new Date()
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockDb = new DatabaseConnection({} as any) as jest.Mocked<DatabaseConnection>;
    mockEventListener = new EventListener(mockNetworkConfig) as jest.Mocked<EventListener>;
    mockFilterEngine = new FilterEngine() as jest.Mocked<FilterEngine>;
    mockDeliveryQueue = new DeliveryQueue(mockDb) as jest.Mocked<DeliveryQueue>;


    // Setup mock implementations
    mockEventListener.start = jest.fn().mockResolvedValue(undefined);
    mockEventListener.stop = jest.fn().mockResolvedValue(undefined);
    mockEventListener.addSubscription = jest.fn();
    mockEventListener.removeSubscription = jest.fn();
    mockEventListener.isListening = jest.fn().mockReturnValue(true);
    mockEventListener.getEventStatistics = jest.fn().mockReturnValue({
      uptime: 0,
      totalEvents: 0,
      eventsByContract: {},
      eventsByType: {},
      lastEventTime: null,
      subscriptionCount: 0
    });
    mockEventListener.on = jest.fn();
    mockEventListener.emit = jest.fn();

    mockFilterEngine.evaluateFilters = jest.fn().mockReturnValue(true);

    mockDeliveryQueue.startProcessing = jest.fn();
    mockDeliveryQueue.stopProcessing = jest.fn();
    mockDeliveryQueue.enqueue = jest.fn().mockResolvedValue(undefined);
    mockDeliveryQueue.getStats = jest.fn().mockResolvedValue({
      pendingCount: 0,
      processingCount: 0,
      completedCount: 0,
      failedCount: 0,
      maxConcurrentDeliveries: 10
    });

    mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

    // Create EventProcessor instance
    eventProcessor = new EventProcessor(
      mockEventListener,
      mockFilterEngine,
      mockDb,
      mockDeliveryQueue
    );
  });

  afterEach(async () => {
    // Ensure proper cleanup to prevent worker process hanging
    try {
      if (eventProcessor && eventProcessor.isProcessing()) {
        await withTimeout(eventProcessor.stop(), 2000);
      }
    } catch (error) {
      // Ignore cleanup errors in tests
    }

    // Clear any remaining timers
    jest.clearAllTimers();
    jest.useRealTimers();
    
    // Remove all listeners to prevent memory leaks
    if (eventProcessor) {
      eventProcessor.removeAllListeners();
    }

    // Clean up global resources
    if ((global as any).cleanupGlobalResources) {
      try {
        await (global as any).cleanupGlobalResources();
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  afterAll(async () => {
    // Final cleanup to ensure no hanging processes
    jest.clearAllTimers();
    jest.useRealTimers();
    
    // Clean up any remaining global resources
    if ((global as any).cleanupGlobalResources) {
      try {
        await (global as any).cleanupGlobalResources();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    // Wait a bit for any pending operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Lifecycle Management', () => {
    it('should start successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await withTimeout(eventProcessor.start());

      expect(mockEventListener.start).toHaveBeenCalled();
      expect(eventProcessor.isProcessing()).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('🚀 EventProcessor started successfully - Real-time processing active!');
      
      consoleSpy.mockRestore();
    });

    it('should stop successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await withTimeout(eventProcessor.start());
      await withTimeout(eventProcessor.stop());

      expect(mockEventListener.stop).toHaveBeenCalled();
      expect(eventProcessor.isProcessing()).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('✅ EventProcessor stopped');
      
      consoleSpy.mockRestore();
    });

    it('should not start if already running', async () => {
      // Start the processor first
      await withTimeout(eventProcessor.start());
      expect(eventProcessor.isProcessing()).toBe(true);
      
      // Clear the mock calls from the first start
      mockEventListener.start.mockClear();
      
      // Try to start again - should return early without calling dependencies
      const result = await withTimeout(eventProcessor.start());
      expect(result).toBeUndefined(); // Should return undefined from early return

      expect(mockEventListener.start).not.toHaveBeenCalled();
    });

    it('should not stop if not running', async () => {
      // Ensure processor is not running
      expect(eventProcessor.isProcessing()).toBe(false);
      
      // Try to stop when not running - should return early
      await withTimeout(eventProcessor.stop());

      expect(mockEventListener.stop).not.toHaveBeenCalled();
      expect(mockDeliveryQueue.stopProcessing).not.toHaveBeenCalled();
    });
  });

  describe('Subscription Management', () => {
    it('should add subscription successfully', async () => {
      await eventProcessor.addSubscription(mockSubscription);

      expect(mockEventListener.addSubscription).toHaveBeenCalledWith(mockSubscription);
      expect(eventProcessor.getSubscriptions()).toContain(mockSubscription);
    });

    it('should remove subscription successfully', async () => {
      await eventProcessor.addSubscription(mockSubscription);
      eventProcessor.removeSubscription(mockSubscription.id);

      expect(mockEventListener.removeSubscription).toHaveBeenCalledWith(mockSubscription.id);
      expect(eventProcessor.getSubscriptions()).not.toContain(mockSubscription);
    });

    it('should validate subscription before adding', async () => {
      const invalidSubscription = {
        id: '',
        contractAddress: '',
        eventSignature: '',
        filters: {},
        webhooks: []
      } as EventSubscription;

      await expect(eventProcessor.addSubscription(invalidSubscription))
        .rejects.toThrow('Invalid subscription: missing required fields');
    });

    it('should handle removing non-existent subscription gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      eventProcessor.removeSubscription('non-existent');
      
      expect(consoleSpy).toHaveBeenCalledWith('Subscription non-existent not found');
      consoleSpy.mockRestore();
    });
  });

  describe('Event Processing Pipeline', () => {
    beforeEach(async () => {
      await eventProcessor.addSubscription(mockSubscription);
    });

    it('should process matching events successfully', async () => {
      mockFilterEngine.evaluateFilters.mockReturnValue(true);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Simulate event from EventListener
      const eventHandler = (mockEventListener.on as jest.Mock).mock.calls
        .find(call => call[0] === 'event')?.[1];
      
      expect(eventHandler).toBeDefined();
      
      await eventHandler(mockSubscription, mockEvent);

      expect(mockFilterEngine.evaluateFilters).toHaveBeenCalledWith(
        mockEvent, 
        mockSubscription.filters
      );
      expect(mockDeliveryQueue.enqueue).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Event matches filters for subscription')
      );
      
      consoleSpy.mockRestore();
    });

    it('should filter out non-matching events', async () => {
      mockFilterEngine.evaluateFilters.mockReturnValue(false);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const eventHandler = (mockEventListener.on as jest.Mock).mock.calls
        .find(call => call[0] === 'event')?.[1];
      
      await eventHandler(mockSubscription, mockEvent);

      expect(mockFilterEngine.evaluateFilters).toHaveBeenCalledWith(
        mockEvent, 
        mockSubscription.filters
      );
      expect(mockDeliveryQueue.enqueue).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Event filtered out for subscription')
      );
      
      consoleSpy.mockRestore();
    });

    it('should create webhook deliveries for all webhooks in subscription', async () => {
      const multiWebhookSubscription: EventSubscription = {
        ...mockSubscription,
        webhooks: [
          mockWebhookConfig,
          { ...mockWebhookConfig, id: 'webhook-2', url: 'https://example2.com/webhook' }
        ]
      };

      eventProcessor.removeSubscription(mockSubscription.id);
      await eventProcessor.addSubscription(multiWebhookSubscription);

      mockFilterEngine.evaluateFilters.mockReturnValue(true);

      const eventHandler = (mockEventListener.on as jest.Mock).mock.calls
        .find(call => call[0] === 'event')?.[1];
      
      await eventHandler(multiWebhookSubscription, mockEvent);

      expect(mockDeliveryQueue.enqueue).toHaveBeenCalledTimes(2);
    });

    it('should handle processing errors gracefully', async () => {
      mockFilterEngine.evaluateFilters.mockImplementation(() => {
        throw new Error('Filter error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const eventHandler = (mockEventListener.on as jest.Mock).mock.calls
        .find(call => call[0] === 'event')?.[1];
      
      await eventHandler(mockSubscription, mockEvent);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error processing event for subscription'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Event Forwarding', () => {
    it('should forward EventListener events', () => {
      const eventProcessorSpy = jest.spyOn(eventProcessor, 'emit');

      // Simulate EventListener events
      const onCalls = (mockEventListener.on as jest.Mock).mock.calls;
      
      const startedHandler = onCalls.find(call => call[0] === 'started')?.[1];
      const stoppedHandler = onCalls.find(call => call[0] === 'stopped')?.[1];
      const errorHandler = onCalls.find(call => call[0] === 'error')?.[1];
      const connectionFailedHandler = onCalls.find(call => call[0] === 'connectionFailed')?.[1];
      const subscriptionErrorHandler = onCalls.find(call => call[0] === 'subscriptionError')?.[1];
      const eventErrorHandler = onCalls.find(call => call[0] === 'eventError')?.[1];

      startedHandler();
      stoppedHandler();
      errorHandler(new Error('test error'));
      connectionFailedHandler();
      subscriptionErrorHandler('sub-1', new Error('subscription error'));
      eventErrorHandler('sub-1', new Error('event error'));

      expect(eventProcessorSpy).toHaveBeenCalledWith('listenerStarted');
      expect(eventProcessorSpy).toHaveBeenCalledWith('listenerStopped');
      expect(eventProcessorSpy).toHaveBeenCalledWith('listenerError', expect.any(Error));
      expect(eventProcessorSpy).toHaveBeenCalledWith('connectionFailed');
      expect(eventProcessorSpy).toHaveBeenCalledWith('subscriptionError', 'sub-1', expect.any(Error));
      expect(eventProcessorSpy).toHaveBeenCalledWith('eventError', 'sub-1', expect.any(Error));
    });
  });

  describe('Statistics', () => {
    it('should return processing statistics', async () => {
      await eventProcessor.addSubscription(mockSubscription);
      await eventProcessor.start();

      const stats = await eventProcessor.getStats();

      expect(stats).toEqual(
        expect.objectContaining({
          isProcessing: true,
          subscriptionCount: 1,
          queueStats: expect.objectContaining({
            pendingCount: 0,
            processingCount: 0,
            completedCount: 0,
            failedCount: 0
          }),
          eventStats: expect.any(Object),
          filteredEvents: expect.any(Number),
          processedEvents: expect.any(Number),
          uptime: expect.any(Number)
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle start errors', async () => {
      mockEventListener.start.mockRejectedValue(new Error('Start failed'));

      await expect(withTimeout(eventProcessor.start())).rejects.toThrow('Start failed');
    });

    it('should handle stop errors', async () => {
      await withTimeout(eventProcessor.start());
      mockEventListener.stop.mockRejectedValue(new Error('Stop failed'));

      await expect(withTimeout(eventProcessor.stop())).rejects.toThrow('Stop failed');
    });

    it('should handle delivery creation errors', async () => {
      mockDeliveryQueue.enqueue.mockRejectedValue(new Error('Enqueue failed'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const eventHandler = (mockEventListener.on as jest.Mock).mock.calls
        .find(call => call[0] === 'event')?.[1];
      
      await eventHandler(mockSubscription, mockEvent);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error creating webhook delivery'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle createWebhookDeliveries Promise.allSettled errors', async () => {
      // Create a subscription with multiple webhooks where one will fail
      const multiWebhookSubscription: EventSubscription = {
        ...mockSubscription,
        webhooks: [
          mockWebhookConfig,
          { ...mockWebhookConfig, id: 'webhook-2', url: 'https://example2.com/webhook' }
        ]
      };

      eventProcessor.removeSubscription(mockSubscription.id);
      await eventProcessor.addSubscription(multiWebhookSubscription);

      // Mock enqueue to fail for the second webhook
      mockDeliveryQueue.enqueue
        .mockResolvedValueOnce(undefined) // First webhook succeeds
        .mockRejectedValueOnce(new Error('Second webhook fails')); // Second webhook fails

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const eventHandler = (mockEventListener.on as jest.Mock).mock.calls
        .find(call => call[0] === 'event')?.[1];
      
      await eventHandler(multiWebhookSubscription, mockEvent);

      // Should still process both webhooks despite one failing
      expect(mockDeliveryQueue.enqueue).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error creating webhook delivery'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    // Note: Lines 201-202 in createWebhookDeliveries cannot be covered because
    // Promise.allSettled never throws - it always resolves with results/errors
    // Lines 63, 84 are early return statements that are being executed but
    // may not be properly tracked by the coverage tool
  });

  describe('WebhookDelivery Creation and Enqueue', () => {
    beforeEach(async () => {
      await eventProcessor.addSubscription(mockSubscription);
    });

    it('should create WebhookDelivery objects for matching events', async () => {
      mockFilterEngine.evaluateFilters.mockReturnValue(true);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Simulate event from EventListener
      const eventHandler = (mockEventListener.on as jest.Mock).mock.calls
        .find(call => call[0] === 'event')?.[1];
      
      expect(eventHandler).toBeDefined();
      
      await eventHandler(mockSubscription, mockEvent);

      // Verify that enqueue was called with a WebhookDelivery object
      expect(mockDeliveryQueue.enqueue).toHaveBeenCalledTimes(1);
      
      const enqueuedDelivery = (mockDeliveryQueue.enqueue as jest.Mock).mock.calls[0][0];
      expect(enqueuedDelivery).toMatchObject({
        id: expect.any(String),
        subscriptionId: mockSubscription.id,
        webhookId: mockWebhookConfig.id,
        event: mockEvent,
        payload: expect.objectContaining({
          contractAddress: mockEvent.contractAddress,
          eventName: mockEvent.eventName,
          blockNumber: mockEvent.blockNumber,
          transactionHash: mockEvent.transactionHash,
          logIndex: mockEvent.logIndex,
          args: mockEvent.args,
          timestamp: mockEvent.timestamp.toISOString()
        }),
        attempts: 0,
        maxAttempts: mockWebhookConfig.retryAttempts,
        status: 'pending'
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Enqueued webhook delivery ${enqueuedDelivery.id} for webhook ${mockWebhookConfig.id} with ${mockWebhookConfig.format} format`)
      );
      
      consoleSpy.mockRestore();
    });

    it('should create multiple WebhookDelivery objects for subscriptions with multiple webhooks', async () => {
      const webhook2: WebhookConfig = {
        id: 'webhook-2',
        url: 'https://example2.com/webhook',
        format: 'zapier',
        headers: {},
        timeout: 30000,
        retryAttempts: 5
      };

      const multiWebhookSubscription: EventSubscription = {
        ...mockSubscription,
        webhooks: [mockWebhookConfig, webhook2]
      };

      eventProcessor.removeSubscription(mockSubscription.id);
      await eventProcessor.addSubscription(multiWebhookSubscription);

      mockFilterEngine.evaluateFilters.mockReturnValue(true);

      const eventHandler = (mockEventListener.on as jest.Mock).mock.calls
        .find(call => call[0] === 'event')?.[1];
      
      await eventHandler(multiWebhookSubscription, mockEvent);

      // Verify that enqueue was called twice
      expect(mockDeliveryQueue.enqueue).toHaveBeenCalledTimes(2);
      
      const firstDelivery = (mockDeliveryQueue.enqueue as jest.Mock).mock.calls[0][0];
      const secondDelivery = (mockDeliveryQueue.enqueue as jest.Mock).mock.calls[1][0];

      expect(firstDelivery.webhookId).toBe(mockWebhookConfig.id);
      expect(firstDelivery.maxAttempts).toBe(mockWebhookConfig.retryAttempts);
      
      expect(secondDelivery.webhookId).toBe(webhook2.id);
      expect(secondDelivery.maxAttempts).toBe(webhook2.retryAttempts);
    });

    it('should not enqueue deliveries for filtered events', async () => {
      mockFilterEngine.evaluateFilters.mockReturnValue(false);

      const eventHandler = (mockEventListener.on as jest.Mock).mock.calls
        .find(call => call[0] === 'event')?.[1];
      
      await eventHandler(mockSubscription, mockEvent);

      expect(mockDeliveryQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should handle enqueue errors gracefully', async () => {
      mockFilterEngine.evaluateFilters.mockReturnValue(true);
      mockDeliveryQueue.enqueue.mockRejectedValue(new Error('Enqueue failed'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const eventHandler = (mockEventListener.on as jest.Mock).mock.calls
        .find(call => call[0] === 'event')?.[1];
      
      await eventHandler(mockSubscription, mockEvent);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error processing event for subscription'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should create correct webhook payload structure using platform formatter', async () => {
      mockFilterEngine.evaluateFilters.mockReturnValue(true);

      const eventHandler = (mockEventListener.on as jest.Mock).mock.calls
        .find(call => call[0] === 'event')?.[1];
      
      await eventHandler(mockSubscription, mockEvent);

      const enqueuedDelivery = (mockDeliveryQueue.enqueue as jest.Mock).mock.calls[0][0];
      const payload = enqueuedDelivery.payload;

      // Since mockWebhookConfig uses 'generic' format, expect GenericFormatter output
      expect(payload).toEqual({
        contractAddress: mockEvent.contractAddress,
        eventName: mockEvent.eventName,
        blockNumber: mockEvent.blockNumber,
        transactionHash: mockEvent.transactionHash,
        logIndex: mockEvent.logIndex,
        args: mockEvent.args,
        timestamp: mockEvent.timestamp.toISOString()
      });
    });

    it('should use default retry attempts when webhook config does not specify them', async () => {
      const webhookWithoutRetries: WebhookConfig = {
        ...mockWebhookConfig,
        retryAttempts: undefined as any
      };

      const subscriptionWithoutRetries: EventSubscription = {
        ...mockSubscription,
        webhooks: [webhookWithoutRetries]
      };

      eventProcessor.removeSubscription(mockSubscription.id);
      await eventProcessor.addSubscription(subscriptionWithoutRetries);

      mockFilterEngine.evaluateFilters.mockReturnValue(true);

      const eventHandler = (mockEventListener.on as jest.Mock).mock.calls
        .find(call => call[0] === 'event')?.[1];
      
      await eventHandler(subscriptionWithoutRetries, mockEvent);

      const enqueuedDelivery = (mockDeliveryQueue.enqueue as jest.Mock).mock.calls[0][0];
      expect(enqueuedDelivery.maxAttempts).toBe(3); // Default value
    });
  });
});
