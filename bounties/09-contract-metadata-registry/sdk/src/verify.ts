import { keccak_256 } from 'js-sha3';

export function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  const props = keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k]));
  return '{' + props.join(',') + '}';
}

export function computeChecksum(metadata: any): `0x${string}` {
  const canonical = stableStringify(metadata);
  const hash = keccak_256(canonical);
  return `0x${hash}` as `0x${string}`;
}

