// Base template formatter class
import type { BlockchainEvent } from '../types/events';
import type { FormattedPayload } from '../types/webhooks';
import type { WebhookFormat } from '../types/common';
import type { ITemplateFormatter } from './interfaces';

export abstract class TemplateFormatter implements ITemplateFormatter {
  protected readonly format: WebhookFormat;

  constructor(format: WebhookFormat) {
    this.format = format;
  }

  abstract formatPayload(event: BlockchainEvent): FormattedPayload;

  validateFormat(): boolean {
    const validFormats: WebhookFormat[] = ['zapier', 'make', 'n8n', 'generic'];
    return validFormats.includes(this.format);
  }

  getFormat(): WebhookFormat {
    return this.format;
  }

  /**
   * Utility method to safely convert Date to ISO string
   */
  protected formatTimestamp(timestamp: Date): string {
    return timestamp.toISOString();
  }

  /**
   * Utility method to sanitize field names for specific platforms
   */
  protected sanitizeFieldName(fieldName: string, format: WebhookFormat): string {
    switch (format) {
      case 'zapier':
        // Zapier prefers snake_case
        return fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
      case 'make':
      case 'n8n':
      case 'generic':
      default:
        // Keep camelCase for other platforms
        return fieldName;
    }
  }

  /**
   * Utility method to flatten nested objects for platforms that prefer flat structures
   */
  protected flattenObject(obj: Record<string, any>, prefix: string = ''): Record<string, any> {
    const flattened: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}_${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    }
    
    return flattened;
  }
}