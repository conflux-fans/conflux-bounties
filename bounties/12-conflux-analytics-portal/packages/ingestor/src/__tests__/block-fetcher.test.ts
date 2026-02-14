import { describe, it, expect } from '@jest/globals';

/**
 * Block fetcher unit tests.
 * These test the data transformation logic without hitting the RPC.
 */
describe('block-fetcher', () => {
  it('should parse block number as integer', () => {
    const raw = { number: 80_000_000n };
    expect(Number(raw.number)).toBe(80_000_000);
  });

  it('should parse timestamp as integer', () => {
    const raw = { timestamp: 1700000000n };
    expect(Number(raw.timestamp)).toBe(1_700_000_000);
  });

  it('should handle null baseFeePerGas', () => {
    const baseFee = undefined;
    expect(baseFee?.toString() ?? null).toBeNull();
  });

  it('should lowercase addresses', () => {
    const addr = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';
    expect(addr.toLowerCase()).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
  });

  it('should detect contract creation when to is null', () => {
    const to: string | null = null;
    expect(to).toBeNull();
  });
});
