// Test with mocked HTTP client to see what's being sent
import { WebhookSender } from '../../src/webhooks/WebhookSender';
import { WebhookConfig } from '../../src/types/common';
import { WebhookDelivery } from '../../src/types/delivery';
import { DeliveryResult } from '../../src/types/webhooks';
import { v4 as uuidv4 } from 'uuid';

// Override the global console mock for this test
const originalConsole = console;

// Mock HTTP client
class MockHttpClient {
  public lastRequest: { url: string; data: any; headers: Record<string, string>; timeout: number } | null = null;

  async post(
    url: string,
    data: any,
    headers: Record<string, string>,
    timeout: number
  ): Promise<DeliveryResult> {
    this.lastRequest = { url, data, headers, timeout };
    
    console.log('=== MOCK HTTP CLIENT ===');
    console.log('URL:', url);
    console.log('Data:', JSON.stringify(data, null, 2));
    console.log('Headers:', headers);
    console.log('Timeout:', timeout);
    
    return {
      success: true,
      statusCode: 200,
      responseTime: 100
    };
  }
}

describe('Mock Webhook Test', () => {
  beforeAll(() => {
    // Restore console for debugging
    global.console = originalConsole;
  });

  it('should format and send webhook payload correctly', async () => {
    console.log('=== DEBUG: Starting mock test ===');
    
    const mockHttpClient = new MockHttpClient();
    const webhookSender = new WebhookSender(mockHttpClient as any);
    
    const webhook: WebhookConfig = {
      id: 'test-webhook',
      url: 'http://localhost:3335/webhook',
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
    
    console.log('Sending webhook...');
    const result = await webhookSender.sendWebhook(delivery);
    
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('Last request:', JSON.stringify(mockHttpClient.lastRequest, null, 2));
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(mockHttpClient.lastRequest).toBeDefined();
    expect(mockHttpClient.lastRequest?.url).toBe(webhook.url);
    
    console.log('=== DEBUG: Mock test completed successfully ===');
  });
});