import { WebhookSender } from '../../src/webhooks/WebhookSender';
import { HttpClient } from '../../src/webhooks/HttpClient';
import { DeliveryTracker } from '../../src/webhooks/DeliveryTracker';
import { DeliveryFactory, WebhookFactory, EventFactory } from '../factories';

describe('Debug Minimal Test', () => {
  let webhookSender: WebhookSender;

  beforeAll(() => {
    const httpClient = new HttpClient();
    const deliveryTracker = new DeliveryTracker();
    webhookSender = new WebhookSender(httpClient, deliveryTracker);
  });

  it('should create objects successfully', () => {
    console.log('Starting minimal test...');
    
    const event = EventFactory.createTransferEvent(
      '0x1234567890123456789012345678901234567890',
      '0x0987654321098765432109876543210987654321',
      '1000000000000000000'
    );
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
    
    const event = EventFactory.createTransferEvent(
      '0x1234567890123456789012345678901234567890',
      '0x0987654321098765432109876543210987654321',
      '1000000000000000000'
    );
    
    const zapierWebhook = WebhookFactory.createZapierWebhook('http://httpbin.org/post');
    const zapierDelivery = DeliveryFactory.createWebhookDelivery({
      webhookId: zapierWebhook.id,
      event,
      payload: DeliveryFactory.createFormattedPayload('zapier', event)
    });

    webhookSender.setWebhookConfigForTesting(zapierWebhook.id, zapierWebhook);
    console.log('Webhook config set for testing');
    
    const result = await webhookSender.sendWebhook(zapierDelivery);
    console.log('Webhook result:', result);

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
  });
});