import { DeliveryFactory } from '../DeliveryFactory';
import { EventFactory } from '../EventFactory';
import { WebhookDelivery } from '../../../src/types/delivery';

describe('DeliveryFactory', () => {
  describe('createWebhookDelivery', () => {
    it('should create a default webhook delivery', () => {
      const delivery = DeliveryFactory.createWebhookDelivery();

      expect(delivery).toMatchObject({
        attempts: 0,
        maxAttempts: 3,
        status: 'pending'
      });

      expect(delivery.id).toBeDefined();
      expect(typeof delivery.id).toBe('string');
      expect(delivery.subscriptionId).toBeDefined();
      expect(typeof delivery.subscriptionId).toBe('string');
      expect(delivery.webhookId).toBeDefined();
      expect(typeof delivery.webhookId).toBe('string');
      expect(delivery.event).toBeDefined();
      expect(delivery.payload).toBeDefined();
    });

    it('should include a valid blockchain event', () => {
      const delivery = DeliveryFactory.createWebhookDelivery();

      expect(delivery.event).toMatchObject({
        contractAddress: expect.stringMatching(/^0x[0-9a-f]{40}$/i),
        eventName: expect.any(String),
        blockNumber: expect.any(Number),
        transactionHash: expect.stringMatching(/^0x[0-9a-f]{64}$/i),
        logIndex: expect.any(Number),
        args: expect.any(Object),
        timestamp: expect.any(Date)
      });
    });

    it('should include a formatted payload', () => {
      const delivery = DeliveryFactory.createWebhookDelivery();

      expect(delivery.payload).toMatchObject({
        event: 'Transfer',
        data: {
          from: '0x0000000000000000000000000000000000000000',
          to: '0x1111111111111111111111111111111111111111',
          value: '1000000000000000000'
        },
        timestamp: expect.any(String)
      });
    });

    it('should apply overrides correctly', () => {
      const overrides: Partial<WebhookDelivery> = {
        id: 'custom-delivery-id',
        subscriptionId: 'custom-subscription-id',
        webhookId: 'custom-webhook-id',
        attempts: 2,
        maxAttempts: 5,
        status: 'processing'
      };

      const delivery = DeliveryFactory.createWebhookDelivery(overrides);

      expect(delivery.id).toBe('custom-delivery-id');
      expect(delivery.subscriptionId).toBe('custom-subscription-id');
      expect(delivery.webhookId).toBe('custom-webhook-id');
      expect(delivery.attempts).toBe(2);
      expect(delivery.maxAttempts).toBe(5);
      expect(delivery.status).toBe('processing');
    });

    it('should generate unique IDs for each delivery', () => {
      const delivery1 = DeliveryFactory.createWebhookDelivery();
      const delivery2 = DeliveryFactory.createWebhookDelivery();

      expect(delivery1.id).not.toBe(delivery2.id);
      expect(delivery1.subscriptionId).not.toBe(delivery2.subscriptionId);
      expect(delivery1.webhookId).not.toBe(delivery2.webhookId);
    });

    it('should handle custom event override', () => {
      const customEvent = EventFactory.createBlockchainEvent({
        eventName: 'CustomEvent',
        contractAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
        blockNumber: 999999
      });

      const delivery = DeliveryFactory.createWebhookDelivery({ event: customEvent });

      expect(delivery.event).toEqual(customEvent);
    });

    it('should handle custom payload override', () => {
      const customPayload = {
        customField: 'customValue',
        timestamp: '2023-01-01T00:00:00.000Z',
        data: { custom: 'data' }
      };

      const delivery = DeliveryFactory.createWebhookDelivery({ payload: customPayload });

      expect(delivery.payload).toEqual(customPayload);
    });
  });

  describe('createPendingDelivery', () => {
    it('should create a delivery with pending status', () => {
      const delivery = DeliveryFactory.createPendingDelivery();

      expect(delivery.status).toBe('pending');
      expect(delivery.attempts).toBe(0);
    });

    it('should apply additional overrides while maintaining pending status', () => {
      const overrides = {
        maxAttempts: 5,
        webhookId: 'custom-webhook-id'
      };

      const delivery = DeliveryFactory.createPendingDelivery(overrides);

      expect(delivery.status).toBe('pending');
      expect(delivery.attempts).toBe(0);
      expect(delivery.maxAttempts).toBe(5);
      expect(delivery.webhookId).toBe('custom-webhook-id');
    });

    it('should override status even if provided in overrides', () => {
      const delivery = DeliveryFactory.createPendingDelivery({ status: 'completed' as any });

      expect(delivery.status).toBe('pending');
    });

    it('should override attempts even if provided in overrides', () => {
      const delivery = DeliveryFactory.createPendingDelivery({ attempts: 5 });

      expect(delivery.attempts).toBe(0);
    });
  });

  describe('createBatchDeliveries', () => {
    it('should create the specified number of deliveries', () => {
      const deliveries = DeliveryFactory.createBatchDeliveries(5);

      expect(deliveries).toHaveLength(5);
      deliveries.forEach(delivery => {
        expect(delivery).toMatchObject({
          attempts: 0,
          maxAttempts: 3,
          status: 'pending'
        });
      });
    });

    it('should create deliveries with unique IDs', () => {
      const deliveries = DeliveryFactory.createBatchDeliveries(3);
      const ids = deliveries.map(d => d.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(3);
    });

    it('should apply base delivery properties to all deliveries', () => {
      const baseDelivery = {
        subscriptionId: 'shared-subscription-id',
        webhookId: 'shared-webhook-id',
        maxAttempts: 5
      };

      const deliveries = DeliveryFactory.createBatchDeliveries(3, baseDelivery);

      deliveries.forEach(delivery => {
        expect(delivery.subscriptionId).toBe('shared-subscription-id');
        expect(delivery.webhookId).toBe('shared-webhook-id');
        expect(delivery.maxAttempts).toBe(5);
        expect(delivery.id).toBeDefined(); // Should still have unique ID
      });
    });

    it('should handle zero count', () => {
      const deliveries = DeliveryFactory.createBatchDeliveries(0);

      expect(deliveries).toHaveLength(0);
    });

    it('should handle large batch sizes', () => {
      const deliveries = DeliveryFactory.createBatchDeliveries(100);

      expect(deliveries).toHaveLength(100);
      
      // Verify all have unique IDs
      const ids = deliveries.map(d => d.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100);
    });
  });

  describe('createHighVolumeDeliveries', () => {
    it('should create the specified number of deliveries', () => {
      const deliveries = DeliveryFactory.createHighVolumeDeliveries(10);

      expect(deliveries).toHaveLength(10);
    });

    it('should create deliveries with sequential block numbers', () => {
      const deliveries = DeliveryFactory.createHighVolumeDeliveries(5);

      deliveries.forEach((delivery, index) => {
        expect(delivery.event.blockNumber).toBe(12345 + index);
      });
    });

    it('should create deliveries with sequential log indices', () => {
      const deliveries = DeliveryFactory.createHighVolumeDeliveries(15);

      deliveries.forEach((delivery, index) => {
        expect(delivery.event.logIndex).toBe(index % 10);
      });
    });

    it('should create deliveries with unique transaction hashes', () => {
      const deliveries = DeliveryFactory.createHighVolumeDeliveries(5);
      const txHashes = deliveries.map(d => d.event.transactionHash);
      const uniqueHashes = new Set(txHashes);

      expect(uniqueHashes.size).toBe(5);
      
      txHashes.forEach((hash, index) => {
        const expectedHash = `0x${index.toString(16).padStart(64, '0')}`;
        expect(hash).toBe(expectedHash);
      });
    });

    it('should create deliveries with formatted payloads', () => {
      const deliveries = DeliveryFactory.createHighVolumeDeliveries(3);

      deliveries.forEach(delivery => {
        expect(delivery.payload).toMatchObject({
          event: delivery.event.eventName,
          data: delivery.event.args,
          timestamp: delivery.event.timestamp.toISOString(),
          blockNumber: delivery.event.blockNumber,
          transactionHash: delivery.event.transactionHash
        });
      });
    });

    it('should create deliveries with unique IDs', () => {
      const deliveries = DeliveryFactory.createHighVolumeDeliveries(10);
      const ids = deliveries.map(d => d.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(10);
    });

    it('should handle large volumes efficiently', () => {
      const startTime = Date.now();
      const deliveries = DeliveryFactory.createHighVolumeDeliveries(1000);
      const endTime = Date.now();

      expect(deliveries).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('createFormattedPayload', () => {
    const mockEventData = {
      eventName: 'Transfer',
      contractAddress: '0x1234567890123456789012345678901234567890',
      blockNumber: 12345,
      transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      args: {
        from: '0x0000000000000000000000000000000000000000',
        to: '0x1111111111111111111111111111111111111111',
        value: '1000000000000000000'
      },
      timestamp: new Date('2023-01-01T00:00:00.000Z')
    };

    it('should format payload for Zapier', () => {
      const payload = DeliveryFactory.createFormattedPayload('zapier', mockEventData);

      expect(payload).toEqual({
        event_name: 'Transfer',
        contract_address: '0x1234567890123456789012345678901234567890',
        block_number: 12345,
        transaction_hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        from: '0x0000000000000000000000000000000000000000',
        to: '0x1111111111111111111111111111111111111111',
        value: '1000000000000000000'
      });
    });

    it('should format payload for Make.com', () => {
      const payload = DeliveryFactory.createFormattedPayload('make', mockEventData);

      expect(payload).toEqual({
        eventName: 'Transfer',
        contractAddress: '0x1234567890123456789012345678901234567890',
        blockNumber: 12345,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        eventData: {
          from: '0x0000000000000000000000000000000000000000',
          to: '0x1111111111111111111111111111111111111111',
          value: '1000000000000000000'
        }
      });
    });

    it('should format payload for n8n', () => {
      const payload = DeliveryFactory.createFormattedPayload('n8n', mockEventData);

      expect(payload).toEqual({
        event: {
          name: 'Transfer',
          contract: '0x1234567890123456789012345678901234567890',
          block: 12345,
          transaction: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          parameters: {
            from: '0x0000000000000000000000000000000000000000',
            to: '0x1111111111111111111111111111111111111111',
            value: '1000000000000000000'
          }
        }
      });
    });

    it('should format payload for generic format', () => {
      const payload = DeliveryFactory.createFormattedPayload('generic', mockEventData);

      expect(payload).toEqual({
        event: 'Transfer',
        contractAddress: '0x1234567890123456789012345678901234567890',
        blockNumber: 12345,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        data: {
          from: '0x0000000000000000000000000000000000000000',
          to: '0x1111111111111111111111111111111111111111',
          value: '1000000000000000000'
        },
        timestamp: new Date('2023-01-01T00:00:00.000Z')
      });
    });

    it('should default to generic format for unknown formats', () => {
      const payload = DeliveryFactory.createFormattedPayload('unknown' as any, mockEventData);

      expect(payload).toEqual({
        event: 'Transfer',
        contractAddress: '0x1234567890123456789012345678901234567890',
        blockNumber: 12345,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        data: {
          from: '0x0000000000000000000000000000000000000000',
          to: '0x1111111111111111111111111111111111111111',
          value: '1000000000000000000'
        },
        timestamp: new Date('2023-01-01T00:00:00.000Z')
      });
    });

    it('should handle empty event args', () => {
      const eventDataWithEmptyArgs = {
        ...mockEventData,
        args: {}
      };

      const zapierPayload = DeliveryFactory.createFormattedPayload('zapier', eventDataWithEmptyArgs);
      const makePayload = DeliveryFactory.createFormattedPayload('make', eventDataWithEmptyArgs);
      const n8nPayload = DeliveryFactory.createFormattedPayload('n8n', eventDataWithEmptyArgs);
      const genericPayload = DeliveryFactory.createFormattedPayload('generic', eventDataWithEmptyArgs);

      expect(zapierPayload).toMatchObject({
        event_name: 'Transfer',
        contract_address: '0x1234567890123456789012345678901234567890'
      });
      expect(makePayload.eventData).toEqual({});
      expect(n8nPayload.event.parameters).toEqual({});
      expect(genericPayload.data).toEqual({});
    });

    it('should handle complex event args', () => {
      const complexEventData = {
        ...mockEventData,
        args: {
          from: '0x0000000000000000000000000000000000000000',
          to: '0x1111111111111111111111111111111111111111',
          value: '1000000000000000000',
          data: '0xabcdef',
          nested: {
            field1: 'value1',
            field2: 123
          }
        }
      };

      const zapierPayload = DeliveryFactory.createFormattedPayload('zapier', complexEventData);
      
      expect(zapierPayload).toMatchObject({
        from: '0x0000000000000000000000000000000000000000',
        to: '0x1111111111111111111111111111111111111111',
        value: '1000000000000000000',
        data: '0xabcdef',
        nested: {
          field1: 'value1',
          field2: 123
        }
      });
    });
  });

  describe('integration with other factories', () => {
    it('should work with EventFactory-generated events', () => {
      const customEvent = EventFactory.createBlockchainEvent({
        eventName: 'CustomEvent',
        blockNumber: 999999
      });

      const delivery = DeliveryFactory.createWebhookDelivery({ event: customEvent });

      expect(delivery.event).toEqual(customEvent);
      expect(delivery.payload.event).toBe('Transfer'); // Default payload
    });

    it('should create deliveries suitable for webhook testing', () => {
      const delivery = DeliveryFactory.createWebhookDelivery();

      // Verify it has all required fields for webhook delivery
      expect(delivery.id).toBeTruthy();
      expect(delivery.subscriptionId).toBeTruthy();
      expect(delivery.webhookId).toBeTruthy();
      expect(delivery.event).toBeTruthy();
      expect(delivery.payload).toBeTruthy();
      expect(['pending', 'processing', 'completed', 'failed']).toContain(delivery.status);
      expect(delivery.attempts).toBeGreaterThanOrEqual(0);
      expect(delivery.maxAttempts).toBeGreaterThan(0);
    });
  });
});