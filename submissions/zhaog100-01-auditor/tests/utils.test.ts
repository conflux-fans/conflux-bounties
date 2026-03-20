import { isValidEVMAddress, normalizeAddress, isCuid, isUUID } from '@/lib/utils';

describe('isValidEVMAddress', () => {
  it('accepts valid addresses', () => {
    expect(isValidEVMAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
    expect(isValidEVMAddress('0xABCD567890ABCDEF1234567890ABCDEF12345678')).toBe(true);
  });

  it('rejects invalid addresses', () => {
    expect(isValidEVMAddress('')).toBe(false);
    expect(isValidEVMAddress('0x123')).toBe(false);
    expect(isValidEVMAddress('1234567890abcdef1234567890abcdef12345678')).toBe(false);
    expect(isValidEVMAddress('0x1234567890abcdef1234567890abcdef1234567g')).toBe(false);
  });
});

describe('normalizeAddress', () => {
  it('lowercases EVM addresses', () => {
    expect(normalizeAddress('0xABCD567890ABCDEF1234567890ABCDEF12345678')).toBe(
      '0xabcd567890abcdef1234567890abcdef12345678',
    );
  });

  it('handles cfx: addresses', () => {
    expect(normalizeAddress('cfx:aabcdef1234567890abcdef1234567890abcdef12345678')).toBe(
      '0xaabcdef1234567890abcdef1234567890abcdef12345678',
    );
  });
});

describe('isCuid', () => {
  it('accepts valid cuids', () => {
    expect(isCuid('cjld2cjxh0000qzrmn831i7rn')).toBe(true);
    expect(isCuid('abc123def4567890123456789')).toBe(true);
  });

  it('rejects invalid cuids', () => {
    expect(isCuid('')).toBe(false);
    expect(isCuid('short')).toBe(false);
    expect(isCuid('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });
});

describe('isUUID', () => {
  it('accepts valid UUIDs', () => {
    expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('rejects invalid UUIDs', () => {
    expect(isUUID('')).toBe(false);
    expect(isUUID('not-a-uuid')).toBe(false);
  });
});
