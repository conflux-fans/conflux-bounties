import { WebhookSender } from '../../src/webhooks/WebhookSender';
import { WebhookConfig } from '../../src/types/common';
import { WebhookDelivery } from '../../src/types/delivery';
import { v4 as uuidv4 } from 'uuid';

// Store original console for debugging
const originalConsole = console;

describe('Simple Webhook Test', () => {
  let webhookSender: WebhookSender;

  beforeAll(() => {
    // Restore console for this test
    global.console = originalConsole;
  });

  afterAll(() => {
    // Cleanup HTTP client to prevent Jest from hanging
    if (webhookSender && webhookSender['httpClient'] && typeof webhookSender['httpClient'].cleanup === 'function') {
      webhookSender['httpClient'].cleanup();
    }
  });

  it('should send webhook successfully', async () => {
    console.log('Creating webhook sender...');
    webhookSender = new WebhookSender();
    console.log('Webhook sender created');
    
    const webhook: WebhookConfig = {
      id: 'test-webhook',
      url: 'http://httpbin.org/post',
      format: 'generic',
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000, // Increase timeout
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
      payload: { test: 'data' },
      attempts: 0,
      maxAttempts: 3,
      status: 'pending'
    };
    
    console.log('Setting webhook config...');
    webhookSender.setWebhookConfigForTesting('test-webhook', webhook);
    console.log('Webhook config set');
    
    // Add retry logic for network issues
    let result: any;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        result = await webhookSender.sendWebhook(delivery);
        if (result.success) {
          break;
        }
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`Attempt ${attempts} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw error;
        }
        console.log(`Attempt ${attempts} threw error, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('Full result:', JSON.stringify(result, null, 2));
    
    expect(result).toBeDefined();
    
    // If httpbin.org is unreachable, skip this test
    if (!result?.success && (result?.error?.includes('ENOTFOUND') || result?.error?.includes('ECONNREFUSED'))) {
      console.warn('Skipping test due to network connectivity issues with httpbin.org');
      return;
    }
    
    if (!result?.success) {
      console.log('Error details:', result?.error);
      console.log('Status code:', result?.statusCode);
    }
    expect(result?.success).toBe(true);
  }, 30000);
});