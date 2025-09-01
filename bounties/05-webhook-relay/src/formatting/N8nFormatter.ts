// n8n-specific template formatter
import { TemplateFormatter } from './TemplateFormatter';
import type { BlockchainEvent } from '../types/events';
import type { N8nPayload } from './interfaces';

export class N8nFormatter extends TemplateFormatter {
  constructor() {
    super('n8n');
  }

  formatPayload(event: BlockchainEvent): N8nPayload {
    // n8n expects camelCase with nested event structure
    return {
      eventData: {
        name: event.eventName,
        contractAddress: event.contractAddress,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
        timestamp: this.formatTimestamp(event.timestamp),
        parameters: {
          ...event.args
        }
      }
    };
  }
}