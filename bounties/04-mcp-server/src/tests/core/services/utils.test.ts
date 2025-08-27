import { describe, test, expect, mock, afterEach } from 'bun:test';

describe('Utils Module', () => {
  afterEach(() => {
    mock.restore();
  });

  test('parseEther delegates to viem.parseEther when mocked', async () => {
    mock.module('viem', () => ({
      parseEther: (value: string | number): bigint => 123n
    }));

    const { utils } = await import('../../../core/services/utils.js');
    expect(utils.parseEther('1')).toBe(123n);
  });

  test('mocks are restored between tests (viem.parseEther real behavior)', async () => {
    const { parseEther } = await import('viem');
    expect(parseEther('1')).toBe(1000000000000000000n);
  });

  test('formatJson should format an object to JSON with bigint handling', async () => {
    const { utils } = await import('../../../core/services/utils.js');

    const obj = {
      amount: 1000000000000000000n,
      name: 'test',
      nested: {
        value: 123456789n
      }
    };

    const result = utils.formatJson(obj);
    const parsed = JSON.parse(result);

    expect(parsed.amount).toBe('1000000000000000000');
    expect(parsed.name).toBe('test');
    expect(parsed.nested.value).toBe('123456789');
    expect(result).toContain('  "amount": "1000000000000000000"');
  });

  test('formatJson should handle objects without bigints', async () => {
    const { utils } = await import('../../../core/services/utils.js');

    const obj = {
      name: 'test',
      value: 123,
      nested: {
        flag: true
      }
    };

    const result = utils.formatJson(obj);
    const parsed = JSON.parse(result);

    expect(parsed.name).toBe('test');
    expect(parsed.value).toBe(123);
    expect(parsed.nested.flag).toBe(true);
  });

  test('validateAddress should throw for invalid addresses and return valid ones', async () => {
    const { utils } = await import('../../../core/services/utils.js');

    const validAddress = '0x1234567890123456789012345678901234567890';
    expect(utils.validateAddress(validAddress)).toBe(validAddress);

    const mixedCaseAddress = '0xAbCdEf1234567890123456789012345678901234';
    expect(utils.validateAddress(mixedCaseAddress)).toBe(mixedCaseAddress);

    const shortAddress = '0x123456';
    expect(() => utils.validateAddress(shortAddress)).toThrow('Invalid address');

    const noPrefixAddress = '1234567890123456789012345678901234567890';
    expect(() => utils.validateAddress(noPrefixAddress)).toThrow('Invalid address');

    const invalidCharsAddress = '0x123456789012345678901234567890123456789G';
    expect(() => utils.validateAddress(invalidCharsAddress)).toThrow('Invalid address');

    expect(() => utils.validateAddress('')).toThrow('Invalid address');
  });
});
