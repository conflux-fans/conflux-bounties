import { WebhookSender } from '../../src/webhooks/WebhookSender';
import { WebhookConfig } from '../../src/types/common';
import { WebhookDelivery } from '../../src/types/delivery';
import { v4 as uuidv4 } from 'uuid';

describe('Simple Webhook Test', () => {
  it('should send webhook successfully', async () => {
    console.log('Creating webhook sender...');
    const webhookSender = new WebhookSender();
    console.log('Webhook sender created');
    
    const webhook: WebhookConfig = {
      id: 'test-webhook',
      url: 'https://httpbin.org/post',
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
      payload: { test: 'data' },
      attempts: 0,
      maxAttempts: 3,
      status: 'pending'
    };
    
    console.log('Setting webhook config...');
    webhookSender.setWebhookConfigForTesting('test-webhook', webhook);
    console.log('Webhook config set');
    
    const result = await webhookSender.sendWebhook(delivery);
    
    expect(result).toBeDefined();
    expect(result.error || 'No error').toContain(''); // This will show the error in the test output
    expect(result.success).toBe(true);
  }, 10000);
});