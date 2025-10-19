export class PriceFormatter {
  static formatPrice(price: number, decimals: number = 2): string {
    return price.toFixed(decimals);
  }

  static formatWithCommas(value: number): string {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  static calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }

  static scalePythPrice(price: string, expo: number): number {
    return Number(price) * Math.pow(10, expo);
  }

  static formatCompact(value: number): string {
    if (value >= 1e9) {
      return `${(value / 1e9).toFixed(2)}B`;
    }
    if (value >= 1e6) {
      return `${(value / 1e6).toFixed(2)}M`;
    }
    if (value >= 1e3) {
      return `${(value / 1e3).toFixed(2)}K`;
    }
    return value.toFixed(2);
  }
}