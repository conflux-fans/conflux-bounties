import { EventProcessor } from '../../src/listeners/EventProcessor';
import { EventListener } from '../../src/listeners/EventListener';
import { FilterEngine } from '../../src/filtering/FilterEngine';
import { DatabaseConnection } from '../../src/database/connection';
import type { IDeliveryQueue } from '../../src/webhooks/queue/interfaces';
import type { EventSubscription } from '../../src/types';

describe('Array Subscriptions Integration', () => {
  let eventProcessor: EventProcessor;
  let mockEventListener: jest.Mocked<EventListener>;
  let mockFilterEngine: jest.Mocked<FilterEngine>;
  let mockDatabase: jest.Mocked<DatabaseConnection>;
  let mockDeliveryQueue: jest.Mocked<IDeliveryQueue>;

  beforeEach(() => {
    mockEventListener = {
      addSubscription: jest.fn(),
      removeSubscription: jest.fn(),
      getSubscriptions: jest.fn().mockReturnValue([]),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      isListening: jest.fn().mockReturnValue(true),
      getEventStatistics: jest.fn().mockReturnValue({
        uptime: 0,
        totalEvents: 0,
        eventsByContract: {},
        eventsByType: {},
        lastEventTime: null,
        subscriptionCount: 0
      }),
      displayEventStatus: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn()
    } as any;

    mockFilterEngine = {
      evaluateFilters: jest.fn().mockReturnValue(true)
    } as any;

    mockDatabase = {
      query: jest.fn()
    } as any;

    mockDeliveryQueue = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockResolvedValue({
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0
      })
    } as any;

    eventProcessor = new EventProcessor(
      mockEventListener,
      mockFilterEngine,
      mockDatabase,
      mockDeliveryQueue
    );
  });

  describe('Multiple Contract Addresses', () => {
    it('should handle subscription with multiple contract addresses', async () => {
      const subscription: EventSubscription = {
        id: 'multi-contract-test',
        contractAddress: [
          '0x1234567890123456789012345678901234567890',
          '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
        ],
        eventSignature: 'Transfer(address,address,uint256)',
        filters: {},
        webhooks: []
      };

      // Mock database responses
      (mockDatabase.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Check existing subscription
        .mockResolvedValueOnce({ rows: [] }); // Insert subscription

      await eventProcessor.addSubscription(subscription);

      // Verify database was called with JSON arrays
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO subscriptions'),
        expect.arrayContaining([
          subscription.id,
          subscription.id,
          JSON.stringify(subscription.contractAddress), // Should be JSON array
          JSON.stringify([subscription.eventSignature]), // Should be JSON array
          '{}',
          true
        ])
      );

      // Verify EventListener received the subscription
      expect(mockEventListener.addSubscription).toHaveBeenCalledWith(subscription);
    });

    it('should handle subscription with single contract address', async () => {
      const subscription: EventSubscription = {
        id: 'single-contract-test',
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventSignature: 'Transfer(address,address,uint256)',
        filters: {},
        webhooks: []
      };

      // Mock database responses
      (mockDatabase.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Check existing subscription
        .mockResolvedValueOnce({ rows: [] }); // Insert subscription

      await eventProcessor.addSubscription(subscription);

      // Verify database was called with JSON arrays (single value converted to array)
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO subscriptions'),
        expect.arrayContaining([
          subscription.id,
          subscription.id,
          JSON.stringify([subscription.contractAddress]), // Should be JSON array
          JSON.stringify([subscription.eventSignature]), // Should be JSON array
          '{}',
          true
        ])
      );
    });
  });

  describe('Multiple Event Signatures', () => {
    it('should handle subscription with multiple event signatures', async () => {
      const subscription: EventSubscription = {
        id: 'multi-event-test',
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventSignature: [
          'Transfer(address,address,uint256)',
          'Approval(address,address,uint256)',
          'Deposit(address,uint256)'
        ],
        filters: {},
        webhooks: []
      };

      // Mock database responses
      (mockDatabase.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Check existing subscription
        .mockResolvedValueOnce({ rows: [] }); // Insert subscription

      await eventProcessor.addSubscription(subscription);

      // Verify database was called with JSON arrays
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO subscriptions'),
        expect.arrayContaining([
          subscription.id,
          subscription.id,
          JSON.stringify([subscription.contractAddress]), // Should be JSON array
          JSON.stringify(subscription.eventSignature), // Should be JSON array
          '{}',
          true
        ])
      );
    });
  });

  describe('Loading from Database', () => {
    it('should load subscriptions with arrays from database', async () => {
      const mockSubscriptionRows = [
        {
          id: 'db-subscription-1',
          name: 'Test Subscription',
          contract_address: JSON.stringify([
            '0x1234567890123456789012345678901234567890',
            '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
          ]),
          event_signature: JSON.stringify([
            'Transfer(address,address,uint256)',
            'Approval(address,address,uint256)'
          ]),
          filters: '{}',
          active: true
        }
      ];

      const mockWebhookRows = [
        {
          id: 'webhook-1',
          url: 'https://example.com/webhook',
          format: 'generic',
          headers: '{}',
          timeout: 30000,
          retry_attempts: 3
        }
      ];

      // Mock database responses
      (mockDatabase.query as jest.Mock)
        .mockResolvedValueOnce({ rows: mockSubscriptionRows }) // Load subscriptions
        .mockResolvedValueOnce({ rows: mockWebhookRows }); // Load webhooks

      await eventProcessor.loadSubscriptionsFromDatabase();

      // Verify EventListener received the subscription with arrays
      expect(mockEventListener.addSubscription).toHaveBeenCalledWith({
        id: 'db-subscription-1',
        contractAddress: [
          '0x1234567890123456789012345678901234567890',
          '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
        ],
        eventSignature: [
          'Transfer(address,address,uint256)',
          'Approval(address,address,uint256)'
        ],
        filters: {},
        webhooks: [{
          id: 'webhook-1',
          url: 'https://example.com/webhook',
          format: 'generic',
          headers: {},
          timeout: 30000,
          retryAttempts: 3
        }]
      });
    });

    it('should handle database loading errors gracefully', async () => {
      (mockDatabase.query as jest.Mock).mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(eventProcessor.loadSubscriptionsFromDatabase()).rejects.toThrow('Database connection failed');
    });

    it('should handle malformed JSON in database gracefully', async () => {
      const mockSubscriptionRows = [
        {
          id: 'malformed-subscription',
          name: 'Test Subscription',
          contract_address: 'invalid-json',
          event_signature: '["Transfer(address,address,uint256)"]',
          filters: '{}',
          active: true
        }
      ];

      (mockDatabase.query as jest.Mock).mockResolvedValueOnce({ rows: mockSubscriptionRows });

      // Should not throw, but should log error and continue
      await eventProcessor.loadSubscriptionsFromDatabase();

      // Should not have added the malformed subscription
      expect(mockEventListener.addSubscription).not.toHaveBeenCalled();
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle subscription with both multiple contracts and events', async () => {
      const subscription: EventSubscription = {
        id: 'complex-subscription',
        contractAddress: [
          '0x1234567890123456789012345678901234567890',
          '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          '0x9876543210987654321098765432109876543210'
        ],
        eventSignature: [
          'Transfer(address,address,uint256)',
          'Approval(address,address,uint256)',
          'Deposit(address,uint256)',
          'Withdrawal(address,uint256)'
        ],
        filters: {
          value: { operator: 'gt', value: '1000000000000000000' }
        },
        webhooks: [
          {
            id: 'webhook-1',
            url: 'https://hooks.zapier.com/test',
            format: 'zapier',
            headers: { 'Authorization': 'Bearer token123' },
            timeout: 30000,
            retryAttempts: 3
          }
        ]
      };

      // Mock database responses
      (mockDatabase.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Check existing subscription
        .mockResolvedValueOnce({ rows: [] }) // Insert subscription
        .mockResolvedValueOnce({ rows: [] }); // Insert webhook

      await eventProcessor.addSubscription(subscription);

      // Verify database storage
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO subscriptions'),
        expect.arrayContaining([
          subscription.id,
          subscription.id,
          JSON.stringify(subscription.contractAddress),
          JSON.stringify(subscription.eventSignature),
          JSON.stringify(subscription.filters),
          true
        ])
      );

      // Verify EventListener received the subscription
      expect(mockEventListener.addSubscription).toHaveBeenCalledWith(subscription);
    });
  });

  describe('Array Format Validation', () => {
    it('should normalize single values to arrays for database storage', async () => {
      const subscription: EventSubscription = {
        id: 'normalization-test',
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventSignature: 'Transfer(address,address,uint256)',
        filters: {},
        webhooks: []
      };

      (mockDatabase.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await eventProcessor.addSubscription(subscription);

      // Verify single values were converted to arrays for database storage
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO subscriptions'),
        expect.arrayContaining([
          subscription.id,
          subscription.id,
          JSON.stringify([subscription.contractAddress]), // Single -> Array
          JSON.stringify([subscription.eventSignature]), // Single -> Array
          '{}',
          true
        ])
      );
    });

    it('should preserve arrays as-is for database storage', async () => {
      const subscription: EventSubscription = {
        id: 'array-preservation-test',
        contractAddress: [
          '0x1234567890123456789012345678901234567890',
          '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
        ],
        eventSignature: [
          'Transfer(address,address,uint256)',
          'Approval(address,address,uint256)'
        ],
        filters: {},
        webhooks: []
      };

      (mockDatabase.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await eventProcessor.addSubscription(subscription);

      // Verify arrays were preserved as-is
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO subscriptions'),
        expect.arrayContaining([
          subscription.id,
          subscription.id,
          JSON.stringify(subscription.contractAddress), // Array preserved
          JSON.stringify(subscription.eventSignature), // Array preserved
          '{}',
          true
        ])
      );
    });
  });
});