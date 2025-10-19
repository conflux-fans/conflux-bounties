import { websocketService } from '../../../src/services/WebsocketService';
import { WebSocket } from 'ws';
import { pythService } from '../../../src/services/pythService';
import { priceHistoryService } from '../../../src/services/priceHistory';
import { logger } from '../../../src/utils/logger';

jest.mock('ws');

jest.mock('../../../src/services/pythService', () => ({
  pythService: {
    getAllPrices: jest.fn(),
  },
}));

jest.mock('../../../src/services/priceHistory', () => ({
  priceHistoryService: {
    recordPrice: jest.fn(),
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedPythService = pythService as jest.Mocked<typeof pythService>;
const mockedPriceHistoryService = priceHistoryService as jest.Mocked<typeof priceHistoryService>;

describe('WebSocketService', () => {
  let mockWs: jest.Mocked<WebSocket>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockWs = {
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      readyState: 1, // OPEN
    } as any;
  });

  afterEach(() => {
    websocketService.stopPriceStreaming();
  });

  describe('Client Management', () => {
    it('should add client successfully', () => {
      expect(() => {
        websocketService.addClient(mockWs);
      }).not.toThrow();
      
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('WebSocket client added'));
    });

    it('should remove client successfully', () => {
      websocketService.addClient(mockWs);
      
      expect(() => {
        websocketService.removeClient(mockWs);
      }).not.toThrow();
      
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('WebSocket client removed'));
    });

    it('should handle adding multiple clients', () => {
      const mockWs1 = { ...mockWs } as any;
      const mockWs2 = { ...mockWs } as any;
      const mockWs3 = { ...mockWs } as any;

      websocketService.addClient(mockWs1);
      websocketService.addClient(mockWs2);
      websocketService.addClient(mockWs3);
      
      expect(logger.info).toHaveBeenCalledTimes(3);
    });

    it('should handle removing non-existent client', () => {
      expect(() => {
        websocketService.removeClient(mockWs);
      }).not.toThrow();
    });
  });

  describe('Message Handling', () => {
    it('should handle subscribe_prices message', () => {
      const message = {
        type: 'subscribe_prices',
      };

      websocketService.handleMessage(mockWs, message);
      
      expect(logger.info).toHaveBeenCalledWith('Client subscribed to price updates');
    });

    it('should handle unsubscribe_prices message', () => {
      const message = {
        type: 'unsubscribe_prices',
      };

      websocketService.handleMessage(mockWs, message);
      
      expect(logger.info).toHaveBeenCalledWith('Client unsubscribed from price updates');
    });

    it('should handle unknown message type', () => {
      const message = {
        type: 'unknown_type',
      };

      websocketService.handleMessage(mockWs, message);
      
      expect(logger.warn).toHaveBeenCalledWith('Unknown message type:', 'unknown_type');
    });

    it('should handle malformed messages', () => {
      expect(() => {
        websocketService.handleMessage(mockWs, {});
      }).not.toThrow();
    });

    it('should handle message with no type', () => {
      websocketService.handleMessage(mockWs, { data: 'test' });
      
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast message to all clients', () => {
      websocketService.addClient(mockWs);

      const message = {
        type: 'price_update',
        data: { BTC: '123456.78' },
        timestamp: Date.now(),
      };

      websocketService.broadcast(message);

      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should not send to closed connections', () => {
      const closedWs = {
        ...mockWs,
        readyState: 3,
      } as any;

      websocketService.addClient(closedWs);
      websocketService.broadcast({ type: 'test', data: {} });

      expect(closedWs.send).not.toHaveBeenCalled();
    });

    it('should handle broadcast with no clients', () => {
      expect(() => {
        websocketService.broadcast({ type: 'test', data: {} });
      }).not.toThrow();
    });

    it('should serialize complex objects', () => {
      websocketService.addClient(mockWs);

      const complexMessage = {
        type: 'complex',
        data: {
          nested: { key: 'value' },
          array: [1, 2, 3],
          timestamp: Date.now(),
        },
      };

      websocketService.broadcast(complexMessage);

      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(complexMessage));
    });

    it('should broadcast to multiple clients', () => {
      const mockWs1 = { ...mockWs, send: jest.fn() } as any;
      const mockWs2 = { ...mockWs, send: jest.fn() } as any;

      websocketService.addClient(mockWs1);
      websocketService.addClient(mockWs2);

      const message = { type: 'test', data: {} };
      websocketService.broadcast(message);

      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });

  describe('Price Streaming - Lines 58-73', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start price streaming and fetch prices', async () => {
      const mockPrices = [
        {
          symbol: 'BTC',
          price: '12345678000000',
          confidence: '95000000',
          expo: -8,
          publishTime: Date.now(),
          formattedPrice: '123456.78',
        },
        {
          symbol: 'ETH',
          price: '453295000000',
          confidence: '85000000',
          expo: -8,
          publishTime: Date.now(),
          formattedPrice: '4532.95',
        },
      ];

      mockedPythService.getAllPrices.mockResolvedValue(mockPrices);

      websocketService.startPriceStreaming();

      expect(logger.info).toHaveBeenCalledWith('Starting price streaming service');

      jest.advanceTimersByTime(5000);

      await Promise.resolve();
      await Promise.resolve();

      expect(mockedPythService.getAllPrices).toHaveBeenCalled();

      expect(mockedPriceHistoryService.recordPrice).toHaveBeenCalledWith('BTC', 123456.78);
      expect(mockedPriceHistoryService.recordPrice).toHaveBeenCalledWith('ETH', 4532.95);

      websocketService.stopPriceStreaming();
    });

    it('should broadcast prices to connected clients', async () => {
      const mockPrices = [
        {
          symbol: 'BTC',
          formattedPrice: '123456.78',
        },
      ];

      mockedPythService.getAllPrices.mockResolvedValue(mockPrices as any);
      
      websocketService.addClient(mockWs);
      websocketService.startPriceStreaming();

      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"price_update"')
      );

      websocketService.stopPriceStreaming();
    });

    it('should handle errors during price streaming', async () => {
      mockedPythService.getAllPrices.mockRejectedValue(new Error('Pyth API error'));

      websocketService.startPriceStreaming();

      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();

      expect(logger.error).toHaveBeenCalledWith('Error streaming prices:', expect.any(Error));

      websocketService.stopPriceStreaming();
    });

    it('should stop price streaming', () => {
      websocketService.startPriceStreaming();
      websocketService.stopPriceStreaming();

      expect(logger.info).toHaveBeenCalledWith('Price streaming service stopped');
    });

    it('should not start multiple streaming instances', () => {
      websocketService.startPriceStreaming();
      websocketService.startPriceStreaming();

      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith('Starting price streaming service');

      websocketService.stopPriceStreaming();
    });

    it('should handle stopping when not started', () => {
      expect(() => {
        websocketService.stopPriceStreaming();
      }).not.toThrow();
    });

    it('should continue streaming after errors', async () => {
      mockedPythService.getAllPrices
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce([
          { symbol: 'BTC', formattedPrice: '123456.78' } as any,
        ]);

      websocketService.startPriceStreaming();

      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();

      expect(logger.error).toHaveBeenCalled();

      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockedPythService.getAllPrices).toHaveBeenCalledTimes(2);

      websocketService.stopPriceStreaming();
    });

    it('should record all prices in history', async () => {
      const mockPrices = [
        { symbol: 'BTC', formattedPrice: '123456.78' },
        { symbol: 'ETH', formattedPrice: '4532.95' },
        { symbol: 'CFX', formattedPrice: '0.05' },
      ];

      mockedPythService.getAllPrices.mockResolvedValue(mockPrices as any);

      websocketService.startPriceStreaming();

      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockedPriceHistoryService.recordPrice).toHaveBeenCalledTimes(3);
      expect(mockedPriceHistoryService.recordPrice).toHaveBeenCalledWith('BTC', 123456.78);
      expect(mockedPriceHistoryService.recordPrice).toHaveBeenCalledWith('ETH', 4532.95);
      expect(mockedPriceHistoryService.recordPrice).toHaveBeenCalledWith('CFX', 0.05);

      websocketService.stopPriceStreaming();
    });

    it('should include timestamp in broadcast message', async () => {
      const mockPrices = [{ symbol: 'BTC', formattedPrice: '123456.78' }];

      mockedPythService.getAllPrices.mockResolvedValue(mockPrices as any);
      
      websocketService.addClient(mockWs);
      websocketService.startPriceStreaming();

      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();

      const sentMessage = mockWs.send.mock.calls[0]?.[0];
      const parsedMessage = JSON.parse(sentMessage as string);

      expect(parsedMessage).toHaveProperty('timestamp');
      expect(parsedMessage.timestamp).toBeGreaterThan(0);

      websocketService.stopPriceStreaming();
    });
  });

  describe('Connection Lifecycle', () => {
    it('should handle full client lifecycle', () => {
      websocketService.addClient(mockWs);
      
      websocketService.handleMessage(mockWs, {
        type: 'subscribe_prices',
      });
      
      websocketService.broadcast({
        type: 'price_update',
        data: {},
      });
      
      websocketService.removeClient(mockWs);
      
      expect(mockWs.send).toHaveBeenCalled();
    });
  });
});