// Delivery queue and webhook delivery types
import type { BlockchainEvent } from './events';
import type { DeliveryStatus } from './common';

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  webhookId: string;
  event: BlockchainEvent;
  payload: any;
  attempts: number;
  maxAttempts: number;
  nextRetry?: Date;
  status: DeliveryStatus;
}