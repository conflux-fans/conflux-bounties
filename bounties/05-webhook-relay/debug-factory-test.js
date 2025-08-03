// Test the factory methods directly
const fs = require('fs');
const path = require('path');

// Since the factories are not compiled to dist, let's use ts-node to run them
const { execSync } = require('child_process');

// Create a simple TypeScript test file
const testCode = `
import { DeliveryFactory, WebhookFactory, EventFactory } from './tests/factories';

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

  console.log('2. Creating Zapier webhook...');
  const zapierWebhook = WebhookFactory.createZapierWebhook('http://httpbin.org/post');
  console.log('Zapier webhook created successfully:', !!zapierWebhook);
  console.log('Webhook type:', typeof zapierWebhook);

  console.log('3. Creating formatted payload...');
  const payload = DeliveryFactory.createFormattedPayload('zapier', event);
  console.log('Payload created successfully:', !!payload);
  console.log('Payload type:', typeof payload);

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
`;

fs.writeFileSync('test-factories.ts', testCode);

try {
  console.log('Running factory test with ts-node...');
  const result = execSync('npx ts-node test-factories.ts', { encoding: 'utf8' });
  console.log(result);
} catch (error) {
  console.error('Error running test:', error.stdout || error.message);
} finally {
  // Clean up
  if (fs.existsSync('test-factories.ts')) {
    fs.unlinkSync('test-factories.ts');
  }
}