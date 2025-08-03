import { WebhookDelivery } from '../../src/types/delivery';
import { v4 as uuidv4 } from 'uuid';
import { EventFactory } from './EventFactory';

export class DeliveryFactory {
  static createWebhookDelivery(overrides: Partial<WebhookDelivery> = {}): WebhookDelivery {
    return {
      id: uuidv4(),
      subscriptionId: uuidv4(),
      webhookId: uuidv4(),
      event: EventFactory.createBlockchainEvent(),
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
      status: 'pending',
      ...overrides
    };
  }

  static createPendingDelivery(overrides: Partial<WebhookDelivery> = {}): WebhookDelivery {
    return this.createWebhookDelivery({
      status: 'pending',
      attempts: 0,
      ...overrides
    });
  }

  static createProcessingDelivery(): WebhookDelivery {
    return this.createWebhookDelivery({
      status: 'processing',
      attempts: 1
    });
  }

  static createCompletedDelivery(): WebhookDelivery {
    return this.createWebhookDelivery({
      status: 'completed',
      attempts: 1
    });
  }

  static createFailedDelivery(): WebhookDelivery {
    return this.createWebhookDelivery({
      status: 'failed',
      attempts: 3,
      maxAttempts: 3
    });
  }

  static createRetryDelivery(retryAt: Date): WebhookDelivery {
    return this.createWebhookDelivery({
      status: 'pending',
      attempts: 1,
      nextRetry: retryAt
    });
  }

  static createBatchDeliveries(count: number, baseDelivery?: Partial<WebhookDelivery>): WebhookDelivery[] {
    return Array.from({ length: count }, () => 
      this.createWebhookDelivery({
        ...baseDelivery,
        id: uuidv4()
      })
    );
  }

  static createHighVolumeDeliveries(count: number): WebhookDelivery[] {
    return Array.from({ length: count }, (_, index) => {
      const event = EventFactory.createBlockchainEvent({
        blockNumber: 12345 + index,
        logIndex: index % 10,
        transactionHash: `0x${index.toString(16).padStart(64, '0')}`
      });

      return this.createWebhookDelivery({
        id: uuidv4(),
        event,
        payload: {
          event: event.eventName,
          data: event.args,
          timestamp: event.timestamp.toISOString(),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash
        }
      });
    });
  }

  static createFormattedPayload(format: 'zapier' | 'make' | 'n8n' | 'generic', eventData: any): any {
    switch (format) {
      case 'zapier':
        return {
          event_name: eventData.eventName,
          contract_address: eventData.contractAddress,
          block_number: eventData.blockNumber,
          transaction_hash: eventData.transactionHash,
          ...eventData.args
        };
      case 'make':
        return {
          eventName: eventData.eventName,
          contractAddress: eventData.contractAddress,
          blockNumber: eventData.blockNumber,
          transactionHash: eventData.transactionHash,
          eventData: eventData.args
        };
      case 'n8n':
        return {
          event: {
            name: eventData.eventName,
            contract: eventData.contractAddress,
            block: eventData.blockNumber,
            transaction: eventData.transactionHash,
            parameters: eventData.args
          }
        };
      case 'generic':
      default:
        return {
          event: eventData.eventName,
          contractAddress: eventData.contractAddress,
          blockNumber: eventData.blockNumber,
          transactionHash: eventData.transactionHash,
          data: eventData.args,
          timestamp: eventData.timestamp
        };
    }
  }
}