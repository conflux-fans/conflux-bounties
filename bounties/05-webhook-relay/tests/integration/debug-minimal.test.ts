import { WebhookSender } from '../../src/webhooks/WebhookSender';
import { HttpClient } from '../../src/webhooks/HttpClient';
import { DeliveryTracker } from '../../src/webhooks/DeliveryTracker';
import { DeliveryFactory, WebhookFactory, EventFactory } from '../factories';

describe('Debug Minimal Test', () => {
  let webhookSender: WebhookSender;
  let httpClient: HttpClient;

  beforeAll(() => {
    httpClient = new HttpClient();
    const deliveryTracker = new DeliveryTracker();
    webhookSender = new WebhookSender(httpClient, deliveryTracker);
  });

  afterAll(() => {
    // Cleanup HTTP client to prevent Jest from hanging
    if (httpClient && typeof httpClient.cleanup === 'function') {
      httpClient.cleanup();
    }
  });

  it('should create objects successfully', () => {
    console.log('Starting minimal test...');

    const event = EventFactory.createTransferEvent({
      from: '0x1234567890123456789012345678901234567890',
      to: '0x0987654321098765432109876543210987654321',
      value: '1000000000000000000'
    });
    console.log('Event created:', !!event);
    expect(event).toBeTruthy();

    const zapierWebhook = WebhookFactory.createZapierWebhook('http://httpbin.org/post');
    console.log('Zapier webhook created:', !!zapierWebhook);
    expect(zapierWebhook).toBeTruthy();

    const zapierDelivery = DeliveryFactory.createWebhookDelivery({
      webhookId: zapierWebhook.id,
      event,
      payload: DeliveryFactory.createFormattedPayload('zapier', event)
    });
    console.log('Zapier delivery created:', !!zapierDelivery);
    expect(zapierDelivery).toBeTruthy();

    console.log('All objects created successfully!');
  });

  it('should send webhook successfully', async () => {
    console.log('Starting webhook delivery test...');

    const event = EventFactory.createTransferEvent({
      from: '0x1234567890123456789012345678901234567890',
      to: '0x0987654321098765432109876543210987654321',
      value: '1000000000000000000'
    });

    const zapierWebhook = WebhookFactory.createZapierWebhook('http://httpbin.org/post');
    // Increase timeout for better reliability
    zapierWebhook.timeout = 10000;
    
    const zapierDelivery = DeliveryFactory.createWebhookDelivery({
      webhookId: zapierWebhook.id,
      event,
      payload: DeliveryFactory.createFormattedPayload('zapier', event)
    });

    webhookSender.setWebhookConfigForTesting(zapierWebhook.id, zapierWebhook);
    console.log('Webhook config set for testing');

    // Add retry logic for network issues
    let result: any;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        result = await webhookSender.sendWebhook(zapierDelivery);
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

    console.log('Webhook result:', result);

    // If httpbin.org is unreachable, skip this test
    if (!result?.success && (result?.error?.includes('ENOTFOUND') || result?.error?.includes('ECONNREFUSED'))) {
      console.warn('Skipping test due to network connectivity issues with httpbin.org');
      return;
    }

    expect(result?.success).toBe(true);
    expect(result?.statusCode).toBe(200);
  }, 45000);
});