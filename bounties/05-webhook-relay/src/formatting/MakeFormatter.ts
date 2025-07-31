// Make.com-specific template formatter
import { TemplateFormatter } from './TemplateFormatter';
import type { BlockchainEvent } from '../types/events';
import type { MakePayload } from './interfaces';

export class MakeFormatter extends TemplateFormatter {
  constructor() {
    super('make');
  }

  formatPayload(event: BlockchainEvent): MakePayload {
    // Make.com expects a nested structure with metadata and data sections
    return {
      metadata: {
        eventName: event.eventName,
        contractAddress: event.contractAddress,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
        timestamp: this.formatTimestamp(event.timestamp)
      },
      data: {
        ...event.args
      }
    };
  }
}