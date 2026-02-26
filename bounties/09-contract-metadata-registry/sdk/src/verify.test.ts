import { describe, it, expect } from 'vitest';
import { stableStringify, computeChecksum } from './verify';

describe('stableStringify', () => {
  it('serializes primitives like JSON.stringify', () => {
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(true)).toBe('true');
    expect(stableStringify(42)).toBe('42');
    expect(stableStringify('foo')).toBe('"foo"');
  });

  it('serializes arrays preserving order', () => {
    expect(stableStringify([1, 2, 3])).toBe('[1,2,3]');
    expect(stableStringify(['a', 'b'])).toBe('["a","b"]');
  });

  it('serializes objects with sorted keys', () => {
    const a = { b: 2, a: 1 };
    const b = { a: 1, b: 2 };

    const sa = stableStringify(a);
    const sb = stableStringify(b);

    expect(sa).toBe(sb);
    expect(sa).toBe('{"a":1,"b":2}');
  });

  it('handles nested objects and arrays deterministically', () => {
    const v1 = { z: [3, 2, 1], a: { y: 'y', x: 'x' } };
    const v2 = { a: { x: 'x', y: 'y' }, z: [3, 2, 1] };

    const s1 = stableStringify(v1);
    const s2 = stableStringify(v2);

    expect(s1).toBe(s2);
    expect(s1).toBe('{"a":{"x":"x","y":"y"},"z":[3,2,1]}');
  });
});

describe('computeChecksum', () => {
  it('returns a 0x-prefixed hex string', () => {
    const checksum = computeChecksum({ foo: 'bar' });
    expect(checksum.startsWith('0x')).toBe(true);
    expect(checksum.length).toBe(66); // 0x + 64 hex chars
  });

  it('is deterministic for same logical metadata', () => {
    const m1 = { name: 'Token', description: 'My token', tags: ['defi', 'lending'] };
    const m2 = { tags: ['defi', 'lending'], description: 'My token', name: 'Token' };

    const c1 = computeChecksum(m1);
    const c2 = computeChecksum(m2);

    expect(c1).toBe(c2);
  });

  it('changes when metadata changes', () => {
    const m1 = { name: 'Token', description: 'My token' };
    const m2 = { name: 'Token', description: 'Different' };

    const c1 = computeChecksum(m1);
    const c2 = computeChecksum(m2);

    expect(c1).not.toBe(c2);
  });
});

