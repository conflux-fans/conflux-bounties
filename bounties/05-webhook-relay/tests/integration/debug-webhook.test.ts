// Debug test without global setup
import { WebhookSender } from '../../src/webhooks/WebhookSender';
import { WebhookConfig } from '../../src/types/common';
import { WebhookDelivery } from '../../src/types/delivery';
import { v4 as uuidv4 } from 'uuid';
import express from 'express';
import { Server } from 'http';

// Override the global console mock for this test
const originalConsole = console;

describe('Debug Webhook Test', () => {
  let testServer: Server;
  let receivedPayload: any = null;

  beforeAll(async () => {
    // Restore console for debugging
    global.console = originalConsole;
    
    // Create a simple test server
    const app = express();
    app.use(express.json());
    
    app.post('/webhook', (req, res) => {
      console.log('=== RECEIVED WEBHOOK ===');
      console.log('Headers:', req.headers);
      console.log('Body:', JSON.stringify(req.body, null, 2));
      receivedPayload = req.body;
      res.status(200).json({ success: true });
    });
    
    await new Promise<void>((resolve) => {
      testServer = app.listen(3335, () => {
        console.log('Test server started on port 3335');
        setTimeout(resolve, 100); // Small delay to ensure server is ready
      });
    });
  });

  afterAll(async () => {
    if (testServer) {
      testServer.close();
    }
  });

  it('should send webhook successfully', async () => {
    console.log('=== DEBUG: Starting test ===');
    
    try {
      console.log('Creating webhook sender...');
      const webhookSender = new WebhookSender();
      console.log('Webhook sender created successfully');
      
      const webhook: WebhookConfig = {
        id: 'test-webhook',
        url: 'http://httpbin.org/post',
        format: 'generic',
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
        retryAttempts: 3
      };
      
      const delivery: WebhookDelivery = {
        id: uuidv4(),
        subscriptionId: uuidv4(),
        webhookId: 'test-webhook',
        event: {
          contractAddress: '0x123',
          eventName: 'Transfer',
          blockNumber: 12345,
          transactionHash: '0xabc',
          logIndex: 0,
          args: { from: '0x111', to: '0x222', value: '1000' },
          timestamp: new Date()
        },
        payload: {
          event: 'Transfer',
          contractAddress: '0x123',
          blockNumber: 12345,
          transactionHash: '0xabc',
          data: { from: '0x111', to: '0x222', value: '1000' },
          timestamp: new Date().toISOString()
        },
        attempts: 0,
        maxAttempts: 3,
        status: 'pending'
      };
      
      console.log('Setting webhook config...');
      webhookSender.setWebhookConfigForTesting('test-webhook', webhook);
      console.log('Webhook config set successfully');
      
      console.log('Sending webhook...');
      const result = await webhookSender.sendWebhook(delivery);
      console.log('Webhook result:', JSON.stringify(result, null, 2));
      
      expect(result).toBeDefined();
      
      if (!result.success) {
        console.error('Webhook failed with error:', result.error);
        throw new Error(`Webhook delivery failed: ${result.error}`);
      }
      
      expect(result.success).toBe(true);
      expect(receivedPayload).toBeDefined();
      console.log('=== DEBUG: Test completed successfully ===');
      
    } catch (error) {
      console.error('=== DEBUG: Test failed with error ===');
      console.error(error);
      throw error;
    }
  }, 15000);
});