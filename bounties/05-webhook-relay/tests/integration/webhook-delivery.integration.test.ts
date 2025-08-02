import express from 'express';
import { Server } from 'http';
import { WebhookSender } from '../../src/webhooks/WebhookSender';
import { HttpClient } from '../../src/webhooks/HttpClient';
import { DeliveryTracker } from '../../src/webhooks/DeliveryTracker';
import { DeliveryFactory, WebhookFactory, EventFactory } from '../factories';

// Mock webhook server for testing external delivery
class TestWebhookServer {
  private app: express.Application;
  private server: Server | null = null;
  private receivedRequests: any[] = [];
  private responseConfig: { status: number; delay?: number; body?: any } = { status: 200 };

  constructor(private port: number = 3334) {
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes() {
    // Success endpoint
    this.app.post('/success', (req, res) => {
      this.receivedRequests.push({
        path: '/success',
        method: 'POST',
        headers: req.headers,
        body: req.body,
        timestamp: new Date()
      });

      setTimeout(() => {
        res.status(this.responseConfig.status).json(this.responseConfig.body || { success: true });
      }, this.responseConfig.delay || 0);
    });

    // Failure endpoint
    this.app.post('/failure', (req, res) => {
      this.receivedRequests.push({
        path: '/failure',
        method: 'POST',
        headers: req.headers,
        body: req.body,
        timestamp: new Date()
      });

      res.status(500).json({ error: 'Internal server error' });
    });

    // Timeout endpoint
    this.app.post('/timeout', (req, _res) => {
      this.receivedRequests.push({
        path: '/timeout',
        method: 'POST',
        headers: req.headers,
        body: req.body,
        timestamp: new Date()
      });

      // Never respond to simulate timeout
    });

    // Authentication endpoint
    this.app.post('/auth', (req, res) => {
      this.receivedRequests.push({
        path: '/auth',
        method: 'POST',
        headers: req.headers,
        body: req.body,
        timestamp: new Date()
      });

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      return res.status(200).json({ success: true, authenticated: true });
    });

    // Rate limited endpoint
    this.app.post('/rate-limited', (req, res) => {
      this.receivedRequests.push({
        path: '/rate-limited',
        method: 'POST',
        headers: req.headers,
        body: req.body,
        timestamp: new Date()
      });

      if (this.receivedRequests.filter(r => r.path === '/rate-limited').length > 3) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }

      return res.status(200).json({ success: true });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Test webhook server started on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => resolve());
      });
    }
  }

  getReceivedRequests() {
    return this.receivedRequests;
  }

  clearRequests() {
    this.receivedRequests = [];
  }

  setResponseConfig(config: { status: number; delay?: number; body?: any }) {
    this.responseConfig = config;
  }
}

describe('Webhook Delivery Integration Tests', () => {
  let testServer: TestWebhookServer;
  let webhookSender: WebhookSender;
  let httpClient: HttpClient;
  let deliveryTracker: DeliveryTracker;

  beforeAll(async () => {
    testServer = new TestWebhookServer();
    await testServer.start();

    // Initialize components
    httpClient = new HttpClient();
    deliveryTracker = new DeliveryTracker();
    webhookSender = new WebhookSender(httpClient, deliveryTracker);
  }, 10000);

  afterAll(async () => {
    if (testServer) {
      await testServer.stop();
    }
  });

  beforeEach(() => {
    testServer.clearRequests();
    testServer.setResponseConfig({ status: 200 });
  });

  describe('Successful Webhook Delivery', () => {
    it('should deliver webhook successfully to external endpoint', async () => {
      const webhook = WebhookFactory.createWebhookConfig({
        url: 'http://localhost:3334/success',
        format: 'generic'
      });

      const delivery = DeliveryFactory.createWebhookDelivery({
        webhookId: webhook.id
      });

      // Set up webhook config for testing
      webhookSender.setWebhookConfigForTesting(webhook.id, webhook);

      const result = await webhookSender.sendWebhook(delivery);

      console.log('Webhook result:', result);
      console.log('Test server requests:', testServer.getReceivedRequests());

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.responseTime).toBeGreaterThan(0);

      const requests = testServer.getReceivedRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].path).toBe('/success');
    });

    it('should include correct headers in webhook delivery', async () => {
      const webhook = WebhookFactory.createWebhookConfig({
        url: 'http://localhost:3334/success',
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'test-value',
          'Authorization': 'Bearer test-token'
        }
      });

      const delivery = DeliveryFactory.createWebhookDelivery({
        webhookId: webhook.id
      });

      webhookSender.setWebhookConfigForTesting(webhook.id, webhook);
      await webhookSender.sendWebhook(delivery);

      const requests = testServer.getReceivedRequests();
      expect(requests[0].headers['content-type']).toBe('application/json');
      expect(requests[0].headers['x-custom-header']).toBe('test-value');
      expect(requests[0].headers['authorization']).toBe('Bearer test-token');
    });

    it('should format payload correctly for different platforms', async () => {
      const event = EventFactory.createTransferEvent(
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321',
        '1000000000000000000'
      );

      // Test Zapier format
      const zapierWebhook = WebhookFactory.createZapierWebhook('http://localhost:3334/success');
      const zapierDelivery = DeliveryFactory.createWebhookDelivery({
        webhookId: zapierWebhook.id,
        event,
        payload: DeliveryFactory.createFormattedPayload('zapier', event)
      });

      webhookSender.setWebhookConfigForTesting(zapierWebhook.id, zapierWebhook);
      await webhookSender.sendWebhook(zapierDelivery);

      const requests = testServer.getReceivedRequests();
      expect(requests[0].body.event_name).toBe('Transfer');
      expect(requests[0].body.contract_address).toBe(event.contractAddress);

      testServer.clearRequests();

      // Test Make format
      const makeWebhook = WebhookFactory.createMakeWebhook('http://localhost:3334/success');
      const makeDelivery = DeliveryFactory.createWebhookDelivery({
        webhookId: makeWebhook.id,
        event,
        payload: DeliveryFactory.createFormattedPayload('make', event)
      });

      webhookSender.setWebhookConfigForTesting(makeWebhook.id, makeWebhook);
      await webhookSender.sendWebhook(makeDelivery);

      const makeRequests = testServer.getReceivedRequests();
      expect(makeRequests[0].body.eventName).toBe('Transfer');
      expect(makeRequests[0].body.contractAddress).toBe(event.contractAddress);
    });
  });

  describe('Failed Webhook Delivery', () => {
    it('should handle HTTP error responses', async () => {
      const webhook = WebhookFactory.createWebhookConfig({
        url: 'http://localhost:3334/failure'
      });

      const delivery = DeliveryFactory.createWebhookDelivery({
        webhookId: webhook.id
      });

      webhookSender.setWebhookConfigForTesting(webhook.id, webhook);
      const result = await webhookSender.sendWebhook(delivery);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.error).toContain('500');
    });

    it('should handle connection timeouts', async () => {
      const webhook = WebhookFactory.createWebhookConfig({
        url: 'http://localhost:3334/timeout',
        timeout: 1000 // 1 second timeout
      });

      const delivery = DeliveryFactory.createWebhookDelivery({
        webhookId: webhook.id
      });

      webhookSender.setWebhookConfigForTesting(webhook.id, webhook);
      const result = await webhookSender.sendWebhook(delivery);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 10000);

    it('should handle unreachable endpoints', async () => {
      const webhook = WebhookFactory.createWebhookConfig({
        url: 'http://localhost:9999/unreachable' // Non-existent server
      });

      const delivery = DeliveryFactory.createWebhookDelivery({
        webhookId: webhook.id
      });

      webhookSender.setWebhookConfigForTesting(webhook.id, webhook);
      const result = await webhookSender.sendWebhook(delivery);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should handle authentication failures', async () => {
      const webhook = WebhookFactory.createWebhookConfig({
        url: 'http://localhost:3334/auth',
        headers: {
          'Content-Type': 'application/json'
          // Missing Authorization header
        }
      });

      const delivery = DeliveryFactory.createWebhookDelivery({
        webhookId: webhook.id
      });

      webhookSender.setWebhookConfigForTesting(webhook.id, webhook);
      const result = await webhookSender.sendWebhook(delivery);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(401);
    });
  });

  describe('Concurrent Webhook Delivery', () => {
    it('should handle multiple concurrent deliveries', async () => {
      const webhooks = WebhookFactory.createBatchWebhooks(10, {
        url: 'http://localhost:3334/success'
      });

      const deliveries = webhooks.map(webhook => 
        DeliveryFactory.createWebhookDelivery({ webhookId: webhook.id })
      );

      // Set up webhook configs for testing
      webhooks.forEach(webhook => {
        webhookSender.setWebhookConfigForTesting(webhook.id, webhook);
      });

      const promises = deliveries.map(delivery => 
        webhookSender.sendWebhook(delivery)
      );

      const results = await Promise.all(promises);

      expect(results.every(result => result.success)).toBe(true);
      expect(testServer.getReceivedRequests()).toHaveLength(10);
    });

    it('should handle mixed success and failure scenarios', async () => {
      const successWebhook = WebhookFactory.createWebhookConfig({
        url: 'http://localhost:3334/success'
      });

      const failureWebhook = WebhookFactory.createWebhookConfig({
        url: 'http://localhost:3334/failure'
      });

      const deliveries = [
        DeliveryFactory.createWebhookDelivery({ webhookId: successWebhook.id }),
        DeliveryFactory.createWebhookDelivery({ webhookId: failureWebhook.id }),
        DeliveryFactory.createWebhookDelivery({ webhookId: successWebhook.id })
      ];

      // Set up webhook configs for testing
      webhookSender.setWebhookConfigForTesting(successWebhook.id, successWebhook);
      webhookSender.setWebhookConfigForTesting(failureWebhook.id, failureWebhook);

      const promises = [
        webhookSender.sendWebhook(deliveries[0]!),
        webhookSender.sendWebhook(deliveries[1]!),
        webhookSender.sendWebhook(deliveries[2]!)
      ];

      const results = await Promise.all(promises);

      expect(results[0]?.success).toBe(true);
      expect(results[1]?.success).toBe(false);
      expect(results[2]?.success).toBe(true);
    });
  });

  describe('Rate Limiting and Backpressure', () => {
    it('should handle rate-limited endpoints', async () => {
      const webhook = WebhookFactory.createWebhookConfig({
        url: 'http://localhost:3334/rate-limited'
      });

      // Send multiple requests to trigger rate limiting
      const deliveries = Array.from({ length: 5 }, () => 
        DeliveryFactory.createWebhookDelivery({ webhookId: webhook.id })
      );

      webhookSender.setWebhookConfigForTesting(webhook.id, webhook);

      const results = await Promise.all(
        deliveries.map(delivery => webhookSender.sendWebhook(delivery))
      );

      // First few should succeed, later ones should fail with 429
      const successCount = results.filter(r => r.success).length;
      const rateLimitedCount = results.filter(r => r.statusCode === 429).length;

      expect(successCount).toBeGreaterThan(0);
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('Response Time Tracking', () => {
    it('should track response times accurately', async () => {
      // Configure server to respond with delay
      testServer.setResponseConfig({ status: 200, delay: 100 });

      const webhook = WebhookFactory.createWebhookConfig({
        url: 'http://localhost:3334/success'
      });

      const delivery = DeliveryFactory.createWebhookDelivery({
        webhookId: webhook.id
      });

      webhookSender.setWebhookConfigForTesting(webhook.id, webhook);
      const result = await webhookSender.sendWebhook(delivery);

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeGreaterThanOrEqual(100);
      expect(result.responseTime).toBeLessThan(200); // Should be close to 100ms
    });

    it('should track response times for failed requests', async () => {
      const webhook = WebhookFactory.createWebhookConfig({
        url: 'http://localhost:3334/failure'
      });

      const delivery = DeliveryFactory.createWebhookDelivery({
        webhookId: webhook.id
      });

      webhookSender.setWebhookConfigForTesting(webhook.id, webhook);
      const result = await webhookSender.sendWebhook(delivery);

      expect(result.success).toBe(false);
      expect(result.responseTime).toBeGreaterThan(0);
    });
  });

  describe('Large Payload Handling', () => {
    it('should handle large webhook payloads', async () => {
      const webhook = WebhookFactory.createWebhookConfig({
        url: 'http://localhost:3334/success'
      });

      // Create large payload
      const largePayload = {
        event: 'Transfer',
        data: {
          from: '0x1234567890123456789012345678901234567890',
          to: '0x0987654321098765432109876543210987654321',
          value: '1000000000000000000',
          metadata: 'x'.repeat(10000) // 10KB of data
        }
      };

      const delivery = DeliveryFactory.createWebhookDelivery({
        webhookId: webhook.id,
        payload: largePayload
      });

      webhookSender.setWebhookConfigForTesting(webhook.id, webhook);
      const result = await webhookSender.sendWebhook(delivery);

      expect(result.success).toBe(true);
      
      const requests = testServer.getReceivedRequests();
      expect(requests[0].body.data.metadata).toHaveLength(10000);
    });
  });
});