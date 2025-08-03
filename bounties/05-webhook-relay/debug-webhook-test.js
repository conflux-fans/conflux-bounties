const { WebhookSender } = require('./dist/webhooks/WebhookSender');
const { HttpClient } = require('./dist/webhooks/HttpClient');
const { DeliveryTracker } = require('./dist/webhooks/DeliveryTracker');

// Create instances
const httpClient = new HttpClient();
const deliveryTracker = new DeliveryTracker();
const webhookSender = new WebhookSender(httpClient, deliveryTracker);

// Create test data
const zapierWebhook = {
  id: 'test-webhook-id',
  url: 'http://httpbin.org/post',
  format: 'zapier',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000,
  retryAttempts: 3
};

const event = {
  contractAddress: '0x1234567890123456789012345678901234567890',
  eventName: 'Transfer',
  blockNumber: 12345,
  transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  logIndex: 0,
  args: {
    from: '0x1234567890123456789012345678901234567890',
    to: '0x0987654321098765432109876543210987654321',
    value: '1000000000000000000'
  },
  timestamp: new Date('2024-01-01T00:00:00Z')
};

const delivery = {
  id: 'test-delivery-id',
  subscriptionId: 'test-subscription-id',
  webhookId: zapierWebhook.id,
  event: event,
  payload: {
    event_name: event.eventName,
    contract_address: event.contractAddress,
    block_number: event.blockNumber,
    transaction_hash: event.transactionHash,
    arg_from: event.args.from,
    arg_to: event.args.to,
    arg_value: event.args.value
  },
  attempts: 0,
  maxAttempts: 3,
  status: 'pending'
};

async function testWebhookDelivery() {
  console.log('Testing webhook delivery...');
  
  try {
    // Set webhook config for testing
    console.log('Setting webhook config...');
    webhookSender.setWebhookConfigForTesting(zapierWebhook.id, zapierWebhook);
    
    // Validate webhook config
    console.log('Validating webhook config...');
    const validation = webhookSender.validateWebhookConfig(zapierWebhook);
    console.log('Validation result:', validation);
    
    if (!validation.isValid) {
      console.error('Webhook config is invalid:', validation.errors);
      return;
    }
    
    // Send webhook
    console.log('Sending webhook...');
    const result = await webhookSender.sendWebhook(delivery);
    console.log('Webhook result:', result);
    
    if (result.success) {
      console.log('✅ Webhook delivery successful!');
    } else {
      console.log('❌ Webhook delivery failed:', result.error);
    }
  } catch (error) {
    console.error('Error during test:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testWebhookDelivery();