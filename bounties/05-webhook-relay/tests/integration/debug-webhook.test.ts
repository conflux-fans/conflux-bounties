import { WebhookSender } from '../../src/webhooks/WebhookSender';
import { IHttpClient } from '../../src/webhooks/interfaces';
import { DeliveryTracker } from '../../src/webhooks/DeliveryTracker';
import { DeliveryFactory } from '../factories';

describe('Debug Webhook Test', () => {
  let webhookSender: WebhookSender;
  let mockHttpClient: jest.Mocked<IHttpClient>;
  let deliveryTracker: DeliveryTracker;

  beforeEach(() => {
    mockHttpClient = {
      post: jest.fn()
    } as jest.Mocked<IHttpClient>;
    deliveryTracker = new DeliveryTracker();
    webhookSender = new WebhookSender(mockHttpClient, deliveryTracker);
  });

  it('should send webhook successfully', async () => {
    console.log('Starting debug webhook test...');
    
    // Mock successful HTTP response
    mockHttpClient.post.mockResolvedValue({
      success: true,
      statusCode: 200,
      responseTime: 150
    });
    
    // Create a test delivery
    const delivery = DeliveryFactory.createWebhookDelivery({
      webhookId: 'test-webhook',
      event: {
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventName: 'Transfer',
        blockNumber: 12345,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        logIndex: 0,
        args: {
          from: '0x0000000000000000000000000000000000000000',
          to: '0x1111111111111111111111111111111111111111',
          value: '1000000000000000000'
        },
        timestamp: new Date()
      }
    });
    
    console.log('Created delivery:', JSON.stringify(delivery, null, 2));
    
    // Create webhook configuration
    const webhook = {
      id: 'test-webhook',
      name: 'Test Webhook',
      url: 'https://httpbin.org/post',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Header': 'test-value'
      },
      format: 'generic' as const,
      timeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000,
      active: true,
      subscriptions: [{
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventName: 'Transfer',
        filters: {}
      }],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTriggered: null,
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      averageResponseTime: 0,
      status: 'pending'
    };
    
    console.log('Setting webhook config...');
    webhookSender.setWebhookConfigForTesting('test-webhook', webhook);
    console.log('Webhook config set successfully');
    
    console.log('Sending webhook...');
    const result = await webhookSender.sendWebhook(delivery);
    console.log('Full result:', JSON.stringify(result, null, 2));
    
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.responseTime).toBeGreaterThan(0);
    
    // Verify the HTTP client was called with correct parameters
    expect(mockHttpClient.post).toHaveBeenCalledWith(
      'https://httpbin.org/post',
      expect.objectContaining({
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventName: 'Transfer',
        blockNumber: 12345,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        logIndex: 0,
        args: expect.objectContaining({
          from: '0x0000000000000000000000000000000000000000',
          to: '0x1111111111111111111111111111111111111111',
          value: '1000000000000000000'
        }),
        timestamp: expect.any(String)
      }),
      {
        'Content-Type': 'application/json',
        'X-Test-Header': 'test-value'
      },
      5000
    );
    
    console.log('Debug webhook test completed successfully!');
  });
});