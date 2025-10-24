import request from 'supertest';
import express from 'express';
import pricesRouter from '../../src/routes/prices';
import { pythService } from '../../src/services/pythService';
import { priceHistoryService } from '../../src/services/priceHistory';
import { logger } from '../../src/utils/logger';

jest.mock('../../src/services/pythService');
jest.mock('../../src/services/priceHistory');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockedPythService = pythService as jest.Mocked<typeof pythService>;
const mockedPriceHistoryService = priceHistoryService as jest.Mocked<typeof priceHistoryService>;

const app = express();
app.use(express.json());
app.use('/api/prices', pricesRouter);

describe('Prices API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/prices/current', () => {
    it('should return all current prices', async () => {
      const mockPrices = [
        {
          symbol: 'BTC',
          price: '12345678000000',
          confidence: '95000000',
          expo: -8,
          publishTime: 1728456789,
          formattedPrice: '123456.78',
        },
        {
          symbol: 'ETH',
          price: '453295000000',
          confidence: '85000000',
          expo: -8,
          publishTime: 1728456790,
          formattedPrice: '4532.95',
        },
      ];

      mockedPythService.getAllPrices.mockResolvedValue(mockPrices);

      const response = await request(app)
        .get('/api/prices/current')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.timestamp).toBeDefined();
    });

    it('should handle service errors', async () => {
      mockedPythService.getAllPrices.mockRejectedValue(new Error('Pyth Error'));

      const response = await request(app)
        .get('/api/prices/current')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch prices');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('GET /api/prices/:symbol', () => {
    it('should return specific price', async () => {
      const mockPrice = {
        symbol: 'BTC',
        price: '12345678000000',
        confidence: '95000000',
        expo: -8,
        publishTime: 1728456789,
        formattedPrice: '123456.78',
      };

      mockedPythService.getPrice.mockResolvedValue(mockPrice);

      const response = await request(app)
        .get('/api/prices/BTC')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbol).toBe('BTC');
      expect(response.body.data.formattedPrice).toBe('123456.78');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should return 404 for non-existent asset', async () => {
      mockedPythService.getPrice.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/prices/INVALID')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Asset not found');
    });

    it('should normalize symbol to uppercase', async () => {
      const mockPrice = {
        symbol: 'BTC',
        price: '12345678000000',
        confidence: '95000000',
        expo: -8,
        publishTime: 1728456789,
        formattedPrice: '123456.78',
      };

      mockedPythService.getPrice.mockResolvedValue(mockPrice);

      await request(app)
        .get('/api/prices/btc')
        .expect(200);

      expect(mockedPythService.getPrice).toHaveBeenCalledWith('BTC');
    });

    it('should handle errors when fetching price', async () => {
      mockedPythService.getPrice.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/prices/BTC')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch price');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('GET /api/prices/:symbol/history', () => {
    it('should return price history with default parameters', async () => {
      const mockHistory = [
        { timestamp: 1728456789, price: 123456.78 },
        { timestamp: 1728456790, price: 123457.00 },
      ];

      mockedPriceHistoryService.getHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/api/prices/BTC/history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHistory);
      expect(response.body.metadata.symbol).toBe('BTC');
      expect(response.body.metadata.timeframe).toBe('1h');
      expect(response.body.metadata.count).toBe(2);
      expect(mockedPriceHistoryService.getHistory).toHaveBeenCalledWith('BTC', '1h', 100);
    });

    it('should respect timeframe and limit parameters', async () => {
      const mockHistory = [
        { timestamp: 1728456789, price: 123456.78 },
      ];

      mockedPriceHistoryService.getHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/api/prices/ETH/history?timeframe=24h&limit=50')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.timeframe).toBe('24h');
      expect(response.body.metadata.count).toBe(1);
      expect(mockedPriceHistoryService.getHistory).toHaveBeenCalledWith('ETH', '24h', 50);
    });

    it('should normalize symbol to uppercase', async () => {
      const mockHistory = [];
      mockedPriceHistoryService.getHistory.mockResolvedValue(mockHistory);

      await request(app)
        .get('/api/prices/cfx/history')
        .expect(200);

      expect(mockedPriceHistoryService.getHistory).toHaveBeenCalledWith('CFX', '1h', 100);
    });

    it('should handle errors when fetching history', async () => {
      mockedPriceHistoryService.getHistory.mockRejectedValue(new Error('History error'));

      const response = await request(app)
        .get('/api/prices/BTC/history')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch price history');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should return empty array when no history', async () => {
      mockedPriceHistoryService.getHistory.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/prices/BTC/history')
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.metadata.count).toBe(0);
    });
  });

  describe('GET /api/prices/:symbol/stats', () => {
    it('should return price statistics with default timeframe', async () => {
      const mockStats = {
        high: 125000.00,
        low: 123000.00,
        average: 124000.00,
        change: 2.5,
        volume: 1000000,
      };

      mockedPriceHistoryService.getStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/prices/BTC/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(mockedPriceHistoryService.getStats).toHaveBeenCalledWith('BTC', '24h');
    });

    it('should respect custom timeframe', async () => {
      const mockStats = {
        high: 5000.00,
        low: 4800.00,
        average: 4900.00,
        change: 1.5,
      };

      mockedPriceHistoryService.getStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/prices/ETH/stats?timeframe=7d')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(mockedPriceHistoryService.getStats).toHaveBeenCalledWith('ETH', '7d');
    });

    it('should normalize symbol to uppercase', async () => {
      const mockStats = { high: 1.00, low: 0.90, average: 0.95 };
      mockedPriceHistoryService.getStats.mockResolvedValue(mockStats);

      await request(app)
        .get('/api/prices/cfx/stats')
        .expect(200);

      expect(mockedPriceHistoryService.getStats).toHaveBeenCalledWith('CFX', '24h');
    });

    it('should handle errors when fetching stats', async () => {
      mockedPriceHistoryService.getStats.mockRejectedValue(new Error('Stats error'));

      const response = await request(app)
        .get('/api/prices/BTC/stats')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch statistics');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle different timeframe values', async () => {
      const mockStats = { high: 125000, low: 123000, average: 124000 };
      mockedPriceHistoryService.getStats.mockResolvedValue(mockStats);

      await request(app)
        .get('/api/prices/BTC/stats?timeframe=1h')
        .expect(200);

      expect(mockedPriceHistoryService.getStats).toHaveBeenCalledWith('BTC', '1h');
    });
  });

  describe('POST /api/prices/update', () => {
    it('should return price update data', async () => {
      const mockUpdateData = ['0xabcdef123456'];

      mockedPythService.getPriceUpdateData.mockResolvedValue(mockUpdateData);

      const response = await request(app)
        .post('/api/prices/update')
        .send({ priceIds: ['0x1234'] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUpdateData);
      expect(mockedPythService.getPriceUpdateData).toHaveBeenCalledWith(['0x1234']);
    });

    it('should return 400 for invalid priceIds (not array)', async () => {
      const response = await request(app)
        .post('/api/prices/update')
        .send({ priceIds: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid priceIds array');
    });

    it('should return 400 for empty priceIds array', async () => {
      const response = await request(app)
        .post('/api/prices/update')
        .send({ priceIds: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid priceIds array');
    });

    it('should return 400 for missing priceIds', async () => {
      const response = await request(app)
        .post('/api/prices/update')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Invalid priceIds array');
    });

    it('should handle errors when getting update data', async () => {
      mockedPythService.getPriceUpdateData.mockRejectedValue(new Error('Update error'));

      const response = await request(app)
        .post('/api/prices/update')
        .send({ priceIds: ['0x1234'] })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get update data');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle multiple priceIds', async () => {
      const mockUpdateData = ['0xabc', '0xdef', '0x123'];
      mockedPythService.getPriceUpdateData.mockResolvedValue(mockUpdateData);

      const response = await request(app)
        .post('/api/prices/update')
        .send({ priceIds: ['0x1', '0x2', '0x3'] })
        .expect(200);

      expect(response.body.data).toEqual(mockUpdateData);
    });
  });
});