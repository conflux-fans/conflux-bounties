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

    // Create EventProcessor instance
    eventProcessor = new EventProcessor(
      mockEventListener,
      mockFilterEngine,
      mockDeliveryQueue
    );
  });

  describe('Lifecycle Management', () => {
    it('should start successfully', async () => {
      await eventProcessor.start();

      expect(mockEventListener.start).toHaveBeenCalled();
      expect(mockDeliveryQueue.startProcessing).toHaveBeenCalled();
      expect(eventProcessor.isProcessing()).toBe(true);
    });

    it('should stop successfully', async () => {
      await eventProcessor.start();
      await eventProcessor.stop();

      expect(mockDeliveryQueue.stopProcessing).toHaveBeenCalled();
      expect(mockEventListener.stop).toHaveBeenCalled();
      expect(eventProcessor.isProcessing()).toBe(false);
    });

    it('should not start if already running', async () => {
      await eventProcessor.start();
      await eventProcessor.start(); // Second call

      expect(mockEventListener.start).toHaveBeenCalledTimes(1);
    });

    it('should not stop if not running', async () => {
      await eventProcessor.stop();

      expect(mockEventListener.stop).not.toHaveBeenCalled();
    });
  });

  describe('Subscription Management', () => {
    it('should add subscription successfully', () => {
      eventProcessor.addSubscription(mockSubscription);

      expect(mockEventListener.addSubscription).toHaveBeenCalledWith(mockSubscription);
      expect(eventProcessor.getSubscriptions()).toContain(mockSubscription);
    });

    it('should remove subscription successfully', () => {
      eventProcessor.addSubscription(mockSubscription);
      eventProcessor.removeSubscription(mockSubscription.id);

      expect(mockEventListener.removeSubscription).toHaveBeenCalledWith(mockSubscription.id);
      expect(eventProcessor.getSubscriptions()).not.toContain(mockSubscription);
    });

    it('should validate subscription before adding', () => {
      const invalidSubscription = {
        id: '',
        contractAddress: '',
        eventSignature: '',
        filters: {},
        webhooks: []
      } as EventSubscription;

      expect(() => {
        eventProcessor.addSubscription(invalidSubscription);
      }).toThrow('Invalid subscription: missing required fields');
    });

    it('should handle removing non-existent subscription gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      eventProcessor.removeSubscription('non-existent');
      
      expect(consoleSpy).toHaveBeenCalledWith('Subscription non-existent not found');
      consoleSpy.mockRestore();
    });
  });

  describe('Event Processing Pipeline', () => {
    beforeEach(() => {
      eventProcessor.addSubscription(mockSubscription);
    });

    it('should process matching events successfully', async () => {
      mockFilterEngine.evaluateFilters.mockReturnValue(true);

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
    });

    it('should filter out non-matching events', async () => {
      mockFilterEngine.evaluateFilters.mockReturnValue(false);

      const eventHandler = (mockEventListener.on as jest.Mock).mock.calls
        .find(call => call[0] === 'event')?.[1];
      
      await eventHandler(mockSubscription, mockEvent);

      expect(mockFilterEngine.evaluateFilters).toHaveBeenCalledWith(
        mockEvent, 
        mockSubscription.filters
      );
      expect(mockDeliveryQueue.enqueue).not.toHaveBeenCalled();
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
      eventProcessor.addSubscription(multiWebhookSubscription);

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

      startedHandler();
      stoppedHandler();
      errorHandler(new Error('test error'));

      expect(eventProcessorSpy).toHaveBeenCalledWith('listenerStarted');
      expect(eventProcessorSpy).toHaveBeenCalledWith('listenerStopped');
      expect(eventProcessorSpy).toHaveBeenCalledWith('listenerError', expect.any(Error));
    });
  });

  describe('Statistics', () => {
    it('should return processing statistics', async () => {
      eventProcessor.addSubscription(mockSubscription);
      await eventProcessor.start();

      const stats = await eventProcessor.getStats();

      expect(stats).toEqual({
        isProcessing: true,
        subscriptionCount: 1,
        queueStats: expect.objectContaining({
          pendingCount: 0,
          processingCount: 0,
          completedCount: 0,
          failedCount: 0
        })
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle start errors', async () => {
      mockEventListener.start.mockRejectedValue(new Error('Start failed'));

      await expect(eventProcessor.start()).rejects.toThrow('Start failed');
    });

    it('should handle stop errors', async () => {
      await eventProcessor.start();
      mockEventListener.stop.mockRejectedValue(new Error('Stop failed'));

      await expect(eventProcessor.stop()).rejects.toThrow('Stop failed');
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
  });
});