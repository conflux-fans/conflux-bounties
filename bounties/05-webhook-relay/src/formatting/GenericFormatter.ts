// Generic template formatter for standard JSON format
import { TemplateFormatter } from './TemplateFormatter';
import type { BlockchainEvent } from '../types/events';
import type { GenericPayload } from './interfaces';

export class GenericFormatter extends TemplateFormatter {
  constructor() {
    super('generic');
  }

  formatPayload(event: BlockchainEvent): GenericPayload {
    // Generic format maintains the original structure with minimal transformation
    return {
      contractAddress: event.contractAddress,
      eventName: event.eventName,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      logIndex: event.logIndex,
      args: {
        ...event.args
      },
      timestamp: this.formatTimestamp(event.timestamp)
    };
  }
}