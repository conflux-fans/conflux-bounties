import { DeadLetterQueue } from '../DeadLetterQueue';
import { DatabaseConnection } from '../../../database/connection';
import { Logger } from '../../../monitoring/Logger';
import { WebhookDelivery } from '../../../types/delivery';

// Mock dependencies
jest.mock('../../../database/connection');
jest.mock('../../../monitoring/Logger');

const MockedDatabaseConnection = DatabaseConnection as jest.MockedClass<typeof DatabaseConnection>;
const MockedLogger = Logger as jest.MockedClass<typeof Logger>;

describe('DeadLetterQueue', () => {
  let deadLetterQueue: DeadLetterQueue;
  let mockDb: jest.Mocked<DatabaseConnection>;
  let mockLogger: jest.Mocked<Logger>;

  const mockDelivery: WebhookDelivery = {
    id: 'delivery-123',
    subscriptionId: 'sub-123',
    webhookId: 'webhook-123',
    event: {
      contractAddress: '0x1234567890123456789012345678901234567890',
      eventName: 'Transfer',
      blockNumber: 12345,
      transactionHash: '0xabcdef',
      logIndex: 0,
      args: { from: '0x123', to: '0x456', value: '1000' },
      timestamp: new Date()
    },
    payload: { test: 'data' },
    attempts: 3,
    maxAttempts: 3,
    status: 'failed'
  };

  beforeEach(() => {
    mockDb = new MockedDatabaseConnection({} as any) as jest.Mocked<DatabaseConnection>;
    mockLogger = new MockedLogger() as jest.Mocked<Logger>;

    deadLetterQueue = new DeadLetterQueue(mockDb, mockLogger, {
      maxRetentionDays: 7,
      cleanupInterval: 1000
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    deadLetterQueue.stopCleanup();
  });

  describe('addFailedDelivery', () => {
    it('should add failed delivery to dead letter queue', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 1 });

      await deadLetterQueue.addFailedDelivery(
        mockDelivery,
        'Max retries exceeded',
        'Connection timeout'
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO dead_letter_queue'),
        expect.arrayContaining([
          'delivery-123',
          'sub-123',
          'webhook-123',
          expect.any(String), // JSON stringified event
          expect.any(String), // JSON stringified payload
          'Max retries exceeded',
          expect.any(Date),
          3,
          'Connection timeout'
        ])
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Delivery added to dead letter queue',
        expect.objectContaining({
          deliveryId: 'delivery-123',
          subscriptionId: 'sub-123',
          webhookId: 'webhook-123'
        })
      );
    });

    it('should handle database errors when adding failed delivery', async () => {
      const dbError = new Error('Database connection failed');
      mockDb.query = jest.fn().mockRejectedValue(dbError);

      await expect(deadLetterQueue.addFailedDelivery(
        mockDelivery,
        'Max retries exceeded',
        'Connection timeout'
      )).rejects.toThrow('Database connection failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to add delivery to dead letter queue',
        dbError,
        { deliveryId: 'delivery-123' }
      );
    });
  });

  describe('getFailedDeliveries', () => {
    it('should retrieve failed deliveries with default pagination', async () => {
      const mockRows = [
        {
          id: 'delivery-123',
          subscription_id: 'sub-123',
          webhook_id: 'webhook-123',
          event_data: JSON.stringify(mockDelivery.event),
          payload: JSON.stringify(mockDelivery.payload),
          failure_reason: 'Max retries exceeded',
          failed_at: new Date(),
          attempts: 3,
          last_error: 'Connection timeout'
        }
      ];

      mockDb.query = jest.fn().mockResolvedValue({ rows: mockRows });

      const result = await deadLetterQueue.getFailedDeliveries();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [100, 0]
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('delivery-123');
      expect(result[0]?.failureReason).toBe('Max retries exceeded');
    });

    it('should handle custom pagination parameters', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      await deadLetterQueue.getFailedDeliveries(50, 25);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [50, 25]
      );
    });

    it('should handle database errors when retrieving deliveries', async () => {
      const dbError = new Error('Query failed');
      mockDb.query = jest.fn().mockRejectedValue(dbError);

      await expect(deadLetterQueue.getFailedDeliveries()).rejects.toThrow('Query failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to retrieve dead letter queue entries',
        dbError
      );
    });
  });

  describe('getFailedDeliveriesForWebhook', () => {
    it('should retrieve failed deliveries for specific webhook', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      await deadLetterQueue.getFailedDeliveriesForWebhook('webhook-123', 25);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE webhook_id = $1'),
        ['webhook-123', 25]
      );
    });

    it('should handle database errors when retrieving webhook deliveries', async () => {
      const dbError = new Error('Query failed');
      mockDb.query = jest.fn().mockRejectedValue(dbError);

      await expect(deadLetterQueue.getFailedDeliveriesForWebhook('webhook-123'))
        .rejects.toThrow('Query failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to retrieve dead letter queue entries for webhook',
        dbError,
        { webhookId: 'webhook-123' }
      );
    });
  });

  describe('getStats', () => {
    it('should return dead letter queue statistics', async () => {
      mockDb.query = jest.fn()
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // total
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })  // last 24h
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })  // last 7d
        .mockResolvedValueOnce({ rows: [             // top reasons
          { reason: 'Connection timeout', count: '5' },
          { reason: 'Max retries exceeded', count: '3' }
        ]});

      const stats = await deadLetterQueue.getStats();

      expect(stats).toEqual({
        totalEntries: 10,
        entriesLast24h: 2,
        entriesLast7d: 5,
        topFailureReasons: [
          { reason: 'Connection timeout', count: 5 },
          { reason: 'Max retries exceeded', count: 3 }
        ]
      });

      expect(mockDb.query).toHaveBeenCalledTimes(4);
    });

    it('should handle database errors when getting stats', async () => {
      const dbError = new Error('Stats query failed');
      mockDb.query = jest.fn().mockRejectedValue(dbError);

      await expect(deadLetterQueue.getStats()).rejects.toThrow('Stats query failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get dead letter queue statistics',
        dbError
      );
    });
  });

  describe('retryDelivery', () => {
    it('should retrieve and remove delivery for retry', async () => {
      const mockRow = {
        id: 'delivery-123',
        subscription_id: 'sub-123',
        webhook_id: 'webhook-123',
        event_data: JSON.stringify(mockDelivery.event),
        payload: JSON.stringify(mockDelivery.payload),
        attempts: 3
      };

      mockDb.query = jest.fn()
        .mockResolvedValueOnce({ rows: [mockRow] }) // SELECT
        .mockResolvedValueOnce({ rowCount: 1 });    // DELETE

      const result = await deadLetterQueue.retryDelivery('delivery-123');

      expect(result).toBeDefined();
      expect(result!.id).toBe('delivery-123');
      expect(result!.attempts).toBe(0); // Reset for retry
      expect(result!.status).toBe('pending');

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Delivery retrieved from dead letter queue for retry',
        { deliveryId: 'delivery-123' }
      );
    });

    it('should return null for non-existent delivery', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await deadLetterQueue.retryDelivery('non-existent');

      expect(result).toBeNull();
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors when retrying delivery', async () => {
      const dbError = new Error('Retry failed');
      mockDb.query = jest.fn().mockRejectedValue(dbError);

      await expect(deadLetterQueue.retryDelivery('delivery-123'))
        .rejects.toThrow('Retry failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to retry delivery from dead letter queue',
        dbError,
        { entryId: 'delivery-123' }
      );
    });
  });

  describe('removeEntry', () => {
    it('should remove entry from dead letter queue', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rowCount: 1 });

      await deadLetterQueue.removeEntry('delivery-123');

      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM dead_letter_queue WHERE id = $1',
        ['delivery-123']
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Entry removed from dead letter queue',
        { entryId: 'delivery-123' }
      );
    });

    it('should handle database errors when removing entry', async () => {
      const dbError = new Error('Delete failed');
      mockDb.query = jest.fn().mockRejectedValue(dbError);

      await expect(deadLetterQueue.removeEntry('delivery-123'))
        .rejects.toThrow('Delete failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to remove entry from dead letter queue',
        dbError,
        { entryId: 'delivery-123' }
      );
    });
  });

  describe('cleanup functionality', () => {
    it('should start and stop cleanup timer', () => {
      jest.useFakeTimers();

      deadLetterQueue.startCleanup();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Dead letter queue cleanup started',
        expect.objectContaining({
          maxRetentionDays: 7,
          cleanupInterval: 1000
        })
      );

      deadLetterQueue.stopCleanup();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Dead letter queue cleanup stopped'
      );

      jest.useRealTimers();
    });

    it('should perform cleanup of old entries', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rowCount: 5 });

      // Test the cleanup method directly
      await (deadLetterQueue as any).cleanupOldEntries();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringMatching(/DELETE\s+FROM\s+dead_letter_queue[\s\S]*WHERE\s+failed_at\s+<\s+NOW\(\)\s+-\s+INTERVAL\s+'7\s+days'/)
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Dead letter queue cleanup completed',
        expect.objectContaining({
          deletedEntries: 5,
          retentionDays: 7
        })
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      const cleanupError = new Error('Cleanup failed');
      mockDb.query = jest.fn().mockRejectedValue(cleanupError);

      // Test the cleanup method directly to verify error handling
      await expect((deadLetterQueue as any).cleanupOldEntries()).rejects.toThrow('Cleanup failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to cleanup old dead letter queue entries',
        cleanupError
      );
    });
  });
});