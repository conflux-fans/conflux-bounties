// Template formatting module exports
export { TemplateFormatter } from './TemplateFormatter';
export { ZapierFormatter } from './ZapierFormatter';
export { MakeFormatter } from './MakeFormatter';
export { N8nFormatter } from './N8nFormatter';
export { GenericFormatter } from './GenericFormatter';

export type {
  ITemplateFormatter,
  PlatformSpecificPayload,
  ZapierPayload,
  MakePayload,
  N8nPayload,
  GenericPayload
} from './interfaces';

import { ZapierFormatter } from './ZapierFormatter';
import { MakeFormatter } from './MakeFormatter';
import { N8nFormatter } from './N8nFormatter';
import { GenericFormatter } from './GenericFormatter';
import type { WebhookFormat } from '../types/common';
import type { ITemplateFormatter } from './interfaces';

/**
 * Factory function to create appropriate formatter based on format type
 */
export function createFormatter(format: WebhookFormat): ITemplateFormatter {
  switch (format) {
    case 'zapier':
      return new ZapierFormatter();
    case 'make':
      return new MakeFormatter();
    case 'n8n':
      return new N8nFormatter();
    case 'generic':
      return new GenericFormatter();
    default:
      throw new Error(`Unsupported webhook format: ${format}`);
  }
}

/**
 * Get list of supported webhook formats
 */
export function getSupportedFormats(): WebhookFormat[] {
  return ['zapier', 'make', 'n8n', 'generic'];
}