import { DeliveryTracker } from '../DeliveryTracker';
import type { WebhookDelivery, DeliveryResult } from '../../types';

describe('DeliveryTracker', () => {
  let deliveryTracker: DeliveryTracker;

  beforeEach(() => {
    deliveryTracker = new DeliveryTracker();
  });

  const createMockDelivery = (overrides: Partial<WebhookDelivery> = {}): WebhookDelivery => ({
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
      timestamp: new Date(),
    },
    payload: { test: 'data' },
    attempts: 1,
    maxAttempts: 3,
    status: 'pending' as const,
    ...overrides,
  });

  const createMockResult = (overrides: Partial<DeliveryResult> = {}): DeliveryResult => ({
    success: true,
    statusCode: 200,
    responseTime: 150,
    ...overrides,
  });

  describe('trackDelivery', () => {
    it('should track successful delivery', async () => {
      const delivery = createMockDelivery();
      const result = createMockResult();

      await deliveryTracker.trackDelivery(delivery, result);

      const stats = await deliveryTracker.getDeliveryStats('webhook-1');
      expect(stats.totalDeliveries).toBe(1);
      expect(stats.successfulDeliveries).toBe(1);
      expect(stats.failedDeliveries).toBe(0);
      expect(stats.averageResponseTime).toBe(150);
    });

    it('should track failed delivery', async () => {
      const delivery = createMockDelivery();
      const result = createMockResult({
        success: false,
        statusCode: 500,
        responseTime: 200,
        error: 'Internal Server Error',
      });

      await deliveryTracker.trackDelivery(delivery, result);

      const stats = await deliveryTracker.getDeliveryStats('webhook-1');
      expect(stats.totalDeliveries).toBe(1);
      expect(stats.successfulDeliveries).toBe(0);
      expect(stats.failedDeliveries).toBe(1);
      expect(stats.averageResponseTime).toBe(200);
    });

    it('should track multiple deliveries for same webhook', async () => {
      const delivery1 = createMockDelivery({ id: 'delivery-1' });
      const delivery2 = createMockDelivery({ id: 'delivery-2' });
      const delivery3 = createMockDelivery({ id: 'delivery-3' });

      const successResult = createMockResult({ responseTime: 100 });
      const failResult = createMockResult({
        success: false,
        responseTime: 200,
        error: 'Failed',
      });

      await deliveryTracker.trackDelivery(delivery1, successResult);
      await deliveryTracker.trackDelivery(delivery2, failResult);
      await deliveryTracker.trackDelivery(delivery3, successResult);

      const stats = await deliveryTracker.getDeliveryStats('webhook-1');
      expect(stats.totalDeliveries).toBe(3);
      expect(stats.successfulDeliveries).toBe(2);
      expect(stats.failedDeliveries).toBe(1);
      expect(stats.averageResponseTime).toBe(133); // (100 + 200 + 100) / 3 = 133.33, rounded to 133
    });

    it('should track deliveries for different webhooks separately', async () => {
      const delivery1 = createMockDelivery({ webhookId: 'webhook-1' });
      const delivery2 = createMockDelivery({ webhookId: 'webhook-2' });

      const result1 = createMockResult({ responseTime: 100 });
      const result2 = createMockResult({ responseTime: 200 });

      await deliveryTracker.trackDelivery(delivery1, result1);
      await deliveryTracker.trackDelivery(delivery2, result2);

      const stats1 = await deliveryTracker.getDeliveryStats('webhook-1');
      const stats2 = await deliveryTracker.getDeliveryStats('webhook-2');

      expect(stats1.totalDeliveries).toBe(1);
      expect(stats1.averageResponseTime).toBe(100);

      expect(stats2.totalDeliveries).toBe(1);
      expect(stats2.averageResponseTime).toBe(200);
    });

    it('should limit history to 1000 records per webhook', async () => {
      const delivery = createMockDelivery();
      const result = createMockResult();

      // Track 1001 deliveries
      for (let i = 0; i < 1001; i++) {
        await deliveryTracker.trackDelivery(
          { ...delivery, id: `delivery-${i}` },
          result
        );
      }

      const stats = await deliveryTracker.getDeliveryStats('webhook-1');
      expect(stats.totalDeliveries).toBe(1000); // Should be capped at 1000

      const recentDeliveries = deliveryTracker.getRecentDeliveries('webhook-1', 10);
      expect(recentDeliveries).toHaveLength(10);
      expect(recentDeliveries[9]?.deliveryId).toBe('delivery-1000'); // Should have the most recent
    });
  });

  describe('getDeliveryStats', () => {
    it('should return empty stats for unknown webhook', async () => {
      const stats = await deliveryTracker.getDeliveryStats('unknown-webhook');

      expect(stats.totalDeliveries).toBe(0);
      expect(stats.successfulDeliveries).toBe(0);
      expect(stats.failedDeliveries).toBe(0);
      expect(stats.averageResponseTime).toBe(0);
    });

    it('should calculate correct averages', async () => {
      const delivery = createMockDelivery();

      // Track deliveries with different response times
      await deliveryTracker.trackDelivery(delivery, createMockResult({ responseTime: 100 }));
      await deliveryTracker.trackDelivery(delivery, createMockResult({ responseTime: 200 }));
      await deliveryTracker.trackDelivery(delivery, createMockResult({ responseTime: 300 }));

      const stats = await deliveryTracker.getDeliveryStats('webhook-1');
      expect(stats.averageResponseTime).toBe(200); // (100 + 200 + 300) / 3 = 200
    });

    it('should round average response time', async () => {
      const delivery = createMockDelivery();

      // Track deliveries that result in non-integer average
      await deliveryTracker.trackDelivery(delivery, createMockResult({ responseTime: 100 }));
      await deliveryTracker.trackDelivery(delivery, createMockResult({ responseTime: 150 }));

      const stats = await deliveryTracker.getDeliveryStats('webhook-1');
      expect(stats.averageResponseTime).toBe(125); // (100 + 150) / 2 = 125
    });
  });

  describe('getRecentDeliveries', () => {
    it('should return recent deliveries in chronological order', async () => {
      const delivery = createMockDelivery();
      const result = createMockResult();

      // Track multiple deliveries
      for (let i = 0; i < 5; i++) {
        await deliveryTracker.trackDelivery(
          { ...delivery, id: `delivery-${i}` },
          result
        );
      }

      const recentDeliveries = deliveryTracker.getRecentDeliveries('webhook-1', 3);
      expect(recentDeliveries).toHaveLength(3);
      expect(recentDeliveries[0]?.deliveryId).toBe('delivery-2'); // 3rd most recent
      expect(recentDeliveries[1]?.deliveryId).toBe('delivery-3'); // 2nd most recent
      expect(recentDeliveries[2]?.deliveryId).toBe('delivery-4'); // Most recent
    });

    it('should return empty array for unknown webhook', () => {
      const recentDeliveries = deliveryTracker.getRecentDeliveries('unknown-webhook');
      expect(recentDeliveries).toHaveLength(0);
    });

    it('should respect limit parameter', async () => {
      const delivery = createMockDelivery();
      const result = createMockResult();

      // Track 10 deliveries
      for (let i = 0; i < 10; i++) {
        await deliveryTracker.trackDelivery(
          { ...delivery, id: `delivery-${i}` },
          result
        );
      }

      const recentDeliveries = deliveryTracker.getRecentDeliveries('webhook-1', 5);
      expect(recentDeliveries).toHaveLength(5);
    });
  });

  describe('clearHistory', () => {
    beforeEach(async () => {
      // Set up some test data
      const delivery1 = createMockDelivery({ webhookId: 'webhook-1' });
      const delivery2 = createMockDelivery({ webhookId: 'webhook-2' });
      const result = createMockResult();

      await deliveryTracker.trackDelivery(delivery1, result);
      await deliveryTracker.trackDelivery(delivery2, result);
    });

    it('should clear history for specific webhook', async () => {
      deliveryTracker.clearHistory('webhook-1');

      const stats1 = await deliveryTracker.getDeliveryStats('webhook-1');
      const stats2 = await deliveryTracker.getDeliveryStats('webhook-2');

      expect(stats1.totalDeliveries).toBe(0);
      expect(stats2.totalDeliveries).toBe(1); // Should remain
    });

    it('should clear all history when no webhook specified', async () => {
      deliveryTracker.clearHistory();

      const stats1 = await deliveryTracker.getDeliveryStats('webhook-1');
      const stats2 = await deliveryTracker.getDeliveryStats('webhook-2');

      expect(stats1.totalDeliveries).toBe(0);
      expect(stats2.totalDeliveries).toBe(0);
    });
  });
});