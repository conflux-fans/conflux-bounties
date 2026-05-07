import { describe, it, expect } from '@jest/globals';
import { generateSlug, chunkRange, toCsv, weiToEther, toDateString } from '@conflux-analytics/shared';

/**
 * Shared utility function tests.
 */
describe('generateSlug', () => {
  it('should return an 8-character string', () => {
    const slug = generateSlug();
    expect(slug.length).toBe(8);
  });

  it('should generate unique slugs', () => {
    const a = generateSlug();
    const b = generateSlug();
    expect(a).not.toBe(b);
  });
});

describe('chunkRange', () => {
  it('should split range into chunks', () => {
    const chunks = chunkRange(1, 25, 10);
    expect(chunks).toEqual([
      [1, 10],
      [11, 20],
      [21, 25],
    ]);
  });

  it('should handle single-element range', () => {
    const chunks = chunkRange(5, 5, 10);
    expect(chunks).toEqual([[5, 5]]);
  });

  it('should handle range smaller than chunk size', () => {
    const chunks = chunkRange(1, 3, 10);
    expect(chunks).toEqual([[1, 3]]);
  });
});

describe('toCsv', () => {
  it('should convert rows to CSV string', () => {
    const rows = [
      { date: '2025-01-01', count: 100 },
      { date: '2025-01-02', count: 200 },
    ];
    const csv = toCsv(rows);
    expect(csv).toContain('date,count');
    expect(csv).toContain('2025-01-01,100');
  });

  it('should return empty string for empty array', () => {
    expect(toCsv([])).toBe('');
  });

  it('should quote values containing commas', () => {
    const rows = [{ name: 'hello, world', val: 1 }];
    const csv = toCsv(rows);
    expect(csv).toContain('"hello, world"');
  });
});

describe('weiToEther', () => {
  it('should convert 1 ether', () => {
    expect(weiToEther(10n ** 18n)).toBe('1');
  });

  it('should convert 0.5 ether', () => {
    expect(weiToEther(5n * 10n ** 17n)).toBe('0.5');
  });

  it('should convert 0 wei', () => {
    expect(weiToEther(0n)).toBe('0');
  });
});

describe('toDateString', () => {
  it('should format Date to YYYY-MM-DD', () => {
    const result = toDateString(new Date('2025-06-15T12:00:00Z'));
    expect(result).toBe('2025-06-15');
  });

  it('should accept ISO string', () => {
    const result = toDateString('2025-01-01T00:00:00Z');
    expect(result).toBe('2025-01-01');
  });
});
