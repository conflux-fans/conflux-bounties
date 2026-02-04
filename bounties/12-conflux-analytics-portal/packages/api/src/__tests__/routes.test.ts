import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
import {
  DatePaginationQuery,
  ContractsQuery,
  ExportQuery,
  CreateShareBody,
  CreateWebhookBody,
  Address,
} from '@conflux-analytics/shared';

/**
 * Zod schema validation tests for API query params and request bodies.
 */
describe('API query validation', () => {
  it('should parse valid DatePaginationQuery', () => {
    const result = DatePaginationQuery.parse({
      from: '2025-01-01',
      to: '2025-01-31',
      limit: '20',
      offset: '0',
    });
    expect(result.from).toBe('2025-01-01');
    expect(result.limit).toBe(20);
  });

  it('should use defaults when params are missing', () => {
    const result = DatePaginationQuery.parse({});
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
    expect(result.from).toBeUndefined();
  });

  it('should reject invalid date format', () => {
    expect(() => DatePaginationQuery.parse({ from: 'not-a-date' })).toThrow();
  });

  it('should reject limit above max', () => {
    expect(() => DatePaginationQuery.parse({ limit: '9999' })).toThrow();
  });

  it('should parse ContractsQuery with sort and order', () => {
    const result = ContractsQuery.parse({ sort: 'gas_used', order: 'asc' });
    expect(result.sort).toBe('gas_used');
    expect(result.order).toBe('asc');
  });

  it('should parse ExportQuery with format', () => {
    const result = ExportQuery.parse({ format: 'csv' });
    expect(result.format).toBe('csv');
  });

  it('should default ExportQuery format to json', () => {
    const result = ExportQuery.parse({});
    expect(result.format).toBe('json');
  });
});

describe('API body validation', () => {
  it('should parse valid CreateShareBody', () => {
    const result = CreateShareBody.parse({
      config: { page: 'overview' },
      expiresInDays: 30,
    });
    expect(result.config).toEqual({ page: 'overview' });
    expect(result.expiresInDays).toBe(30);
  });

  it('should reject CreateShareBody without config', () => {
    expect(() => CreateShareBody.parse({})).toThrow();
  });

  it('should parse valid CreateWebhookBody', () => {
    const result = CreateWebhookBody.parse({
      url: 'https://example.com/hook',
      eventType: 'daily_digest',
    });
    expect(result.url).toBe('https://example.com/hook');
  });

  it('should reject invalid webhook URL', () => {
    expect(() => CreateWebhookBody.parse({ url: 'not-url', eventType: 'daily_digest' })).toThrow();
  });

  it('should reject invalid event type', () => {
    expect(() => CreateWebhookBody.parse({ url: 'https://x.com', eventType: 'invalid' })).toThrow();
  });
});

describe('Address validation', () => {
  it('should accept valid address', () => {
    expect(() => Address.parse('0x1234567890abcdef1234567890abcdef12345678')).not.toThrow();
  });

  it('should reject short address', () => {
    expect(() => Address.parse('0x1234')).toThrow();
  });

  it('should reject non-hex address', () => {
    expect(() => Address.parse('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toThrow();
  });
});
