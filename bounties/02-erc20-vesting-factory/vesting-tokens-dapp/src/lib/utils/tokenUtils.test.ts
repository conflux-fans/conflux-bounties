import { weiToTokens, tokensToWei, formatTokenAmount, isWeiFormat } from './tokenUtils';

describe('tokenUtils', () => {
  describe('weiToTokens', () => {
    it('should convert Wei to tokens', () => {
      expect(weiToTokens('1000000000000000000')).toBe(1); // 1 ETH
      expect(weiToTokens('500000000000000000')).toBe(0.5); // 0.5 ETH
      expect(weiToTokens('100000000000000000')).toBe(0.1); // 0.1 ETH
    });

    it('should handle BigInt input', () => {
      expect(weiToTokens(BigInt('1000000000000000000'))).toBe(1);
      expect(weiToTokens(BigInt('500000000000000000'))).toBe(0.5);
    });

    it('should handle edge cases', () => {
      expect(weiToTokens('0')).toBe(0);
      expect(weiToTokens('')).toBe(0);
      expect(weiToTokens(null as unknown as string)).toBe(0);
      expect(weiToTokens(undefined as unknown as string)).toBe(0);
    });

    it('should handle very large amounts', () => {
      expect(weiToTokens('1000000000000000000000000')).toBe(1000000); // 1M ETH
      expect(weiToTokens('999999999999999999999999')).toBe(999999.999999999999999999);
    });
  });

  describe('tokensToWei', () => {
    it('should convert tokens to Wei', () => {
      expect(tokensToWei(1)).toBe(BigInt('1000000000000000000'));
      expect(tokensToWei(0.5)).toBe(BigInt('500000000000000000'));
      expect(tokensToWei(0.1)).toBe(BigInt('100000000000000000'));
    });

    it('should handle string input', () => {
      expect(tokensToWei('1')).toBe(BigInt('1000000000000000000'));
      expect(tokensToWei('0.5')).toBe(BigInt('500000000000000000'));
    });

    it('should handle edge cases', () => {
      expect(tokensToWei(0)).toBe(BigInt(0));
      expect(tokensToWei('')).toBe(BigInt(0));
      expect(tokensToWei(null as unknown as number | string)).toBe(BigInt(0));
      expect(tokensToWei(undefined as unknown as number | string)).toBe(BigInt(0));
    });

    it('should handle very large amounts', () => {
      expect(tokensToWei(1000000)).toBe(BigInt('1000000000000000000000000'));
      // parseEther truncates to 18 digits, so this will be rounded up
      expect(tokensToWei(999999.999999999999999999)).toBe(BigInt('1000000000000000000000000'));
    });
  });

  describe('formatTokenAmount', () => {
    it('should format token amounts with default decimals', () => {
      expect(formatTokenAmount(1234.5678)).toBe('1,234.57');
      expect(formatTokenAmount(0.123456)).toBe('0.12');
      expect(formatTokenAmount(1000000)).toBe('1,000,000');
    });

    it('should format with custom decimals', () => {
      expect(formatTokenAmount(1234.5678, 4)).toBe('1,234.5678');
      expect(formatTokenAmount(0.123456, 6)).toBe('0.123456');
      expect(formatTokenAmount(1000000, 0)).toBe('1,000,000');
    });

    it('should add symbol when provided', () => {
      expect(formatTokenAmount(1234.56, 2, 'ETH')).toBe('1,234.56 ETH');
      expect(formatTokenAmount(0.5, 2, 'USDC')).toBe('0.5 USDC');
    });

    it('should handle Wei format strings', () => {
      expect(formatTokenAmount('1000000000000000000')).toBe('1');
      expect(formatTokenAmount('500000000000000000')).toBe('0.5');
    });

    it('should handle BigInt input', () => {
      expect(formatTokenAmount(BigInt('1000000000000000000'))).toBe('1');
      expect(formatTokenAmount(BigInt('500000000000000000'))).toBe('0.5');
    });

    it('should handle edge cases', () => {
      expect(formatTokenAmount(0)).toBe('0');
      expect(formatTokenAmount('')).toBe('0');
      expect(formatTokenAmount(null as unknown as number | string | bigint)).toBe('0');
      expect(formatTokenAmount(undefined as unknown as number | string | bigint)).toBe('0');
    });
  });

  describe('isWeiFormat', () => {
    it('should detect Wei format values', () => {
      expect(isWeiFormat('100000000000000000')).toBe(true); // 0.1 ETH
      expect(isWeiFormat('1000000000000000000')).toBe(true); // 1 ETH
      expect(isWeiFormat('10000000000000000000')).toBe(true); // 10 ETH
    });

    it('should detect non-Wei format values', () => {
      expect(isWeiFormat('10000000000000000')).toBe(false); // Below threshold
      expect(isWeiFormat('1000000000000000')).toBe(false);
      expect(isWeiFormat('100000000000000')).toBe(false);
    });

    it('should handle BigInt input', () => {
      expect(isWeiFormat(BigInt('100000000000000000'))).toBe(true);
      expect(isWeiFormat(BigInt('10000000000000000'))).toBe(false);
    });

    it('should handle number input', () => {
      expect(isWeiFormat(1e17)).toBe(true);
      expect(isWeiFormat(1e16)).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isWeiFormat(0)).toBe(false);
      expect(isWeiFormat('')).toBe(false);
      expect(isWeiFormat(null as unknown as string | number | bigint)).toBe(false);
      expect(isWeiFormat(undefined as unknown as string | number | bigint)).toBe(false);
    });
  });

  describe('Integration tests', () => {
    it('should handle complete conversion cycle', () => {
      const originalAmount = 123.456;
      const wei = tokensToWei(originalAmount);
      const tokens = weiToTokens(wei);
      const formatted = formatTokenAmount(wei);
      
      expect(tokens).toBeCloseTo(originalAmount, 18);
      expect(formatted).toBe('123.46');
    });

    it('should handle very large amounts correctly', () => {
      const largeAmount = 999999999.999999999999999999;
      const wei = tokensToWei(largeAmount);
      const tokens = weiToTokens(wei);
      
      expect(tokens).toBeCloseTo(largeAmount, 18);
      expect(isWeiFormat(wei)).toBe(true);
    });

    it('should format various input types consistently', () => {
      const amount = 1000.5;
      const wei = tokensToWei(amount);
      
      expect(formatTokenAmount(amount)).toBe('1,000.5');
      expect(formatTokenAmount(wei)).toBe('1,000.5');
      expect(formatTokenAmount(wei.toString())).toBe('1,000.5');
    });
  });
}); 