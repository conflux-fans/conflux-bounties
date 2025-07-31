import { EventProcessor } from '../EventProcessor';
import { EventListener } from '../EventListener';
import { FilterEngine } from '../../filtering/FilterEngine';
import { DeliveryQueue } from '../../webhooks/queue/DeliveryQueue';
import { DatabaseConnection } from '../../database/connection';
import type { 
  EventSubscription, 
  BlockchainEvent, 
  WebhookConfig,
  NetworkConfig,
  DatabaseConfig,
  WebhookDelivery
} from '../../types';

describe('Event Processing Integration', () => {
  let eventProcessor: EventProcessor;
  let eventListener: EventListener;
  let filterEngine: FilterEngine;
  let deliveryQueue: DeliveryQueue;
  let db: DatabaseConnection;

  const mockNetworkConfig: NetworkConfig = {
    rpcUrl: 'https://test.confluxrpc.com',
    wsUrl: 'wss://test.confluxrpc.com/ws',
    chainId: 1,
    confirmations: 1
  };

  const mockDbConfig: DatabaseConfig = {
    url: 'postgresql://test:test@localhost:5432/test',
    poolSize: 5,
    connectionTimeout: 5000
  };

  const mockWebhookConfig: WebhookConfig = {
    id: 'webhook-1',
    url: 'https://example.com/webhook',
    format: 'generic',
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
    retryAttempts: 3
  };

  const mockSubscription: EventSubscription = {
    id: 'sub-1',
    contractAddress: '0x1234567890123456789012345678901234567890',
    eventSignature: 'Transfer(address indexed from, address indexed to, uint256 value)',
    filters: { 
      'args.from': '0xabcd1234567890123456789012345678901234abcd',
      'args.value': { operator: 'gt', value: '1000' }
    },
    webhooks: [mockWebhookConfig]
  };

  beforeEach(() => {
    // Create real instances for integration testing
    db = new DatabaseConnection(mockDbConfig);
    eventListener = new EventListener(mockNetworkConfig);
    filterEngine = new FilterEngine();
    deliveryQueue = new DeliveryQueue(db, {
      maxConcurrentDeliveries: 5,
      processingInterval: 100
    });

    eventProcessor = new EventProcessor(
      eventListener,
      filterEngine,
      deliveryQueue
    );

    // Mock database operations for all tests
    jest.spyOn(db, 'query').mockResolvedValue({ rows: [], rowCount: 0 } as any);
  });

  afterEach(async () => {
    // Clean up
    if (eventProcessor.isProcessing()) {
      await eventProcessor.stop();
    }
    jest.restoreAllMocks();
  });

  describe('Complete Event Flow', () => {
    it('should process events through the complete pipeline', async () => {
      // Mock EventListener methods to avoid blockchain connection
      jest.spyOn(eventListener, 'start').mockResolvedValue();
      jest.spyOn(eventListener, 'stop').mockResolvedValue();
      jest.spyOn(eventListener, 'addSubscription').mockImplementation();
      jest.spyOn(eventListener, 'isListening').mockReturnValue(true);

      // Track processed deliveries
      const processedDeliveries: WebhookDelivery[] = [];
      jest.spyOn(deliveryQueue, 'startProcessing').mockImplementation((processor) => {
        // Store the processor for later use
        (deliveryQueue as any)._testProcessor = processor;
      });
      jest.spyOn(deliveryQueue, 'enqueue').mockImplementation(async (delivery) => {
        // Simulate immediate processing
        processedDeliveries.push(delivery);
        if ((deliveryQueue as any)._testProcessor) {
          await (deliveryQueue as any)._testProcessor(delivery);
        }
      });

      // Start the event processor
      await eventProcessor.start();

      // Add subscription
      eventProcessor.addSubscription(mockSubscription);

      // Simulate a blockchain event that matches the filters
      const matchingEvent: BlockchainEvent = {
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventName: 'Transfer',
        blockNumber: 12345,
        transactionHash: '0xabcdef1234567890',
        logIndex: 0,
        args: {
          from: '0xabcd1234567890123456789012345678901234abcd',
          to: '0xefgh1234567890123456789012345678901234efgh',
          value: '2000' // Greater than 1000, should match filter
        },
        timestamp: new Date()
      };

      // Emit the event directly to test the processing pipeline
      eventListener.emit('event', mockSubscription, matchingEvent);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify the event was processed
      expect(processedDeliveries).toHaveLength(1);
      expect(processedDeliveries[0]).toMatchObject({
        subscriptionId: mockSubscription.id,
        webhookId: mockWebhookConfig.id,
        event: matchingEvent,
        status: 'pending'
      });
    });

    it('should filter out events that do not match criteria', async () => {
      // Mock EventListener methods
      jest.spyOn(eventListener, 'start').mockResolvedValue();
      jest.spyOn(eventListener, 'stop').mockResolvedValue();
      jest.spyOn(eventListener, 'addSubscription').mockImplementation();
      jest.spyOn(eventListener, 'isListening').mockReturnValue(true);

      // Track processed deliveries
      const processedDeliveries: WebhookDelivery[] = [];
      jest.spyOn(deliveryQueue, 'startProcessing').mockImplementation();
      jest.spyOn(deliveryQueue, 'enqueue').mockImplementation(async (delivery) => {
        processedDeliveries.push(delivery);
      });

      // Start the event processor
      await eventProcessor.start();

      // Add subscription
      eventProcessor.addSubscription(mockSubscription);

      // Simulate a blockchain event that does NOT match the filters
      const nonMatchingEvent: BlockchainEvent = {
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventName: 'Transfer',
        blockNumber: 12345,
        transactionHash: '0xabcdef1234567890',
        logIndex: 0,
        args: {
          from: '0xdifferent1234567890123456789012345678901234', // Different from filter
          to: '0xefgh1234567890123456789012345678901234efgh',
          value: '500' // Less than 1000, should not match filter
        },
        timestamp: new Date()
      };

      // Emit the event
      eventListener.emit('event', mockSubscription, nonMatchingEvent);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify the event was filtered out
      expect(processedDeliveries).toHaveLength(0);
    });

    it('should handle multiple subscriptions with different filters', async () => {
      // Mock EventListener methods
      jest.spyOn(eventListener, 'start').mockResolvedValue();
      jest.spyOn(eventListener, 'stop').mockResolvedValue();
      jest.spyOn(eventListener, 'addSubscription').mockImplementation();
      jest.spyOn(eventListener, 'isListening').mockReturnValue(true);

      // Track processed deliveries
      const processedDeliveries: WebhookDelivery[] = [];
      jest.spyOn(deliveryQueue, 'startProcessing').mockImplementation();
      jest.spyOn(deliveryQueue, 'enqueue').mockImplementation(async (delivery) => {
        processedDeliveries.push(delivery);
      });

      // Create second subscription with different filters
      const subscription2: EventSubscription = {
        id: 'sub-2',
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventSignature: 'Transfer(address indexed from, address indexed to, uint256 value)',
        filters: { 
          'args.to': '0xspecial1234567890123456789012345678901234'
        },
        webhooks: [{
          ...mockWebhookConfig,
          id: 'webhook-2',
          url: 'https://example2.com/webhook'
        }]
      };

      // Start the event processor
      await eventProcessor.start();

      // Add both subscriptions
      eventProcessor.addSubscription(mockSubscription);
      eventProcessor.addSubscription(subscription2);

      // Create an event that matches both subscriptions
      const event: BlockchainEvent = {
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventName: 'Transfer',
        blockNumber: 12345,
        transactionHash: '0xabcdef1234567890',
        logIndex: 0,
        args: {
          from: '0xabcd1234567890123456789012345678901234abcd', // Matches sub-1
          to: '0xspecial1234567890123456789012345678901234', // Matches sub-2
          value: '2000' // Matches sub-1 (gt 1000)
        },
        timestamp: new Date()
      };

      // Emit the event for both subscriptions
      eventListener.emit('event', mockSubscription, event);
      eventListener.emit('event', subscription2, event);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify both subscriptions processed the event
      expect(processedDeliveries).toHaveLength(2);
      expect(processedDeliveries.map(d => d.subscriptionId)).toContain('sub-1');
      expect(processedDeliveries.map(d => d.subscriptionId)).toContain('sub-2');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle filter evaluation errors gracefully', async () => {
      // Mock EventListener methods
      jest.spyOn(eventListener, 'start').mockResolvedValue();
      jest.spyOn(eventListener, 'stop').mockResolvedValue();
      jest.spyOn(eventListener, 'addSubscription').mockImplementation();
      jest.spyOn(eventListener, 'isListening').mockReturnValue(true);

      // Mock filter engine to throw error
      jest.spyOn(filterEngine, 'evaluateFilters').mockImplementation(() => {
        throw new Error('Filter evaluation failed');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Start the event processor
      await eventProcessor.start();
      eventProcessor.addSubscription(mockSubscription);

      // Emit an event
      const event: BlockchainEvent = {
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventName: 'Transfer',
        blockNumber: 12345,
        transactionHash: '0xabcdef1234567890',
        logIndex: 0,
        args: { from: '0xabcd', to: '0xefgh', value: '1000' },
        timestamp: new Date()
      };

      eventListener.emit('event', mockSubscription, event);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error processing event for subscription'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle delivery queue errors gracefully', async () => {
      // Mock EventListener methods
      jest.spyOn(eventListener, 'start').mockResolvedValue();
      jest.spyOn(eventListener, 'stop').mockResolvedValue();
      jest.spyOn(eventListener, 'addSubscription').mockImplementation();
      jest.spyOn(eventListener, 'isListening').mockReturnValue(true);

      // Mock delivery queue to throw error
      jest.spyOn(deliveryQueue, 'enqueue').mockRejectedValue(new Error('Queue error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Start the event processor
      await eventProcessor.start();
      eventProcessor.addSubscription(mockSubscription);

      // Emit a matching event
      const event: BlockchainEvent = {
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventName: 'Transfer',
        blockNumber: 12345,
        transactionHash: '0xabcdef1234567890',
        logIndex: 0,
        args: {
          from: '0xabcd1234567890123456789012345678901234abcd',
          to: '0xefgh1234567890123456789012345678901234efgh',
          value: '2000'
        },
        timestamp: new Date()
      };

      eventListener.emit('event', mockSubscription, event);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error creating webhook delivery'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Subscription Management Integration', () => {
    it('should properly manage subscription lifecycle', async () => {
      // Mock EventListener methods
      jest.spyOn(eventListener, 'start').mockResolvedValue();
      jest.spyOn(eventListener, 'stop').mockResolvedValue();
      const addSubscriptionSpy = jest.spyOn(eventListener, 'addSubscription').mockImplementation();
      const removeSubscriptionSpy = jest.spyOn(eventListener, 'removeSubscription').mockImplementation();
      jest.spyOn(eventListener, 'isListening').mockReturnValue(true);

      // Start the event processor
      await eventProcessor.start();

      // Add subscription
      eventProcessor.addSubscription(mockSubscription);
      expect(addSubscriptionSpy).toHaveBeenCalledWith(mockSubscription);
      expect(eventProcessor.getSubscriptions()).toHaveLength(1);

      // Remove subscription
      eventProcessor.removeSubscription(mockSubscription.id);
      expect(removeSubscriptionSpy).toHaveBeenCalledWith(mockSubscription.id);
      expect(eventProcessor.getSubscriptions()).toHaveLength(0);
    });
  });
});