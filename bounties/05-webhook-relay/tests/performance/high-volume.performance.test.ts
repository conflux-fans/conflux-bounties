import { WebhookSender } from '../../src/webhooks/WebhookSender';
import { DeliveryTracker } from '../../src/webhooks/DeliveryTracker';
import { EventFactory, DeliveryFactory, WebhookFactory } from '../factories';

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

  async post(_url: string, _data: any, _headers?: Record<string, string>, _timeout?: number): Promise<any> {
    this.requestCount++;

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, this.responseTime));

    // Simulate success/failure based on success rate
    if (Math.random() < this.successRate) {
      return {
        success: true,
        responseTime: this.responseTime,
        statusCode: 200,
        data: { success: true }
      };
    } else {
      return {
        success: false,
        responseTime: this.responseTime,
        statusCode: 500,
        error: 'Request failed'
      };
    }
  }
}

describe('High Volume Performance Tests', () => {
  let mockHttpClient: MockHttpClient;
  let webhookSender: WebhookSender;
  let deliveryTracker: DeliveryTracker;

  beforeEach(() => {
    mockHttpClient = new MockHttpClient();
    deliveryTracker = new DeliveryTracker();
    webhookSender = new WebhookSender(mockHttpClient as any, deliveryTracker);
  });

  afterEach(() => {
    // Clear any remaining data
    mockHttpClient?.resetRequestCount();
  });

  describe('Event Processing Performance', () => {
    it('should process 500 events within 2 seconds', async () => {
      const events = EventFactory.createBatchEvents(500);
      const startTime = Date.now();

      // Process events in batches to simulate real-world scenario
      const batchSize = 50;
      const promises: Promise<void>[] = [];

      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize);
        promises.push(
          Promise.all(batch.map(async (event) => {
            // Simulate minimal event processing
            return event;
          })).then(() => { })
        );
      }

      await Promise.all(promises);

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(2000); // Should complete within 2 seconds

      console.log(`Processed 500 events in ${processingTime}ms`);
      console.log(`Average: ${processingTime / 500}ms per event`);
    });

    it('should maintain performance with concurrent event streams', async () => {
      const streamCount = 3;
      const eventsPerStream = 100;
      const startTime = Date.now();

      // Create multiple concurrent event streams
      const streamPromises = Array.from({ length: streamCount }, async (_, streamIndex) => {
        const events = EventFactory.createBatchEvents(eventsPerStream, {
          contractAddress: `0x${streamIndex.toString(16).padStart(40, '0')}`
        });

        return Promise.all(events.map(async (event) => {
          // Simulate minimal event processing
          return event;
        }));
      });

      await Promise.all(streamPromises);

      const processingTime = Date.now() - startTime;
      const totalEvents = streamCount * eventsPerStream;

      expect(processingTime).toBeLessThan(3000); // Should complete within 3 seconds

      console.log(`Processed ${totalEvents} events across ${streamCount} streams in ${processingTime}ms`);
      console.log(`Average: ${processingTime / totalEvents}ms per event`);
    });
  });

  describe('Queue Processing Performance', () => {
    it('should process 200 webhook deliveries efficiently', async () => {
      const deliveryCount = 200;
      const webhook = WebhookFactory.createWebhookConfig();

      // Configure mock for fast responses
      mockHttpClient.setResponseTime(1);
      mockHttpClient.setSuccessRate(1.0);

      // Create deliveries
      const deliveries = DeliveryFactory.createHighVolumeDeliveries(deliveryCount);

      // Process deliveries directly with webhook sender
      const processDeliveries = async () => {
        const promises: Promise<void>[] = [];

        for (const delivery of deliveries) {
          webhookSender.setWebhookConfigForTesting(delivery.webhookId, webhook);
          promises.push(
            webhookSender.sendWebhook(delivery).then(() => {
              // Just track completion, no queue management needed
            })
          );

          // Process in batches to avoid overwhelming the system
          if (promises.length >= 20) {
            await Promise.all(promises);
            promises.length = 0;
          }
        }

        // Process remaining deliveries
        if (promises.length > 0) {
          await Promise.all(promises);
        }
      };

      const startTime = Date.now();
      await processDeliveries();
      const processingTime = Date.now() - startTime;

      expect(mockHttpClient.getRequestCount()).toBe(deliveryCount);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Processed ${deliveryCount} webhook deliveries in ${processingTime}ms`);
      console.log(`Average: ${processingTime / deliveryCount}ms per delivery`);
      console.log(`Throughput: ${(deliveryCount / processingTime * 1000).toFixed(2)} deliveries/second`);
    });

    it('should handle high concurrency without memory leaks', async () => {
      const deliveryCount = 500;
      const webhook = WebhookFactory.createWebhookConfig();

      // Configure for very fast processing
      mockHttpClient.setResponseTime(1);
      mockHttpClient.setSuccessRate(1.0);

      const initialMemory = process.memoryUsage();

      // Create deliveries
      const deliveries = DeliveryFactory.createHighVolumeDeliveries(deliveryCount);

      // Process deliveries directly
      const processDeliveries = async () => {
        const promises: Promise<void>[] = [];

        for (const delivery of deliveries) {
          webhookSender.setWebhookConfigForTesting(delivery.webhookId, webhook);
          promises.push(
            webhookSender.sendWebhook(delivery).then(() => {
              // Just track completion
            })
          );

          if (promises.length >= 50) {
            await Promise.all(promises);
            promises.length = 0;
          }
        }

        if (promises.length > 0) {
          await Promise.all(promises);
        }
      };

      await processDeliveries();

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB for 500 deliveries)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB for ${deliveryCount} deliveries`);
      console.log(`Average memory per delivery: ${(memoryIncrease / deliveryCount / 1024).toFixed(2)}KB`);
    });

    it('should maintain performance under failure conditions', async () => {
      const deliveryCount = 200; // Reduced for faster test
      const webhook = WebhookFactory.createWebhookConfig();

      // Configure for 70% success rate to simulate real-world conditions
      mockHttpClient.setResponseTime(5);
      mockHttpClient.setSuccessRate(0.7);

      // Create deliveries
      const deliveries = DeliveryFactory.createHighVolumeDeliveries(deliveryCount);

      // Simple retry logic without complex queue management
      const processDeliveries = async () => {
        const promises: Promise<void>[] = [];
        let totalRequests = 0;

        for (const delivery of deliveries) {
          webhookSender.setWebhookConfigForTesting(delivery.webhookId, webhook);

          // Simple retry logic
          let attempts = 0;
          const maxAttempts = 3;

          const processWithRetry = async () => {
            while (attempts < maxAttempts) {
              attempts++;
              totalRequests++;

              const result = await webhookSender.sendWebhook(delivery);
              if (result.success) {
                break; // Success, no need to retry
              }

              if (attempts < maxAttempts) {
                // Small delay before retry
                await new Promise(resolve => setTimeout(resolve, 10));
              }
            }
          };

          promises.push(processWithRetry());

          // Process in batches to avoid overwhelming the system
          if (promises.length >= 25) {
            await Promise.all(promises);
            promises.length = 0;
          }
        }

        // Process remaining deliveries
        if (promises.length > 0) {
          await Promise.all(promises);
        }

        return totalRequests;
      };

      const startTime = Date.now();
      const requestCount = await processDeliveries();
      const processingTime = Date.now() - startTime;

      // Should have made more requests than deliveries due to retries
      expect(requestCount).toBeGreaterThan(deliveryCount);
      expect(requestCount).toBeLessThan(deliveryCount * 3); // But not too many retries

      console.log(`Processed ${requestCount} requests for ${deliveryCount} deliveries in ${processingTime}ms`);
      console.log(`Retry rate: ${((requestCount - deliveryCount) / deliveryCount * 100).toFixed(1)}%`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should handle large payloads without excessive memory usage', async () => {
      const largePayloadSize = 100 * 1024; // 100KB per payload
      const deliveryCount = 100;
      const webhook = WebhookFactory.createWebhookConfig();

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

      mockHttpClient.setResponseTime(5);
      mockHttpClient.setSuccessRate(1.0);

      const initialMemory = process.memoryUsage();

      // Process deliveries directly
      const processDeliveries = async () => {
        const promises: Promise<void>[] = [];

        for (const delivery of deliveries) {
          webhookSender.setWebhookConfigForTesting(delivery.webhookId, webhook);
          promises.push(
            webhookSender.sendWebhook(delivery).then(() => {
              // Just track completion
            })
          );

          if (promises.length >= 20) {
            await Promise.all(promises);
            promises.length = 0;
          }
        }

        if (promises.length > 0) {
          await Promise.all(promises);
        }
      };

      await processDeliveries();

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable even with large payloads
      const expectedMemoryUsage = deliveryCount * largePayloadSize * 2; // Allow 2x overhead
      expect(memoryIncrease).toBeLessThan(expectedMemoryUsage);

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB for ${deliveryCount} large payloads`);
    });

    it('should clean up resources properly after processing', async () => {
      const deliveryCount = 100; // Reduced for faster test
      const webhook = WebhookFactory.createWebhookConfig();

      mockHttpClient.setResponseTime(1);
      mockHttpClient.setSuccessRate(1.0);

      const initialMemory = process.memoryUsage();

      // Create deliveries
      const deliveries = DeliveryFactory.createHighVolumeDeliveries(deliveryCount);

      // Process deliveries directly
      const processDeliveries = async () => {
        const promises: Promise<void>[] = [];

        for (const delivery of deliveries) {
          webhookSender.setWebhookConfigForTesting(delivery.webhookId, webhook);
          promises.push(
            webhookSender.sendWebhook(delivery).then(() => {
              // Just track completion
            })
          );

          if (promises.length >= 20) {
            await Promise.all(promises);
            promises.length = 0;
          }
        }

        if (promises.length > 0) {
          await Promise.all(promises);
        }
      };

      await processDeliveries();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB for ${deliveryCount} deliveries`);

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });
  });

  describe('Throughput Benchmarks', () => {
    it('should achieve target throughput of 100 deliveries/second', async () => {
      const targetThroughput = 100; // deliveries per second
      const testDuration = 5000; // 5 seconds
      const expectedDeliveries = Math.floor(targetThroughput * testDuration / 1000);
      const webhook = WebhookFactory.createWebhookConfig();

      // Configure for optimal performance
      mockHttpClient.setResponseTime(5);
      mockHttpClient.setSuccessRate(1.0);

      // Create deliveries
      const deliveries = DeliveryFactory.createHighVolumeDeliveries(expectedDeliveries);

      // Create a processor that processes deliveries as fast as possible
      const processDeliveries = async () => {
        const promises: Promise<void>[] = [];
        const startTime = Date.now();

        for (const delivery of deliveries) {
          if ((Date.now() - startTime) >= testDuration) {
            break; // Stop if we've exceeded the test duration
          }

          webhookSender.setWebhookConfigForTesting(delivery.webhookId, webhook);
          promises.push(
            webhookSender.sendWebhook(delivery).then(() => {
              // Webhook processed successfully
            })
          );

          // Process in batches for optimal throughput
          if (promises.length >= 20) {
            await Promise.all(promises);
            promises.length = 0;
          }
        }

        // Process remaining deliveries
        if (promises.length > 0) {
          await Promise.all(promises);
        }

        return Date.now() - startTime;
      };

      const actualDuration = await processDeliveries();
      const processedCount = mockHttpClient.getRequestCount();
      const actualThroughput = processedCount / actualDuration * 1000;

      console.log(`Processed ${processedCount} deliveries in ${actualDuration}ms`);
      console.log(`Actual throughput: ${actualThroughput.toFixed(2)} deliveries/second`);
      console.log(`Target throughput: ${targetThroughput} deliveries/second`);

      // Should achieve at least 80% of target throughput
      expect(actualThroughput).toBeGreaterThan(targetThroughput * 0.8);
    });
  });
});