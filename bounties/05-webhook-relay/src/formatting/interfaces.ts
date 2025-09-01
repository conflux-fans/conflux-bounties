// Template formatting interfaces
import type { BlockchainEvent } from '../types/events';
import type { FormattedPayload } from '../types/webhooks';
import type { WebhookFormat } from '../types/common';

export interface ITemplateFormatter {
  formatPayload(event: BlockchainEvent): FormattedPayload;
  validateFormat(): boolean;
  getFormat(): WebhookFormat;
}

export interface PlatformSpecificPayload extends FormattedPayload {
  // Base interface for platform-specific payload structures
}

export interface ZapierPayload extends PlatformSpecificPayload {
  // Zapier expects flat structure with prefixed fields
  event_name: string;
  contract_address: string;
  block_number: number;
  transaction_hash: string;
  timestamp: string;
  [key: string]: any; // Dynamic event args
}

export interface MakePayload extends PlatformSpecificPayload {
  // Make.com expects nested structure with metadata
  metadata: {
    eventName: string;
    contractAddress: string;
    blockNumber: number;
    transactionHash: string;
    logIndex: number;
    timestamp: string;
  };
  data: Record<string, any>;
}

export interface N8nPayload extends PlatformSpecificPayload {
  // n8n expects camelCase with nested event structure
  eventData: {
    name: string;
    contractAddress: string;
    blockNumber: number;
    transactionHash: string;
    logIndex: number;
    timestamp: string;
    parameters: Record<string, any>;
  };
}

export interface GenericPayload extends PlatformSpecificPayload {
  // Generic format maintains original structure
  contractAddress: string;
  eventName: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  args: Record<string, any>;
  timestamp: string;
}