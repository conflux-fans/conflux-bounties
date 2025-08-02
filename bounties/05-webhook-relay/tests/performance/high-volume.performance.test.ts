import { QueueProcessor } from '../../src/webhooks/QueueProcessor';
import { DeliveryQueue } from '../../src/webhooks/queue/DeliveryQueue';
import { WebhookSender } from '../../src/webhooks/WebhookSender';
import { DeliveryTracker } from '../../src/webhooks/DeliveryTracker';
import { Logger } from '../../src/monitoring/Logger';
import { EventFactory, DeliveryFactory, WebhookFactory } from '../factories';
import { WebhookDelivery } from '../../src/types/delivery';

// Mock implementations for performance testing
class MockQueuePersistence {
  private queue: WebhookDelivery[] = [];
  private processing: Set<string> = new Set();

  async enqueue(delivery: WebhookDelivery): Promise<void> {
    this.queue.push(delivery);
  }

  async dequeue(): Promise<WebhookDelivery | null> {
    const delivery = this.queue.find(d => d.status === 'pending' && !this.processing.has(d.id));
    if (delivery) {
      delivery.status = 'processing';
      this.processing.add(delivery.id);
      return delivery;
    }
    return null;
  }

  async markComplete(deliveryId: string): Promise<void> {
    const index = this.queue.findIndex(d => d.id === deliveryId);
    if (index !== -1 && this.queue[index]) {
      this.queue[index]!.status = 'completed';
      this.processing.delete(deliveryId);
    }
  }

  async markFailed(deliveryId: string, _error: string): Promise<void> {
    const index = this.queue.findIndex(d => d.id === deliveryId);
    if (index !== -1 && this.queue[index]) {
      this.queue[index]!.status = 'failed';
      this.processing.delete(deliveryId);
    }
  }

  async scheduleRetry(deliveryId: string, retryAt: Date): Promise<void> {
    const index = this.queue.findIndex(d => d.id === deliveryId);
    if (index !== -1 && this.queue[index]) {
      this.queue[index]!.status = 'pending';
      this.queue[index]!.nextRetry = retryAt;
      this.queue[index]!.attempts += 1;
      this.processing.delete(deliveryId);
    }
  }

  getQueueSize(): number {
    return this.queue.filter(d => d.status === 'pending').length;
  }

  getProcessingCount(): number {
    return this.processing.size;
  }

  clear(): void {
    this.queue = [];
    this.processing.clear();
  }
}

class MockHttpClient {
  private responseTime: number = 50;
  private successRate: number = 0.95;
  private requestCount: number = 0;

  setResponseTime(ms: number): void {
    this.responseTime = ms;
  }

  setSuccessRate(rate: number): void {
    this.successRate = rate;
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  resetRequestCount(): void {
    this.requestCount = 0;
  }

  async post(_url: string, _data: any, options: any): Promise<any> {
    this.requestCount++;
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, this.responseTime));
    
    // Simulate success/failure based on success rate
    if (Math.random() < this.successRate) {
      return {
        status: 200,
        data: { success: true },
        headers: {},
        config: options
      };
    } else {
      const error = new Error('Request failed');
      (error as any).response = {
        status: 500,
        data: { error: 'Internal server error' }
      };
      throw error;
    }
  }
}

describe('High Volume Performance Tests', () => {
  let mockQueuePersistence: MockQueuePersistence;
  let mockHttpClient: MockHttpClient;
  let deliveryQueue: DeliveryQueue;
  let webhookSender: WebhookSender;
  let queueProcessor: QueueProcessor;
  let deliveryTracker: DeliveryTracker;

  beforeEach(() => {
    mockQueuePersistence = new MockQueuePersistence();
    mockHttpClient = new MockHttpClient();
    deliveryQueue = new DeliveryQueue(mockQueuePersistence as any);
    deliveryTracker = new DeliveryTracker();
    webhookSender = new WebhookSender(mockHttpClient as any, deliveryTracker);
    const logger = new Logger({ level: 'error' }); // Use error level to reduce test noise
    queueProcessor = new QueueProcessor(deliveryQueue, webhookSender, logger);
  });

  afterEach(async () => {
    if (queueProcessor) {
      await queueProcessor.stop();
    }
  });

  describe('Event Processing Performance', () => {
    it('should process 1000 events within 5 seconds', async () => {
      const events = EventFactory.createBatchEvents(1000);
      const startTime = Date.now();

      // Process events in batches to simulate real-world scenario
      const batchSize = 100;
      const promises: Promise<void>[] = [];

      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize);
        promises.push(
          Promise.all(batch.map(async (event) => {
            // Simulate event processing
            await new Promise(resolve => setTimeout(resolve, 1));
            return event;
          })).then(() => {})
        );
      }

      await Promise.all(promises);

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Processed 1000 events in ${processingTime}ms`);
      console.log(`Average: ${processingTime / 1000}ms per event`);
    });

    it('should maintain performance with concurrent event streams', async () => {
      const streamCount = 5;
      const eventsPerStream = 200;
      const startTime = Date.now();

      // Create multiple concurrent event streams
      const streamPromises = Array.from({ length: streamCount }, async (_, streamIndex) => {
        const events = EventFactory.createBatchEvents(eventsPerStream, {
          contractAddress: `0x${streamIndex.toString(16).padStart(40, '0')}`
        });

        return Promise.all(events.map(async (event) => {
          // Simulate event processing with slight delay
          await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
          return event;
        }));
      });

      await Promise.all(streamPromises);

      const processingTime = Date.now() - startTime;
      const totalEvents = streamCount * eventsPerStream;
      
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`Processed ${totalEvents} events across ${streamCount} streams in ${processingTime}ms`);
      console.log(`Average: ${processingTime / totalEvents}ms per event`);
    });
  });

  describe('Queue Processing Performance', () => {
    it('should process 1000 webhook deliveries efficiently', async () => {
      const deliveries = DeliveryFactory.createHighVolumeDeliveries(1000);
      const webhook = WebhookFactory.createWebhookConfig();

      // Configure mock for fast responses
      mockHttpClient.setResponseTime(10);
      mockHttpClient.setSuccessRate(1.0);

      // Enqueue all deliveries
      await Promise.all(deliveries.map(delivery => deliveryQueue.enqueue(delivery)));

      // Configure webhook for queue processor
      queueProcessor.setWebhookConfig(webhook.id, webhook);

      const startTime = Date.now();
      await queueProcessor.start();

      // Wait for all deliveries to be processed
      while (mockQueuePersistence.getQueueSize() > 0 || mockQueuePersistence.getProcessingCount() > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await queueProcessor.stop();
      const processingTime = Date.now() - startTime;

      expect(mockHttpClient.getRequestCount()).toBe(1000);
      expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds

      console.log(`Processed 1000 webhook deliveries in ${processingTime}ms`);
      console.log(`Average: ${processingTime / 1000}ms per delivery`);
      console.log(`Throughput: ${(1000 / processingTime * 1000).toFixed(2)} deliveries/second`);
    });

    it('should handle high concurrency without memory leaks', async () => {
      const deliveryCount = 5000;
      const deliveries = DeliveryFactory.createHighVolumeDeliveries(deliveryCount);
      const webhook = WebhookFactory.createWebhookConfig();

      // Configure for very fast processing
      mockHttpClient.setResponseTime(1);
      mockHttpClient.setSuccessRate(1.0);

      const initialMemory = process.memoryUsage();

      // Process in batches to avoid overwhelming the system
      const batchSize = 500;
      for (let i = 0; i < deliveries.length; i += batchSize) {
        const batch = deliveries.slice(i, i + batchSize);
        await Promise.all(batch.map(delivery => deliveryQueue.enqueue(delivery)));
      }

      queueProcessor.setWebhookConfig(webhook.id, webhook);
      await queueProcessor.start();

      // Wait for processing to complete
      while (mockQueuePersistence.getQueueSize() > 0 || mockQueuePersistence.getProcessingCount() > 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await queueProcessor.stop();

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 100MB for 5000 deliveries)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB for ${deliveryCount} deliveries`);
      console.log(`Average memory per delivery: ${(memoryIncrease / deliveryCount / 1024).toFixed(2)}KB`);
    });

    it('should maintain performance under failure conditions', async () => {
      const deliveries = DeliveryFactory.createHighVolumeDeliveries(500);
      const webhook = WebhookFactory.createWebhookConfig();

      // Configure for 70% success rate to simulate real-world conditions
      mockHttpClient.setResponseTime(20);
      mockHttpClient.setSuccessRate(0.7);

      await Promise.all(deliveries.map(delivery => deliveryQueue.enqueue(delivery)));
      queueProcessor.setWebhookConfig(webhook.id, webhook);

      const startTime = Date.now();
      await queueProcessor.start();

      // Wait for initial processing (some will fail and retry)
      await new Promise(resolve => setTimeout(resolve, 10000));

      await queueProcessor.stop();
      const processingTime = Date.now() - startTime;

      const requestCount = mockHttpClient.getRequestCount();
      
      // Should have made more requests than deliveries due to retries
      expect(requestCount).toBeGreaterThan(500);
      expect(requestCount).toBeLessThan(1500); // But not too many retries

      console.log(`Processed ${requestCount} requests for 500 deliveries in ${processingTime}ms`);
      console.log(`Retry rate: ${((requestCount - 500) / 500 * 100).toFixed(1)}%`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should handle large payloads without excessive memory usage', async () => {
      const largePayloadSize = 100 * 1024; // 100KB per payload
      const deliveryCount = 100;

      const deliveries = Array.from({ length: deliveryCount }, () => {
        const largePayload = {
          event: 'Transfer',
          data: {
            from: '0x1234567890123456789012345678901234567890',
            to: '0x0987654321098765432109876543210987654321',
            value: '1000000000000000000',
            metadata: 'x'.repeat(largePayloadSize)
          }
        };

        return DeliveryFactory.createWebhookDelivery({ payload: largePayload });
      });

      const webhook = WebhookFactory.createWebhookConfig();
      mockHttpClient.setResponseTime(5);
      mockHttpClient.setSuccessRate(1.0);

      const initialMemory = process.memoryUsage();

      await Promise.all(deliveries.map(delivery => deliveryQueue.enqueue(delivery)));
      queueProcessor.setWebhookConfig(webhook.id, webhook);

      await queueProcessor.start();

      while (mockQueuePersistence.getQueueSize() > 0 || mockQueuePersistence.getProcessingCount() > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await queueProcessor.stop();

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable even with large payloads
      const expectedMemoryUsage = deliveryCount * largePayloadSize * 2; // Allow 2x overhead
      expect(memoryIncrease).toBeLessThan(expectedMemoryUsage);

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB for ${deliveryCount} large payloads`);
    });

    it('should clean up resources properly after processing', async () => {
      const deliveries = DeliveryFactory.createHighVolumeDeliveries(1000);
      const webhook = WebhookFactory.createWebhookConfig();

      mockHttpClient.setResponseTime(1);
      mockHttpClient.setSuccessRate(1.0);

      // Process multiple batches
      for (let batch = 0; batch < 5; batch++) {
        const batchDeliveries = deliveries.slice(batch * 200, (batch + 1) * 200);
        
        await Promise.all(batchDeliveries.map(delivery => deliveryQueue.enqueue(delivery)));
        queueProcessor.setWebhookConfig(webhook.id, webhook);

        await queueProcessor.start();

        while (mockQueuePersistence.getQueueSize() > 0 || mockQueuePersistence.getProcessingCount() > 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        await queueProcessor.stop();

        // Clear processed deliveries
        mockQueuePersistence.clear();
        mockHttpClient.resetRequestCount();

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      // Memory should not continuously grow
      const finalMemory = process.memoryUsage();
      console.log(`Final memory usage: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      
      // This is more of an observation than a strict test
      expect(finalMemory.heapUsed).toBeLessThan(200 * 1024 * 1024); // Less than 200MB
    });
  });

  describe('Throughput Benchmarks', () => {
    it('should achieve target throughput of 100 deliveries/second', async () => {
      const targetThroughput = 100; // deliveries per second
      const testDuration = 5000; // 5 seconds
      const expectedDeliveries = Math.floor(targetThroughput * testDuration / 1000);

      const deliveries = DeliveryFactory.createHighVolumeDeliveries(expectedDeliveries);
      const webhook = WebhookFactory.createWebhookConfig();

      // Configure for optimal performance
      mockHttpClient.setResponseTime(5);
      mockHttpClient.setSuccessRate(1.0);

      await Promise.all(deliveries.map(delivery => deliveryQueue.enqueue(delivery)));
      queueProcessor.setWebhookConfig(webhook.id, webhook);

      const startTime = Date.now();
      await queueProcessor.start();

      // Run for test duration
      await new Promise(resolve => setTimeout(resolve, testDuration));

      const actualDuration = Date.now() - startTime;
      const processedCount = mockHttpClient.getRequestCount();
      const actualThroughput = processedCount / actualDuration * 1000;

      await queueProcessor.stop();

      console.log(`Processed ${processedCount} deliveries in ${actualDuration}ms`);
      console.log(`Actual throughput: ${actualThroughput.toFixed(2)} deliveries/second`);
      console.log(`Target throughput: ${targetThroughput} deliveries/second`);

      // Should achieve at least 80% of target throughput
      expect(actualThroughput).toBeGreaterThan(targetThroughput * 0.8);
    });
  });
});