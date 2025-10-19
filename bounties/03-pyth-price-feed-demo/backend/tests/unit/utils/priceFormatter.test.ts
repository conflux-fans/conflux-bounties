import { PriceFormatter } from '../../../src/utils/priceFormatter';

describe('PriceFormatter', () => {
  describe('formatPrice', () => {
    it('should format price with default 2 decimals', () => {
      expect(PriceFormatter.formatPrice(123456.789)).toBe('123456.79');
    });

    it('should format price with custom decimals', () => {
      expect(PriceFormatter.formatPrice(123456.789, 4)).toBe('123456.7890');
    });

    it('should handle zero', () => {
      expect(PriceFormatter.formatPrice(0)).toBe('0.00');
    });
  });

  describe('formatWithCommas', () => {
    it('should format with thousands separators', () => {
      expect(PriceFormatter.formatWithCommas(1234567.89)).toBe('1,234,567.89');
    });

    it('should handle small numbers', () => {
      expect(PriceFormatter.formatWithCommas(123.45)).toBe('123.45');
    });
  });

  describe('calculatePercentageChange', () => {
    it('should calculate positive change', () => {
      expect(PriceFormatter.calculatePercentageChange(110, 100)).toBe(10);
    });

    it('should calculate negative change', () => {
      expect(PriceFormatter.calculatePercentageChange(90, 100)).toBe(-10);
    });

    it('should return 0 for zero previous value', () => {
      expect(PriceFormatter.calculatePercentageChange(100, 0)).toBe(0);
    });
  });

  describe('scalePythPrice', () => {
    it('should scale price with negative exponent', () => {
      expect(PriceFormatter.scalePythPrice('12345678000000', -8)).toBe(123456.78);
    });

    it('should scale price with positive exponent', () => {
      expect(PriceFormatter.scalePythPrice('123', 2)).toBe(12300);
    });
  });

  describe('formatCompact', () => {
    it('should format billions', () => {
      expect(PriceFormatter.formatCompact(1500000000)).toBe('1.50B');
    });

    it('should format millions', () => {
      expect(PriceFormatter.formatCompact(2500000)).toBe('2.50M');
    });

    it('should format thousands', () => {
      expect(PriceFormatter.formatCompact(3500)).toBe('3.50K');
    });

    it('should format small numbers', () => {
      expect(PriceFormatter.formatCompact(123.45)).toBe('123.45');
    });
  });
});