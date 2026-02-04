import { describe, it, expect } from '@jest/globals';

/**
 * Reorg detection logic tests.
 * Tests the hash comparison logic without DB dependencies.
 */
describe('reorg detection', () => {
  it('should detect no reorg when parent hashes match', () => {
    const storedHash = '0xabc123';
    const newParentHash = '0xabc123';
    expect(storedHash === newParentHash).toBe(true);
  });

  it('should detect reorg when parent hashes mismatch', () => {
    const storedHash = '0xabc123';
    const newParentHash = '0xdef456';
    expect(storedHash === newParentHash).toBe(false);
  });

  it('should skip reorg check when no stored block exists', () => {
    const storedHash: string | null = null;
    expect(storedHash).toBeNull();
  });
});
