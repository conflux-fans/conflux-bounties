// Unit tests for base TemplateFormatter class
import { TemplateFormatter } from '../TemplateFormatter';
import type { BlockchainEvent } from '../../types/events';
import type { FormattedPayload } from '../../types/webhooks';
import type { WebhookFormat } from '../../types/common';

// Concrete implementation for testing abstract class
class TestFormatter extends TemplateFormatter {
  constructor(format: WebhookFormat) {
    super(format);
  }

  formatPayload(event: BlockchainEvent): FormattedPayload {
    return {
      test: 'payload',
      timestamp: this.formatTimestamp(event.timestamp)
    };
  }
}

describe('TemplateFormatter', () => {
  let formatter: TestFormatter;
  let mockEvent: BlockchainEvent;

  beforeEach(() => {
    formatter = new TestFormatter('generic');
    mockEvent = {
      contractAddress: '0x1234567890123456789012345678901234567890',
      eventName: 'Transfer',
      blockNumber: 12345,
      transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      logIndex: 0,
      args: {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '1000000000000000000'
      },
      timestamp: new Date('2023-01-01T12:00:00.000Z')
    };
  });

  describe('constructor', () => {
    it('should set the format correctly', () => {
      expect(formatter.getFormat()).toBe('generic');
    });
  });

  describe('validateFormat', () => {
    it('should return true for valid formats', () => {
      const validFormats: WebhookFormat[] = ['zapier', 'make', 'n8n', 'generic'];
      
      validFormats.forEach(format => {
        const testFormatter = new TestFormatter(format);
        expect(testFormatter.validateFormat()).toBe(true);
      });
    });

    it('should return false for invalid formats', () => {
      const invalidFormatter = new TestFormatter('invalid' as WebhookFormat);
      expect(invalidFormatter.validateFormat()).toBe(false);
    });
  });

  describe('getFormat', () => {
    it('should return the correct format', () => {
      expect(formatter.getFormat()).toBe('generic');
    });
  });

  describe('formatTimestamp', () => {
    it('should format timestamp as ISO string', () => {
      const result = formatter.formatPayload(mockEvent);
      expect(result['timestamp']).toBe('2023-01-01T12:00:00.000Z');
    });
  });

  describe('sanitizeFieldName', () => {
    it('should convert camelCase to snake_case for zapier format', () => {
      const result = (formatter as any).sanitizeFieldName('camelCaseField', 'zapier');
      expect(result).toBe('camel_case_field');
    });

    it('should keep camelCase for other formats', () => {
      const formats: WebhookFormat[] = ['make', 'n8n', 'generic'];
      
      formats.forEach(format => {
        const result = (formatter as any).sanitizeFieldName('camelCaseField', format);
        expect(result).toBe('camelCaseField');
      });
    });
  });

  describe('flattenObject', () => {
    it('should flatten nested objects', () => {
      const nested = {
        level1: {
          level2: {
            value: 'test'
          },
          simple: 'value'
        },
        top: 'level'
      };

      const result = (formatter as any).flattenObject(nested);
      expect(result).toEqual({
        'level1_level2_value': 'test',
        'level1_simple': 'value',
        'top': 'level'
      });
    });

    it('should handle arrays without flattening them', () => {
      const withArray = {
        items: [1, 2, 3],
        nested: {
          array: ['a', 'b']
        }
      };

      const result = (formatter as any).flattenObject(withArray);
      expect(result).toEqual({
        'items': [1, 2, 3],
        'nested_array': ['a', 'b']
      });
    });

    it('should handle Date objects without flattening them', () => {
      const withDate = {
        timestamp: new Date('2023-01-01'),
        nested: {
          date: new Date('2023-01-02')
        }
      };

      const result = (formatter as any).flattenObject(withDate);
      expect(result).toEqual({
        'timestamp': new Date('2023-01-01'),
        'nested_date': new Date('2023-01-02')
      });
    });

    it('should use prefix when provided', () => {
      const obj = { key: 'value' };
      const result = (formatter as any).flattenObject(obj, 'prefix');
      expect(result).toEqual({ 'prefix_key': 'value' });
    });
  });
});