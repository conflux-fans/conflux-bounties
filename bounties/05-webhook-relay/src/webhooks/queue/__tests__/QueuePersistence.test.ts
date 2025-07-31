import { QueuePersistence } from '../QueuePersistence';
import { DatabaseConnection } from '../../../database/connection';
import type { WebhookDelivery } from '../../../types';

// Mock the DatabaseConnection
jest.mock('../../../database/connection');

describe('QueuePersistence', () => {
  let persistence: QueuePersistence;
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
    mockDb = {
      query: jest.fn(),
      transaction: jest.fn(),
      getClient: jest.fn(),
      healthCheck: jest.fn(),
      close: jest.fn(),
      getPoolInfo: jest.fn()
    } as any;

    persistence = new QueuePersistence(mockDb);
  });

  describe('saveDelivery', () => {
    it('should insert delivery into database', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await persistence.saveDelivery(mockDelivery);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO deliveries'),
        expect.arrayContaining([
          mockDelivery.id,
          mockDelivery.subscriptionId,
          mockDelivery.webhookId,
          JSON.stringify(mockDelivery.event),
          JSON.stringify(mockDelivery.payload),
          mockDelivery.status,
          mockDelivery.attempts,
          mockDelivery.maxAttempts,
          null // nextRetry
        ])
      );
    });

    it('should handle delivery with nextRetry date', async () => {
      const deliveryWithRetry = { 
        ...mockDelivery, 
        nextRetry: new Date('2023-01-01T10:00:00Z') 
      };
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await persistence.saveDelivery(deliveryWithRetry);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO deliveries'),
        expect.arrayContaining([
          deliveryWithRetry.nextRetry
        ])
      );
    });
  });

  describe('getNextDelivery', () => {
    it('should return next pending delivery', async () => {
      const mockRow = {
        id: mockDelivery.id,
        subscription_id: mockDelivery.subscriptionId,
        webhook_id: mockDelivery.webhookId,
        event_data: JSON.stringify(mockDelivery.event),
        payload: JSON.stringify(mockDelivery.payload),
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
        next_retry: null,
        created_at: new Date()
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [mockRow] }) // SELECT
          .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // UPDATE
      };

      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockClient as any);
      });

      const result = await persistence.getNextDelivery();

      expect(result).toEqual({
        id: mockDelivery.id,
        subscriptionId: mockDelivery.subscriptionId,
        webhookId: mockDelivery.webhookId,
        event: expect.objectContaining({
          contractAddress: mockDelivery.event.contractAddress,
          eventName: mockDelivery.event.eventName,
          blockNumber: mockDelivery.event.blockNumber,
          transactionHash: mockDelivery.event.transactionHash,
          logIndex: mockDelivery.event.logIndex,
          args: mockDelivery.event.args,
          timestamp: expect.any(String) // JSON parsing converts Date to string
        }),
        payload: mockDelivery.payload,
        status: 'processing',
        attempts: 0,
        maxAttempts: 3,
        nextRetry: null
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT')
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE deliveries'),
        [mockDelivery.id]
      );
    });

    it('should return null when no deliveries available', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] })
      };

      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockClient as any);
      });

      const result = await persistence.getNextDelivery();

      expect(result).toBeNull();
    });
  });

  describe('updateDeliveryStatus', () => {
    it('should update delivery status without error', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await persistence.updateDeliveryStatus('delivery-1', 'completed');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE deliveries'),
        ['delivery-1', 'completed', null]
      );
    });

    it('should update delivery status with error message', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await persistence.updateDeliveryStatus('delivery-1', 'failed', 'Network error');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE deliveries'),
        ['delivery-1', 'failed', 'Network error']
      );
    });
  });

  describe('updateRetrySchedule', () => {
    it('should update retry schedule', async () => {
      const nextRetry = new Date('2023-01-01T10:00:00Z');
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await persistence.updateRetrySchedule('delivery-1', nextRetry, 2);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE deliveries'),
        ['delivery-1', nextRetry, 2]
      );
    });
  });

  describe('getQueueMetrics', () => {
    it('should return queue metrics', async () => {
      const mockRows = [
        { status: 'pending', count: '5' },
        { status: 'processing', count: '2' },
        { status: 'completed', count: '10' },
        { status: 'failed', count: '1' }
      ];

      mockDb.query.mockResolvedValue({ rows: mockRows });

      const metrics = await persistence.getQueueMetrics();

      expect(metrics).toEqual({
        pendingCount: 5,
        processingCount: 2,
        completedCount: 10,
        failedCount: 1
      });
    });

    it('should return zero counts for missing statuses', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ status: 'pending', count: '3' }] });

      const metrics = await persistence.getQueueMetrics();

      expect(metrics).toEqual({
        pendingCount: 3,
        processingCount: 0,
        completedCount: 0,
        failedCount: 0
      });
    });
  });

  describe('cleanupCompletedDeliveries', () => {
    it('should delete old completed deliveries', async () => {
      const olderThan = new Date('2023-01-01T00:00:00Z');
      mockDb.query.mockResolvedValue({ rowCount: 5 });

      const deletedCount = await persistence.cleanupCompletedDeliveries(olderThan);

      expect(deletedCount).toBe(5);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM deliveries'),
        [olderThan]
      );
    });

    it('should return 0 when no rows deleted', async () => {
      mockDb.query.mockResolvedValue({ rowCount: null });

      const deletedCount = await persistence.cleanupCompletedDeliveries(new Date());

      expect(deletedCount).toBe(0);
    });
  });

  describe('getStuckDeliveries', () => {
    it('should return stuck deliveries', async () => {
      const mockRow = {
        id: 'stuck-delivery',
        subscription_id: 'sub-1',
        webhook_id: 'webhook-1',
        event_data: JSON.stringify(mockDelivery.event),
        payload: JSON.stringify(mockDelivery.payload),
        status: 'processing',
        attempts: 1,
        max_attempts: 3,
        next_retry: null,
        created_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const stuckDeliveries = await persistence.getStuckDeliveries(300000);

      expect(stuckDeliveries).toHaveLength(1);
      expect(stuckDeliveries[0]?.id).toBe('stuck-delivery');
      expect(stuckDeliveries[0]?.status).toBe('processing');
      expect(stuckDeliveries[0]?.subscriptionId).toBe('sub-1');
      expect(stuckDeliveries[0]?.webhookId).toBe('webhook-1');
      expect(stuckDeliveries[0]?.attempts).toBe(1);
      expect(stuckDeliveries[0]?.maxAttempts).toBe(3);
      expect(stuckDeliveries[0]?.nextRetry).toBeNull();
    });

    it('should return empty array when no stuck deliveries found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const stuckDeliveries = await persistence.getStuckDeliveries(300000);

      expect(stuckDeliveries).toHaveLength(0);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, subscription_id, webhook_id')
      );
    });

    it('should use default threshold when not provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await persistence.getStuckDeliveries();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('300000 milliseconds')
      );
    });

    it('should use custom threshold when provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await persistence.getStuckDeliveries(600000);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('600000 milliseconds')
      );
    });

    it('should parse JSON data correctly for stuck deliveries', async () => {
      const mockEvent = {
        contractAddress: '0x456',
        eventName: 'Approval',
        blockNumber: 200,
        transactionHash: '0xdef',
        logIndex: 1,
        args: { owner: '0x111', spender: '0x222', value: '2000' },
        timestamp: new Date('2023-01-01T12:00:00Z')
      };

      const mockPayload = { custom: 'payload', data: 123 };

      const mockRow = {
        id: 'stuck-delivery-2',
        subscription_id: 'sub-2',
        webhook_id: 'webhook-2',
        event_data: JSON.stringify(mockEvent),
        payload: JSON.stringify(mockPayload),
        status: 'processing',
        attempts: 2,
        max_attempts: 5,
        next_retry: new Date('2023-01-01T13:00:00Z'),
        created_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const stuckDeliveries = await persistence.getStuckDeliveries(300000);

      expect(stuckDeliveries).toHaveLength(1);
      expect(stuckDeliveries[0]?.event).toEqual({
        ...mockEvent,
        timestamp: expect.any(String) // JSON parsing converts Date to string
      });
      expect(stuckDeliveries[0]?.payload).toEqual(mockPayload);
      expect(stuckDeliveries[0]?.nextRetry).toEqual(new Date('2023-01-01T13:00:00Z'));
    });
  });

  describe('resetStuckDeliveries', () => {
    it('should reset stuck deliveries to pending', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 3 });

      const resetCount = await persistence.resetStuckDeliveries(300000);

      expect(resetCount).toBe(3);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE deliveries')
      );
    });
  });
});