const { DeliveryFactory, WebhookFactory, EventFactory } = require('./dist/tests/factories');

console.log('Testing factory methods...');

try {
  console.log('1. Creating transfer event...');
  const event = EventFactory.createTransferEvent(
    '0x1234567890123456789012345678901234567890',
    '0x0987654321098765432109876543210987654321',
    '1000000000000000000'
  );
  console.log('Event created successfully:', !!event);
  console.log('Event type:', typeof event);
  console.log('Event keys:', Object.keys(event));

  console.log('2. Creating Zapier webhook...');
  const zapierWebhook = WebhookFactory.createZapierWebhook('http://httpbin.org/post');
  console.log('Zapier webhook created successfully:', !!zapierWebhook);
  console.log('Webhook type:', typeof zapierWebhook);
  console.log('Webhook keys:', Object.keys(zapierWebhook));

  console.log('3. Creating formatted payload...');
  const payload = DeliveryFactory.createFormattedPayload('zapier', event);
  console.log('Payload created successfully:', !!payload);
  console.log('Payload type:', typeof payload);
  console.log('Payload keys:', Object.keys(payload));

  console.log('4. Creating webhook delivery...');
  const zapierDelivery = DeliveryFactory.createWebhookDelivery({
    webhookId: zapierWebhook.id,
    event,
    payload: payload
  });
  console.log('Zapier delivery created successfully:', !!zapierDelivery);
  console.log('Delivery type:', typeof zapierDelivery);
  console.log('Delivery keys:', Object.keys(zapierDelivery));

  console.log('All factory methods work correctly!');
} catch (error) {
  console.error('Error occurred:', error.message);
  console.error('Stack trace:', error.stack);
}