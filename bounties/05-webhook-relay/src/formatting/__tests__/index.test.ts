// Unit tests for formatting module index and factory functions
import { 
  createFormatter, 
  getSupportedFormats,
  ZapierFormatter,
  MakeFormatter,
  N8nFormatter,
  GenericFormatter
} from '../index';
import type { WebhookFormat } from '../../types/common';

describe('Formatting Module', () => {
  describe('createFormatter', () => {
    it('should create ZapierFormatter for zapier format', () => {
      const formatter = createFormatter('zapier');
      expect(formatter).toBeInstanceOf(ZapierFormatter);
      expect(formatter.getFormat()).toBe('zapier');
    });

    it('should create MakeFormatter for make format', () => {
      const formatter = createFormatter('make');
      expect(formatter).toBeInstanceOf(MakeFormatter);
      expect(formatter.getFormat()).toBe('make');
    });

    it('should create N8nFormatter for n8n format', () => {
      const formatter = createFormatter('n8n');
      expect(formatter).toBeInstanceOf(N8nFormatter);
      expect(formatter.getFormat()).toBe('n8n');
    });

    it('should create GenericFormatter for generic format', () => {
      const formatter = createFormatter('generic');
      expect(formatter).toBeInstanceOf(GenericFormatter);
      expect(formatter.getFormat()).toBe('generic');
    });

    it('should throw error for unsupported format', () => {
      expect(() => {
        createFormatter('unsupported' as WebhookFormat);
      }).toThrow('Unsupported webhook format: unsupported');
    });

    it('should create different instances for each call', () => {
      const formatter1 = createFormatter('zapier');
      const formatter2 = createFormatter('zapier');
      
      expect(formatter1).not.toBe(formatter2);
      expect(formatter1).toBeInstanceOf(ZapierFormatter);
      expect(formatter2).toBeInstanceOf(ZapierFormatter);
    });
  });

  describe('getSupportedFormats', () => {
    it('should return all supported formats', () => {
      const formats = getSupportedFormats();
      
      expect(formats).toEqual(['zapier', 'make', 'n8n', 'generic']);
      expect(formats).toHaveLength(4);
    });

    it('should return a new array each time', () => {
      const formats1 = getSupportedFormats();
      const formats2 = getSupportedFormats();
      
      expect(formats1).not.toBe(formats2);
      expect(formats1).toEqual(formats2);
    });

    it('should contain only valid WebhookFormat values', () => {
      const formats = getSupportedFormats();
      const validFormats: WebhookFormat[] = ['zapier', 'make', 'n8n', 'generic'];
      
      formats.forEach(format => {
        expect(validFormats).toContain(format);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should create formatters that validate correctly', () => {
      const formats = getSupportedFormats();
      
      formats.forEach(format => {
        const formatter = createFormatter(format);
        expect(formatter.validateFormat()).toBe(true);
      });
    });

    it('should create formatters with correct format property', () => {
      const formats = getSupportedFormats();
      
      formats.forEach(format => {
        const formatter = createFormatter(format);
        expect(formatter.getFormat()).toBe(format);
      });
    });
  });
});