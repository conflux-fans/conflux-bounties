import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js';

jest.mock('@pythnetwork/pyth-evm-js');

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { PythService } from '../../../src/services/pythService';
import { logger } from '../../../src/utils/logger';

describe('PythService', () => {
  let service: PythService;
  let mockConnection: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConnection = {
      getLatestPriceFeeds: jest.fn(),
      getPriceFeedsUpdateData: jest.fn(),
    };
    
    (EvmPriceServiceConnection as jest.Mock).mockImplementation(() => mockConnection);
    
    service = new PythService();
  });

  describe('getAllPrices', () => {
    it('should fetch and format all prices correctly', async () => {
      const mockPriceFeeds = [
        {
          id: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
          getPriceUnchecked: () => ({
            price: '4500000000000',
            conf: '100000000',
            expo: -8,
            publishTime: 1696800000,
          }),
        },
        {
          id: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
          getPriceUnchecked: () => ({
            price: '180000000000',
            conf: '50000000',
            expo: -8,
            publishTime: 1696800000,
          }),
        },
        {
          id: '8879170230c9603342f3837cf9a8e76c61791198fb1271bb2552c9af7b33c933',
          getPriceUnchecked: () => ({
            price: '5000000',
            conf: '10000',
            expo: -8,
            publishTime: 1696800000,
          }),
        },
      ];

      mockConnection.getLatestPriceFeeds.mockResolvedValue(mockPriceFeeds);

      const prices = await service.getAllPrices();

      expect(prices).toHaveLength(3);
      expect(prices[0].symbol).toBe('BTC');
      expect(prices[0].formattedPrice).toBe('45000.00');
      expect(prices[1].symbol).toBe('ETH');
      expect(prices[1].formattedPrice).toBe('1800.00');
      expect(prices[2].symbol).toBe('CFX');
      expect(prices[2].formattedPrice).toBe('0.05');
      
      expect(mockConnection.getLatestPriceFeeds).toHaveBeenCalled();
    });

    it('should handle errors and log them', async () => {
      const error = new Error('Network error');
      mockConnection.getLatestPriceFeeds.mockRejectedValue(error);

      await expect(service.getAllPrices()).rejects.toThrow('Network error');
      expect(logger.error).toHaveBeenCalledWith('Error fetching prices from Pyth:', error);
    });

    it('should update cache and timestamp', async () => {
      const mockFeed = {
        id: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        getPriceUnchecked: () => ({
          price: '4500000000000',
          conf: '100000000',
          expo: -8,
          publishTime: 1696800000,
        }),
      };

      mockConnection.getLatestPriceFeeds.mockResolvedValue([mockFeed]);

      await service.getAllPrices();

      const cached = service.getCachedPrice('BTC');
      expect(cached).toBeDefined();
      expect(cached?.symbol).toBe('BTC');

      const timestamp = service.getLastUpdateTime();
      expect(timestamp).toBeGreaterThan(0);
    });
  });

  describe('getPrice', () => {
    it('should fetch price for valid symbol', async () => {
      const mockPriceFeed = {
        id: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        getPriceUnchecked: () => ({
          price: '4500000000000',
          conf: '100000000',
          expo: -8,
          publishTime: 1696800000,
        }),
      };

      mockConnection.getLatestPriceFeeds.mockResolvedValue([mockPriceFeed]);

      const price = await service.getPrice('BTC');

      expect(price).not.toBeNull();
      expect(price?.symbol).toBe('BTC');
      expect(price?.price).toBe('4500000000000');
      expect(price?.confidence).toBe('100000000');
      expect(price?.expo).toBe(-8);
      expect(price?.publishTime).toBe(1696800000);
      expect(price?.formattedPrice).toBe('45000.00');
    });

    it('should return null for invalid symbol', async () => {
      const price = await service.getPrice('INVALID');
      expect(price).toBeNull();
      expect(mockConnection.getLatestPriceFeeds).not.toHaveBeenCalled();
    });

    it('should return null when no feeds returned', async () => {
      mockConnection.getLatestPriceFeeds.mockResolvedValue([]);
      const price = await service.getPrice('BTC');
      expect(price).toBeNull();
    });

    it('should return null when feeds are null', async () => {
      mockConnection.getLatestPriceFeeds.mockResolvedValue(null);
      const price = await service.getPrice('ETH');
      expect(price).toBeNull();
    });

    it('should handle errors', async () => {
      const error = new Error('Fetch failed');
      mockConnection.getLatestPriceFeeds.mockRejectedValue(error);

      await expect(service.getPrice('CFX')).rejects.toThrow('Fetch failed');
      expect(logger.error).toHaveBeenCalledWith('Error fetching price for CFX:', error);
    });

    it('should update cache after fetching', async () => {
      const mockPriceFeed = {
        id: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
        getPriceUnchecked: () => ({
          price: '180000000000',
          conf: '50000000',
          expo: -8,
          publishTime: 1696800000,
        }),
      };

      mockConnection.getLatestPriceFeeds.mockResolvedValue([mockPriceFeed]);

      await service.getPrice('ETH');

      const cached = service.getCachedPrice('ETH');
      expect(cached).toBeDefined();
      expect(cached?.symbol).toBe('ETH');
      expect(cached?.formattedPrice).toBe('1800.00');
    });

    it('should format CFX price correctly', async () => {
      const mockPriceFeed = {
        id: '8879170230c9603342f3837cf9a8e76c61791198fb1271bb2552c9af7b33c933',
        getPriceUnchecked: () => ({
          price: '5000000',
          conf: '10000',
          expo: -8,
          publishTime: 1696800000,
        }),
      };

      mockConnection.getLatestPriceFeeds.mockResolvedValue([mockPriceFeed]);

      const price = await service.getPrice('CFX');

      expect(price).not.toBeNull();
      expect(price?.symbol).toBe('CFX');
      expect(price?.formattedPrice).toBe('0.05');
    });
  });

  describe('getPriceUpdateData', () => {
    it('should fetch update data', async () => {
      const mockData = ['0xabc123', '0xdef456'];
      mockConnection.getPriceFeedsUpdateData.mockResolvedValue(mockData);

      const result = await service.getPriceUpdateData(['id1', 'id2']);

      expect(result).toEqual(mockData);
      expect(mockConnection.getPriceFeedsUpdateData).toHaveBeenCalledWith(['id1', 'id2']);
    });

    it('should handle errors', async () => {
      const error = new Error('Update failed');
      mockConnection.getPriceFeedsUpdateData.mockRejectedValue(error);

      await expect(service.getPriceUpdateData(['id1'])).rejects.toThrow('Update failed');
      expect(logger.error).toHaveBeenCalledWith('Error getting price update data:', error);
    });

    it('should work with empty array', async () => {
      mockConnection.getPriceFeedsUpdateData.mockResolvedValue([]);
      const result = await service.getPriceUpdateData([]);
      expect(result).toEqual([]);
    });

    it('should work with multiple IDs', async () => {
      const mockData = ['0x111', '0x222', '0x333'];
      const priceIds = [
        '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
        '0x8879170230c9603342f3837cf9a8e76c61791198fb1271bb2552c9af7b33c933',
      ];

      mockConnection.getPriceFeedsUpdateData.mockResolvedValue(mockData);

      const result = await service.getPriceUpdateData(priceIds);

      expect(result).toEqual(mockData);
      expect(result.length).toBe(3);
    });
  });

  describe('getCachedPrice', () => {
    it('should return undefined for non-existent cache', () => {
      const cached = service.getCachedPrice('NONEXISTENT');
      expect(cached).toBeUndefined();
    });

    it('should return cached price after fetch', async () => {
      const mockFeed = {
        id: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        getPriceUnchecked: () => ({
          price: '4500000000000',
          conf: '100000000',
          expo: -8,
          publishTime: 1696800000,
        }),
      };

      mockConnection.getLatestPriceFeeds.mockResolvedValue([mockFeed]);
      await service.getPrice('BTC');

      const cached = service.getCachedPrice('BTC');
      expect(cached).toBeDefined();
      expect(cached?.symbol).toBe('BTC');
    });
  });

  describe('getLastUpdateTime', () => {
    it('should return 0 initially', () => {
      const time = service.getLastUpdateTime();
      expect(time).toBe(0);
    });

    it('should update after fetch', async () => {
      const mockFeed = {
        id: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        getPriceUnchecked: () => ({
          price: '4500000000000',
          conf: '100000000',
          expo: -8,
          publishTime: 1696800000,
        }),
      };

      mockConnection.getLatestPriceFeeds.mockResolvedValue([mockFeed]);

      const before = service.getLastUpdateTime();
      await service.getAllPrices();
      const after = service.getLastUpdateTime();

      expect(after).toBeGreaterThan(before);
    });
  });

  describe('Price Formatting', () => {
    it('should format large prices', () => {
      const formatted = (Number('12345678000000') * Math.pow(10, -8)).toFixed(2);
      expect(formatted).toBe('123456.78');
    });

    it('should format small prices', () => {
      const formatted = (Number('15230000') * Math.pow(10, -8)).toFixed(4);
      expect(formatted).toBe('0.1523');
    });

    it('should format zero', () => {
      const formatted = (Number('0') * Math.pow(10, -8)).toFixed(2);
      expect(formatted).toBe('0.00');
    });
  });
});