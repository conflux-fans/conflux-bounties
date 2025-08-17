import { parseEther, formatEther, getAddress, shortenAddress } from './native-utils';

describe('Native Utils', () => {
  describe('parseEther', () => {
    it('should parse whole numbers correctly', () => {
      expect(parseEther('1')).toBe(BigInt('1000000000000000000'));
      expect(parseEther('10')).toBe(BigInt('10000000000000000000'));
      expect(parseEther('0')).toBe(BigInt('0'));
    });

    it('should parse decimal numbers correctly', () => {
      expect(parseEther('1.5')).toBe(BigInt('1500000000000000000'));
      expect(parseEther('0.1')).toBe(BigInt('100000000000000000'));
      expect(parseEther('0.001')).toBe(BigInt('1000000000000000'));
      expect(parseEther('1.123456789')).toBe(BigInt('1123456789000000000'));
    });

    it('should handle edge cases', () => {
      expect(parseEther('')).toBe(BigInt('0'));
      expect(parseEther('0.0')).toBe(BigInt('0'));
      expect(parseEther('0.000000000000000001')).toBe(BigInt('1'));
    });

    it('should handle large numbers', () => {
      expect(parseEther('1000000')).toBe(BigInt('1000000000000000000000000'));
    });
  });

  describe('formatEther', () => {
    it('should format whole numbers correctly', () => {
      expect(formatEther(BigInt('1000000000000000000'))).toBe('1');
      expect(formatEther(BigInt('10000000000000000000'))).toBe('10');
      expect(formatEther(BigInt('0'))).toBe('0');
    });

    it('should format decimal numbers correctly', () => {
      expect(formatEther(BigInt('1500000000000000000'))).toBe('1.5');
      expect(formatEther(BigInt('100000000000000000'))).toBe('0.1');
      expect(formatEther(BigInt('1000000000000000'))).toBe('0.001');
      expect(formatEther(BigInt('1123456789000000000'))).toBe('1.123456789');
    });

    it('should handle edge cases', () => {
      expect(formatEther(BigInt('0'))).toBe('0');
      expect(formatEther(BigInt('1'))).toBe('0.000000000000000001');
    });

    it('should handle large numbers', () => {
      expect(formatEther(BigInt('1000000000000000000000000'))).toBe('1000000');
    });

    it('should trim trailing zeros', () => {
      expect(formatEther(BigInt('1500000000000000000'))).toBe('1.5');
      expect(formatEther(BigInt('100000000000000000'))).toBe('0.1');
    });
  });

  describe('getAddress', () => {
    it('should return valid addresses in lowercase', () => {
      expect(getAddress('0x1234567890123456789012345678901234567890')).toBe('0x1234567890123456789012345678901234567890');
      expect(getAddress('0xABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD')).toBe('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
    });

    it('should handle edge cases', () => {
      expect(getAddress('0x0000000000000000000000000000000000000000')).toBe('0x0000000000000000000000000000000000000000');
    });

    it('should handle empty string gracefully', () => {
      expect(getAddress('')).toBe('');
    });

    it('should handle edge case for getAddress with very long string', () => {
      const longString = '0x' + '1'.repeat(100);
      expect(() => getAddress(longString)).toThrow();
    });

    it('should handle edge case for getAddress with special characters', () => {
      const specialChars = '0x123456789012345678901234567890123456789@';
      expect(() => getAddress(specialChars)).toThrow('Invalid address');
    });
  });

  describe('shortenAddress', () => {
    it('should shorten addresses with default chars', () => {
      const address = '0x1234567890123456789012345678901234567890';
      expect(shortenAddress(address)).toBe('0x1234...7890');
    });

    it('should shorten addresses with custom chars', () => {
      const address = '0x1234567890123456789012345678901234567890';
      expect(shortenAddress(address, 2)).toBe('0x12...90');
      expect(shortenAddress(address, 6)).toBe('0x123456...567890');
    });

    it('should handle edge cases', () => {
      expect(shortenAddress('')).toBe('');
      expect(shortenAddress('0x1234567890123456789012345678901234567890', 0)).toBe('0x...0x1234567890123456789012345678901234567890');
    });

    it('should handle short addresses', () => {
      const shortAddress = '0x1234567890123456789012345678901234567890';
      expect(shortenAddress(shortAddress, 20)).toBe('0x12345678901234567890...12345678901234567890');
    });
  });

  describe('Integration tests', () => {
    it('should round-trip parseEther and formatEther', () => {
      const testValues = ['0', '1', '0.1', '1.5', '100.123', '0.000001'];
      
      testValues.forEach(value => {
        const wei = parseEther(value);
        const backToEther = formatEther(wei);
        expect(backToEther).toBe(value);
      });
    });

    it('should handle very small amounts', () => {
      const wei = parseEther('0.000000000000000001');
      expect(wei).toBe(BigInt('1'));
      expect(formatEther(wei)).toBe('0.000000000000000001');
    });

    it('should handle very large amounts', () => {
      const wei = parseEther('999999999.999999999999999999');
      // The decimal part gets truncated to 18 digits: 999999999999999999
      expect(wei).toBe(BigInt('999999999999999999999999999'));
      expect(formatEther(wei)).toBe('999999999.999999999999999999');
    });
  });
});
