// Zapier-specific template formatter
import { TemplateFormatter } from './TemplateFormatter';
import type { BlockchainEvent } from '../types/events';
import type { ZapierPayload } from './interfaces';

export class ZapierFormatter extends TemplateFormatter {
  constructor() {
    super('zapier');
  }

  formatPayload(event: BlockchainEvent): ZapierPayload {
    // Zapier expects a flat structure with snake_case field names
    const basePayload = {
      event_name: event.eventName,
      contract_address: event.contractAddress,
      block_number: event.blockNumber,
      transaction_hash: event.transactionHash,
      log_index: event.logIndex,
      timestamp: this.formatTimestamp(event.timestamp)
    };

    // Flatten and sanitize event arguments
    const flattenedArgs = this.flattenObject(event.args);
    const sanitizedArgs: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(flattenedArgs)) {
      const sanitizedKey = this.sanitizeFieldName(key, 'zapier');
      sanitizedArgs[`arg_${sanitizedKey}`] = value;
    }

    return {
      ...basePayload,
      ...sanitizedArgs
    };
  }
}