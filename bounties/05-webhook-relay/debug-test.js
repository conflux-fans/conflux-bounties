const { WebhookSender } = require('./dist/webhooks/WebhookSender');
const { v4: uuidv4 } = require('uuid');

async function testWebhook() {
  console.log('Starting debug test...');
  
  const webhookSender = new WebhookSender();
  console.log('WebhookSender created');
  
  const webhook = {
    id: 'test-webhook',
    url: 'http://httpbin.org/post',
    format: 'generic',
    headers: { 'Content-Type': 'application/json' },
    timeout: 5000,
    retryAttempts: 3
  };
  
  const delivery = {
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
      data: { from: '0x111', to: '0x222', value: '1000' },
      timestamp: new Date().toISOString()
    },
    attempts: 0,
    maxAttempts: 3,
    status: 'pending'
  };
  
  console.log('Setting webhook config...');
  webhookSender.setWebhookConfigForTesting('test-webhook', webhook);
  console.log('Webhook config set');
  
  try {
    console.log('Sending webhook...');
    const result = await webhookSender.sendWebhook(delivery);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testWebhook().catch(console.error);