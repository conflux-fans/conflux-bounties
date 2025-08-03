import { DeliveryFactory, WebhookFactory, EventFactory } from './tests/factories';

describe('Debug Minimal Test', () => {
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
});