// import { logger } from '../utils/logger';

interface PricePoint {
  timestamp: number;
  price: number;
  volume?: number;
}

interface PriceStats {
  current: number;
  high: number;
  low: number;
  average: number;
  change: number;
  changePercent: number;
  volatility: number;
}

class PriceHistoryService {
  private history: Map<string, PricePoint[]>;
  private readonly MAX_HISTORY_POINTS = 10000;

  constructor() {
    this.history = new Map();
  }

  recordPrice(symbol: string, price: number, timestamp?: number) {
    const point: PricePoint = {
      timestamp: timestamp || Date.now(),
      price,
    };

    if (!this.history.has(symbol)) {
      this.history.set(symbol, []);
    }

    const points = this.history.get(symbol)!;
    points.push(point);

    if (points.length > this.MAX_HISTORY_POINTS) {
      points.shift();
    }
  }

  getHistory(
    symbol: string,
    timeframe: string,
    limit: number
  ): PricePoint[] {
    const points = this.history.get(symbol) || [];
    
    const now = Date.now();
    const timeframeMs = this.parseTimeframe(timeframe);
    const cutoff = now - timeframeMs;

    const filtered = points.filter(p => p.timestamp >= cutoff);
    
    return filtered.slice(-limit);
  }

  getStats(symbol: string, timeframe: string): PriceStats {
    const points = this.getHistory(symbol, timeframe, this.MAX_HISTORY_POINTS);

    if (points.length === 0) {
      return {
        current: 0,
        high: 0,
        low: 0,
        average: 0,
        change: 0,
        changePercent: 0,
        volatility: 0,
      };
    }

    const prices = points.map(p => p.price);
    const current = prices[prices.length - 1];
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const average = prices.reduce((a, b) => a + b, 0) / prices.length;
    const change = current - prices[0];
    const changePercent = (change / prices[0]) * 100;
    const volatility = this.calculateVolatility(prices);

    return {
      current,
      high,
      low,
      average,
      change,
      changePercent,
      volatility,
    };
  }

  private parseTimeframe(timeframe: string): number {
    const map: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    return map[timeframe] || map['24h'];
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, price) => {
      return sum + Math.pow(price - mean, 2);
    }, 0) / prices.length;

    return Math.sqrt(variance);
  }
}

export const priceHistoryService = new PriceHistoryService();