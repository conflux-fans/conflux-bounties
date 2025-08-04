// Event-related type definitions
import type { WebhookConfig } from './common';

export interface BlockchainEvent {
  contractAddress: string;
  eventName: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  args: Record<string, any>;
  timestamp: Date;
}

export interface EventSubscription {
  id: string;
  contractAddress: string | string[]; // Support both single address and array of addresses
  eventSignature: string | string[];  // Support both single signature and array of signatures
  filters: Record<string, any>;
  webhooks: WebhookConfig[];
}

export interface EventFilters {
  [paramName: string]: string | number | string[] | FilterExpression;
}

export interface FilterExpression {
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'in' | 'contains';
  value: any;
}