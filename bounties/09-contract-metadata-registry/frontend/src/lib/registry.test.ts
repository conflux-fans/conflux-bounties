import { describe, it, expect } from 'vitest';
import { MetadataStatus, REGISTRY_ABI, REGISTRY_ADDRESS } from './registry';

describe('registry', () => {
  it('MetadataStatus has expected values', () => {
    expect(MetadataStatus.None).toBe(0);
    expect(MetadataStatus.Pending).toBe(1);
    expect(MetadataStatus.Approved).toBe(2);
    expect(MetadataStatus.Rejected).toBe(3);
  });

  it('REGISTRY_ADDRESS is a valid hex address', () => {
    expect(REGISTRY_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it('REGISTRY_ABI contains expected function names', () => {
    const names = REGISTRY_ABI.filter((a) => typeof (a as { name?: string }).name === 'string').map(
      (a) => (a as { name: string }).name
    );
    expect(names).toContain('submitMetadata');
    expect(names).toContain('approve');
    expect(names).toContain('reject');
    expect(names).toContain('transferOwnership');
    expect(names).toContain('setResolver');
    expect(names).toContain('getRecord');
  });
});
