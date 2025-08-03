// Minimal test to debug the factory issue
const { execSync } = require('child_process');

// Run a simple Jest test to see what's happening
const testCode = `
describe('Debug Factory Issue', () => {
  it('should create delivery successfully', () => {
    const { DeliveryFactory, WebhookFactory, EventFactory } = require('../tests/factories');
    
    console.log('Creating event...');
    const event = EventFactory.createTransferEvent(
      '0x1234567890123456789012345678901234567890',
      '0x0987654321098765432109876543210987654321',
      '1000000000000000000'
    );
    
    console.log('Creating webhook...');
    const zapierWebhook = WebhookFactory.createZapierWebhook('http://httpbin.org/post');
    
    console.log('Creating delivery...');
    const zapierDelivery = DeliveryFactory.createWebhookDelivery({
      webhookId: zapierWebhook.id,
      event,
      payload: DeliveryFactory.createFormattedPayload('zapier', event)
    });
    
    expect(zapierDelivery).toBeTruthy();
    expect(typeof zapierDelivery).toBe('object');
  });
});
`;

require('fs').writeFileSync('debug-minimal.test.js', testCode);

try {
  const result = execSync('npx jest debug-minimal.test.js --verbose', { encoding: 'utf8' });
  console.log('Test result:', result);
} catch (error) {
  console.error('Test error:', error.stdout || error.message);
} finally {
  // Clean up
  require('fs').unlinkSync('debug-minimal.test.js');
}