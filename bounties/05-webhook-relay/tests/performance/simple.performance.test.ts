import { EventFactory, DeliveryFactory, WebhookFactory } from '../factories';

describe('Simple Performance Tests', () => {
  it('should create 1000 events quickly', async () => {
    const startTime = Date.now();
    
    const events = EventFactory.createBatchEvents(1000);
    
    const processingTime = Date.now() - startTime;
    
    expect(events).toHaveLength(1000);
    expect(processingTime).toBeLessThan(1000); // Should complete within 1 second
    
    console.log(`Created 1000 events in ${processingTime}ms`);
  });

  it('should create 500 webhook deliveries quickly', async () => {
    const startTime = Date.now();
    
    const deliveries = DeliveryFactory.createHighVolumeDeliveries(500);
    
    const processingTime = Date.now() - startTime;
    
    expect(deliveries).toHaveLength(500);
    expect(processingTime).toBeLessThan(2000); // Should complete within 2 seconds
    
    console.log(`Created 500 deliveries in ${processingTime}ms`);
  });

  it('should create 100 webhook configs quickly', async () => {
    const startTime = Date.now();
    
    const webhooks = WebhookFactory.createBatchWebhooks(100);
    
    const processingTime = Date.now() - startTime;
    
    expect(webhooks).toHaveLength(100);
    expect(processingTime).toBeLessThan(500); // Should complete within 0.5 seconds
    
    console.log(`Created 100 webhook configs in ${processingTime}ms`);
  });

  it('should process data transformations efficiently', async () => {
    const events = EventFactory.createBatchEvents(200);
    const startTime = Date.now();
    
    // Simulate some data processing
    const processed = events.map(event => ({
      id: event.transactionHash,
      type: event.eventName,
      block: event.blockNumber,
      data: JSON.stringify(event.args)
    }));
    
    const processingTime = Date.now() - startTime;
    
    expect(processed).toHaveLength(200);
    expect(processingTime).toBeLessThan(100); // Should complete within 100ms
    
    console.log(`Processed 200 events in ${processingTime}ms`);
    console.log(`Average: ${processingTime / 200}ms per event`);
  });
});