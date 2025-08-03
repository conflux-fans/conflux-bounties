const { WebhookSender } = require('./dist/webhooks/WebhookSender');
const { HttpClient } = require('./dist/webhooks/HttpClient');
const { DeliveryTracker } = require('./dist/webhooks/DeliveryTracker');
const { v4: uuidv4 } = require('uuid');

async function testWebhookSender() {
  console.log('Testing WebhookSender...');
  
  try {
    // Create components
    const httpClient = new HttpClient();
    const deliveryTracker = new DeliveryTracker();
    const webhookSender = new WebhookSender(httpClient, deliveryTracker);
    
    // Create test webhook config manually
    const zapierWebhook = {
      id: uuidv4(),
      url: 'http://httpbin.org/post',
      format: 'zapier',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      retryAttempts: 3
    };
    
    console.log('Created webhook config:', zapierWebhook);
    
    // Create test delivery manually
    const zapierDelivery = {
      id: uuidv4(),
      subscriptionId: uuidv4(),
      webhookId: zapierWebhook.id,
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
      },
      payload: {
        event: 'Transfer',
        data: {
          from: '0x0000000000000000000000000000000000000000',
          to: '0x1111111111111111111111111111111111111111',
          value: '1000000000000000000'
        },
        timestamp: new Date().toISOString()
      },
      attempts: 0,
      maxAttempts: 3,
      status: 'pending'
    };
    
    console.log('Created delivery:', zapierDelivery);
    
    // Set webhook config for testing
    webhookSender.setWebhookConfigForTesting(zapierWebhook.id, zapierWebhook);
    
    // Send webhook
    console.log('Sending webhook...');
    const result = await webhookSender.sendWebhook(zapierDelivery);
    
    console.log('Result:', JSON.stringify(result, null, 2));
    
    if (!result.success) {
      console.error('Webhook failed:', result.error);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testWebhookSender();