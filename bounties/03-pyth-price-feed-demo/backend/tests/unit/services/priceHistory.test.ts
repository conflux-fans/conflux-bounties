import { priceHistoryService } from '../../../src/services/priceHistory';

describe('PriceHistoryService', () => {
  beforeEach(() => {
    priceHistoryService['history'].clear();
  });

  describe('recordPrice', () => {
    it('should record price successfully', () => {
      priceHistoryService.recordPrice('BTC', 123456.78);

      const history = priceHistoryService.getHistory('BTC', '24h', 100);
      expect(history).toHaveLength(1);
      expect(history[0].price).toBe(123456.78);
    });

    it('should use current timestamp when not provided', () => {
      const before = Date.now();
      priceHistoryService.recordPrice('BTC', 123456.78);
      const after = Date.now();

      const history = priceHistoryService.getHistory('BTC', '24h', 100);
      expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(history[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should use custom timestamp', () => {
      const timestamp = Date.now() - 60000;
      priceHistoryService.recordPrice('BTC', 123456.78, timestamp);

      const history = priceHistoryService.getHistory('BTC', '24h', 100);
      expect(history[0].timestamp).toBe(timestamp);
    });

    it('should maintain multiple symbols separately', () => {
      priceHistoryService.recordPrice('BTC', 123456.78);
      priceHistoryService.recordPrice('ETH', 4532.95);

      const btcHistory = priceHistoryService.getHistory('BTC', '24h', 100);
      const ethHistory = priceHistoryService.getHistory('ETH', '24h', 100);

      expect(btcHistory).toHaveLength(1);
      expect(ethHistory).toHaveLength(1);
      expect(btcHistory[0].price).toBe(123456.78);
      expect(ethHistory[0].price).toBe(4532.95);
    });

    it('should create new history array for new symbol', () => {
      priceHistoryService.recordPrice('NEWCOIN', 100);
      
      const history = priceHistoryService.getHistory('NEWCOIN', '24h', 100);
      expect(history).toHaveLength(1);
      expect(history[0].price).toBe(100);
    });

    it('should trim history when exceeding MAX_HISTORY_POINTS', () => {
      const MAX_POINTS = 10000;
      
      for (let i = 0; i < MAX_POINTS + 100; i++) {
        priceHistoryService.recordPrice('BTC', 120000 + i, Date.now() + i);
      }

      const allHistory = priceHistoryService['history'].get('BTC');
      
      expect(allHistory?.length).toBe(MAX_POINTS);
      
      expect(allHistory?.[0].price).toBe(120100);
    });

    it('should append to existing history for same symbol', () => {
      priceHistoryService.recordPrice('BTC', 120000);
      priceHistoryService.recordPrice('BTC', 121000);
      priceHistoryService.recordPrice('BTC', 122000);

      const history = priceHistoryService.getHistory('BTC', '24h', 100);
      expect(history).toHaveLength(3);
      expect(history[0].price).toBe(120000);
      expect(history[2].price).toBe(122000);
    });
  });

  describe('getHistory', () => {
    it('should return empty array for non-existent symbol', () => {
      const history = priceHistoryService.getHistory('NONEXISTENT', '24h', 100);
      expect(history).toEqual([]);
    });

    it('should filter by timeframe', () => {
      const now = Date.now();
      
      priceHistoryService.recordPrice('BTC', 120000, now - 2 * 60 * 60 * 1000);
      
      priceHistoryService.recordPrice('BTC', 123000, now - 30 * 60 * 1000);
      
      priceHistoryService.recordPrice('BTC', 125000, now);

      const history1h = priceHistoryService.getHistory('BTC', '1h', 100);
      expect(history1h).toHaveLength(2); 

      const history24h = priceHistoryService.getHistory('BTC', '24h', 100);
      expect(history24h).toHaveLength(3); 
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 100; i++) {
        priceHistoryService.recordPrice('BTC', 120000 + i);
      }

      const history = priceHistoryService.getHistory('BTC', '24h', 50);
      expect(history).toHaveLength(50);
      
      expect(history[49].price).toBe(120099);
    });

    it('should handle different timeframes', () => {
      const now = Date.now();

      priceHistoryService.recordPrice('BTC', 100, now - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      priceHistoryService.recordPrice('BTC', 101, now - 25 * 60 * 60 * 1000); // 25 hours ago
      priceHistoryService.recordPrice('BTC', 102, now - 23 * 60 * 60 * 1000); // 23 hours ago
      priceHistoryService.recordPrice('BTC', 103, now); // now

      const history1h = priceHistoryService.getHistory('BTC', '1h', 100);
      expect(history1h).toHaveLength(1); 

      const history24h = priceHistoryService.getHistory('BTC', '24h', 100);
      expect(history24h).toHaveLength(2); 

      const history7d = priceHistoryService.getHistory('BTC', '7d', 100);
      expect(history7d).toHaveLength(3); 

      const history30d = priceHistoryService.getHistory('BTC', '30d', 100);
      expect(history30d).toHaveLength(4); 
    });

    it('should handle unknown timeframe (defaults to 24h)', () => {
      const now = Date.now();
      
      priceHistoryService.recordPrice('BTC', 120000, now - 2 * 24 * 60 * 60 * 1000);
      priceHistoryService.recordPrice('BTC', 125000, now);

      const history = priceHistoryService.getHistory('BTC', 'invalid', 100);
      expect(history).toHaveLength(1);
    });

    it('should return empty array when all points outside timeframe', () => {
      const now = Date.now();
      
      priceHistoryService.recordPrice('BTC', 120000, now - 48 * 60 * 60 * 1000);

      const history = priceHistoryService.getHistory('BTC', '1h', 100);
      expect(history).toEqual([]);
    });

    it('should test 6h timeframe', () => {
      const now = Date.now();
      
      priceHistoryService.recordPrice('BTC', 100, now - 7 * 60 * 60 * 1000); 
      priceHistoryService.recordPrice('BTC', 101, now - 5 * 60 * 60 * 1000); 
      priceHistoryService.recordPrice('BTC', 102, now);

      const history6h = priceHistoryService.getHistory('BTC', '6h', 100);
      expect(history6h).toHaveLength(2);
    });
  });

  describe('getStats', () => {
    it('should return zero stats for empty history', () => {
      const stats = priceHistoryService.getStats('NONEXISTENT', '24h');

      expect(stats.current).toBe(0);
      expect(stats.high).toBe(0);
      expect(stats.low).toBe(0);
      expect(stats.average).toBe(0);
      expect(stats.change).toBe(0);
      expect(stats.changePercent).toBe(0);
      expect(stats.volatility).toBe(0);
    });

    it('should calculate correct statistics', () => {
      const prices = [120000, 125000, 122000, 128000, 123000];
      
      prices.forEach(price => {
        priceHistoryService.recordPrice('BTC', price);
      });

      const stats = priceHistoryService.getStats('BTC', '24h');

      expect(stats.current).toBe(123000);
      expect(stats.high).toBe(128000);
      expect(stats.low).toBe(120000);
      expect(stats.average).toBe(123600);
      expect(stats.change).toBe(3000);
      expect(stats.changePercent).toBeCloseTo(2.5, 1);
    });

    it('should calculate volatility', () => {
      const prices = [100, 110, 105, 115, 108];
      
      prices.forEach(price => {
        priceHistoryService.recordPrice('TEST', price);
      });

      const stats = priceHistoryService.getStats('TEST', '24h');

      expect(stats.volatility).toBeGreaterThan(0);
      expect(typeof stats.volatility).toBe('number');
    });

    it('should handle single price point', () => {
      priceHistoryService.recordPrice('BTC', 120000);

      const stats = priceHistoryService.getStats('BTC', '24h');

      expect(stats.current).toBe(120000);
      expect(stats.high).toBe(120000);
      expect(stats.low).toBe(120000);
      expect(stats.average).toBe(120000);
      expect(stats.change).toBe(0);
      expect(stats.changePercent).toBe(0);
      expect(stats.volatility).toBe(0);
    });

    it('should calculate negative change correctly', () => {
      priceHistoryService.recordPrice('BTC', 130000);
      priceHistoryService.recordPrice('BTC', 125000);
      priceHistoryService.recordPrice('BTC', 120000);

      const stats = priceHistoryService.getStats('BTC', '24h');

      expect(stats.change).toBe(-10000);
      expect(stats.changePercent).toBeCloseTo(-7.69, 1);
    });

    it('should respect different timeframes for stats', () => {
      const now = Date.now();

      priceHistoryService.recordPrice('BTC', 100000, now - 2 * 24 * 60 * 60 * 1000);
      priceHistoryService.recordPrice('BTC', 110000, now - 1 * 24 * 60 * 60 * 1000);
      priceHistoryService.recordPrice('BTC', 120000, now);

      const stats24h = priceHistoryService.getStats('BTC', '24h');
      expect(stats24h.low).toBe(110000);

      const stats7d = priceHistoryService.getStats('BTC', '7d');
      expect(stats7d.low).toBe(100000);
    });

    it('should calculate volatility with only one point as zero', () => {
      priceHistoryService.recordPrice('BTC', 120000);

      const stats = priceHistoryService.getStats('BTC', '24h');

      expect(stats.volatility).toBe(0);
    });

    it('should handle all timeframe options', () => {
      const now = Date.now();
      const timeframes = ['1h', '6h', '24h', '7d', '30d'];

      timeframes.forEach(tf => {
        priceHistoryService.recordPrice('TEST_' + tf, 100, now);
        const stats = priceHistoryService.getStats('TEST_' + tf, tf);
        expect(stats.current).toBe(100);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle very large price values', () => {
      priceHistoryService.recordPrice('BTC', 1000000000);
      
      const history = priceHistoryService.getHistory('BTC', '24h', 100);
      expect(history[0].price).toBe(1000000000);
    });

    it('should handle decimal prices', () => {
      priceHistoryService.recordPrice('SHIBA', 0.00001234);
      
      const history = priceHistoryService.getHistory('SHIBA', '24h', 100);
      expect(history[0].price).toBe(0.00001234);
    });

    it('should handle zero price', () => {
      priceHistoryService.recordPrice('TEST', 0);
      
      const stats = priceHistoryService.getStats('TEST', '24h');
      expect(stats.current).toBe(0);
    });

    it('should handle negative timestamps', () => {
      const now = Date.now();
      priceHistoryService.recordPrice('BTC', 100, now - 1000);
      priceHistoryService.recordPrice('BTC', 200, now);

      const history = priceHistoryService.getHistory('BTC', '1h', 100);
      expect(history.length).toBeGreaterThan(0);
    });
  });
});

