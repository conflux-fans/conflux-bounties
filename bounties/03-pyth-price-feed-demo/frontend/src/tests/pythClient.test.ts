class MockWebSocket {
  static instances: MockWebSocket[] = [];
  
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  onclose: (() => void) | null = null;
  
  send = jest.fn();
  close = jest.fn();
  readyState = 1;
  
  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }
  
  static getLatest() {
    return this.instances[this.instances.length - 1];
  }
  
  static reset() {
    this.instances = [];
  }
}

global.WebSocket = MockWebSocket as any;

// Create mock functions
const mockGetLatestPriceFeeds = jest.fn();
const mockGetPriceFeedsUpdateData = jest.fn();

jest.mock('@pythnetwork/pyth-evm-js', () => ({
  EvmPriceServiceConnection: jest.fn().mockImplementation(() => ({
    getLatestPriceFeeds: mockGetLatestPriceFeeds,
    getPriceFeedsUpdateData: mockGetPriceFeedsUpdateData,
  })),
}));

// Mock console methods
const originalConsoleError = console.error;

describe('PythClient', () => {
  const { PythClient, pythClient } = require('../lib/pythClient');

  const mockPriceIds = [
    '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  ];

  const mockPriceFeeds = [
    {
      id: mockPriceIds[0],
      price: { price: '6500000000000', conf: '100000000', expo: -8, publishTime: 1234567890 },
      emaPrice: { price: '6500000000000', conf: '100000000', expo: -8, publishTime: 1234567890 },
    },
    {
      id: mockPriceIds[1],
      price: { price: '350000000000', conf: '50000000', expo: -8, publishTime: 1234567890 },
      emaPrice: { price: '350000000000', conf: '50000000', expo: -8, publishTime: 1234567890 },
    },
  ];

  const mockUpdateData = ['0x01234567890abcdef', '0xfedcba0987654321'];

  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    MockWebSocket.reset();
    
    mockGetLatestPriceFeeds.mockResolvedValue(mockPriceFeeds);
    mockGetPriceFeedsUpdateData.mockResolvedValue(mockUpdateData);
  });

  describe('Constructor', () => {
    test('creates EvmPriceServiceConnection with Hermes URL', () => {
      new PythClient();
      
      const EvmPriceServiceConnection = require('@pythnetwork/pyth-evm-js').EvmPriceServiceConnection;
      expect(EvmPriceServiceConnection).toHaveBeenCalledWith('https://hermes.pyth.network');
    });

    test('stores connection instance', () => {
      const client = new PythClient();
      
      expect(client).toHaveProperty('connection');
    });
  });

  describe('getLatestPrices', () => {
    test('calls getLatestPriceFeeds with correct price IDs', async () => {
      const client = new PythClient();
      
      await client.getLatestPrices(mockPriceIds);
      
      expect(mockGetLatestPriceFeeds).toHaveBeenCalledWith(mockPriceIds);
    });

    test('returns price feeds data', async () => {
      const client = new PythClient();
      
      const result = await client.getLatestPrices(mockPriceIds);
      
      expect(result).toEqual(mockPriceFeeds);
    });

    test('handles empty price IDs array', async () => {
      const client = new PythClient();
      mockGetLatestPriceFeeds.mockResolvedValue([]);
      
      const result = await client.getLatestPrices([]);
      
      expect(result).toEqual([]);
      expect(mockGetLatestPriceFeeds).toHaveBeenCalledWith([]);
    });

    test('handles single price ID', async () => {
      const client = new PythClient();
      const singleId = [mockPriceIds[0]];
      mockGetLatestPriceFeeds.mockResolvedValue([mockPriceFeeds[0]]);
      
      const result = await client.getLatestPrices(singleId);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockPriceIds[0]);
    });

    test('logs error and rethrows on failure', async () => {
      const client = new PythClient();
      const error = new Error('Network error');
      mockGetLatestPriceFeeds.mockRejectedValue(error);
      
      await expect(client.getLatestPrices(mockPriceIds)).rejects.toThrow('Network error');
      
      expect(console.error).toHaveBeenCalledWith('Error fetching prices from Pyth:', error);
    });

    test('handles API rate limiting error', async () => {
      const client = new PythClient();
      const error = new Error('Rate limit exceeded');
      mockGetLatestPriceFeeds.mockRejectedValue(error);
      
      await expect(client.getLatestPrices(mockPriceIds)).rejects.toThrow('Rate limit exceeded');
    });

    test('handles invalid price ID error', async () => {
      const client = new PythClient();
      const error = new Error('Invalid price ID format');
      mockGetLatestPriceFeeds.mockRejectedValue(error);
      
      await expect(client.getLatestPrices(['invalid'])).rejects.toThrow('Invalid price ID format');
    });
  });

  describe('getPriceUpdateData', () => {
    test('calls getPriceFeedsUpdateData with correct price IDs', async () => {
      const client = new PythClient();
      
      await client.getPriceUpdateData(mockPriceIds);
      
      expect(mockGetPriceFeedsUpdateData).toHaveBeenCalledWith(mockPriceIds);
    });

    test('returns update data', async () => {
      const client = new PythClient();
      
      const result = await client.getPriceUpdateData(mockPriceIds);
      
      expect(result).toEqual(mockUpdateData);
    });

    test('handles empty price IDs array', async () => {
      const client = new PythClient();
      mockGetPriceFeedsUpdateData.mockResolvedValue([]);
      
      const result = await client.getPriceUpdateData([]);
      
      expect(result).toEqual([]);
    });

    test('handles single price ID', async () => {
      const client = new PythClient();
      const singleId = [mockPriceIds[0]];
      mockGetPriceFeedsUpdateData.mockResolvedValue([mockUpdateData[0]]);
      
      const result = await client.getPriceUpdateData(singleId);
      
      expect(result).toHaveLength(1);
    });

    test('logs error and rethrows on failure', async () => {
      const client = new PythClient();
      const error = new Error('Update data error');
      mockGetPriceFeedsUpdateData.mockRejectedValue(error);
      
      await expect(client.getPriceUpdateData(mockPriceIds)).rejects.toThrow('Update data error');
      
      expect(console.error).toHaveBeenCalledWith('Error getting price update data:', error);
    });

    test('handles network timeout', async () => {
      const client = new PythClient();
      const error = new Error('Request timeout');
      mockGetPriceFeedsUpdateData.mockRejectedValue(error);
      
      await expect(client.getPriceUpdateData(mockPriceIds)).rejects.toThrow('Request timeout');
    });
  });

  describe('streamPrices', () => {
    test('creates WebSocket with correct URL', () => {
      const client = new PythClient();
      const callback = jest.fn();
      
      client.streamPrices(mockPriceIds, callback);
      
      const ws = MockWebSocket.getLatest();
      expect(ws.url).toBe('wss://hermes.pyth.network/ws');
    });

    test('sends subscribe message on open', () => {
      const client = new PythClient();
      const callback = jest.fn();
      
      client.streamPrices(mockPriceIds, callback);
      
      const ws = MockWebSocket.getLatest();
      
      // Trigger onopen
      if (ws.onopen) ws.onopen();
      
      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'subscribe',
          ids: mockPriceIds,
        })
      );
    });

    test('calls callback with parsed message data', () => {
      const client = new PythClient();
      const callback = jest.fn();
      
      client.streamPrices(mockPriceIds, callback);
      
      const ws = MockWebSocket.getLatest();
      const testData = { price: 65000, symbol: 'BTC' };
      
      // Trigger onmessage
      if (ws.onmessage) {
        ws.onmessage({ data: JSON.stringify(testData) });
      }
      
      expect(callback).toHaveBeenCalledWith(testData);
    });

    test('handles multiple messages', () => {
      const client = new PythClient();
      const callback = jest.fn();
      
      client.streamPrices(mockPriceIds, callback);
      
      const ws = MockWebSocket.getLatest();
      const message1 = { price: 65000 };
      const message2 = { price: 65100 };
      
      if (ws.onmessage) {
        ws.onmessage({ data: JSON.stringify(message1) });
        ws.onmessage({ data: JSON.stringify(message2) });
      }
      
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(1, message1);
      expect(callback).toHaveBeenNthCalledWith(2, message2);
    });

    test('returns cleanup function', () => {
      const client = new PythClient();
      const callback = jest.fn();
      
      const result = client.streamPrices(mockPriceIds, callback);
      
      expect(typeof result).toBe('function');
    });

    test('cleanup function closes WebSocket', () => {
      const client = new PythClient();
      const callback = jest.fn();
      
      const cleanup = client.streamPrices(mockPriceIds, callback);
      const ws = MockWebSocket.getLatest();
      
      if (typeof cleanup === 'function') {
        cleanup();
      }
      
      expect(ws.close).toHaveBeenCalled();
    });

    test('logs error on JSON parse failure', () => {
      const client = new PythClient();
      const callback = jest.fn();
      
      client.streamPrices(mockPriceIds, callback);
      
      const ws = MockWebSocket.getLatest();
      
      if (ws.onmessage) {
        ws.onmessage({ data: 'invalid json' });
      }
      
      expect(console.error).toHaveBeenCalledWith(
        'Error parsing WebSocket message:',
        expect.any(Error)
      );
      expect(callback).not.toHaveBeenCalled();
    });

    test('handles empty price IDs array', () => {
      const client = new PythClient();
      const callback = jest.fn();
      
      client.streamPrices([], callback);
      
      const ws = MockWebSocket.getLatest();
      
      if (ws.onopen) ws.onopen();
      
      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'subscribe',
          ids: [],
        })
      );
    });

    test('handles single price ID', () => {
      const client = new PythClient();
      const callback = jest.fn();
      const singleId = [mockPriceIds[0]];
      
      client.streamPrices(singleId, callback);
      
      const ws = MockWebSocket.getLatest();
      
      if (ws.onopen) ws.onopen();
      
      const sentData = JSON.parse(ws.send.mock.calls[0][0]);
      expect(sentData.ids).toEqual(singleId);
    });
  });

  describe('Exported pythClient Instance', () => {
    test('is instance of PythClient', () => {
      expect(pythClient).toBeInstanceOf(PythClient);
    });

    test('has getLatestPrices method', () => {
      expect(typeof pythClient.getLatestPrices).toBe('function');
    });

    test('has getPriceUpdateData method', () => {
      expect(typeof pythClient.getPriceUpdateData).toBe('function');
    });

    test('has streamPrices method', () => {
      expect(typeof pythClient.streamPrices).toBe('function');
    });

    test('can call methods on singleton', async () => {
      const result = await pythClient.getLatestPrices(mockPriceIds);
      
      expect(result).toEqual(mockPriceFeeds);
    });
  });

  describe('Integration Tests', () => {
    test('can fetch prices and update data sequentially', async () => {
      const client = new PythClient();
      
      const prices = await client.getLatestPrices(mockPriceIds);
      const updateData = await client.getPriceUpdateData(mockPriceIds);
      
      expect(prices).toEqual(mockPriceFeeds);
      expect(updateData).toEqual(mockUpdateData);
    });

    test('can fetch prices and stream simultaneously', async () => {
      const client = new PythClient();
      const callback = jest.fn();
      
      const pricesPromise = client.getLatestPrices(mockPriceIds);
      const result = client.streamPrices(mockPriceIds, callback);
      
      const prices = await pricesPromise;
      
      expect(prices).toEqual(mockPriceFeeds);
      expect(typeof result).toBe('function');
      
      if (typeof result === 'function') {
        result();
      }
    });
  });

  describe('Error Recovery', () => {
    test('can retry after failed getLatestPrices', async () => {
      const client = new PythClient();
      
      mockGetLatestPriceFeeds.mockRejectedValueOnce(new Error('First failure'));
      mockGetLatestPriceFeeds.mockResolvedValueOnce(mockPriceFeeds);
      
      await expect(client.getLatestPrices(mockPriceIds)).rejects.toThrow('First failure');
      
      const result = await client.getLatestPrices(mockPriceIds);
      expect(result).toEqual(mockPriceFeeds);
    });

    test('can retry after failed getPriceUpdateData', async () => {
      const client = new PythClient();
      
      mockGetPriceFeedsUpdateData.mockRejectedValueOnce(new Error('First failure'));
      mockGetPriceFeedsUpdateData.mockResolvedValueOnce(mockUpdateData);
      
      await expect(client.getPriceUpdateData(mockPriceIds)).rejects.toThrow('First failure');
      
      const result = await client.getPriceUpdateData(mockPriceIds);
      expect(result).toEqual(mockUpdateData);
    });
  });

  describe('Data Validation', () => {
    test('price feeds have correct structure', async () => {
      const client = new PythClient();
      
      const result = await client.getLatestPrices(mockPriceIds);
      
      result.forEach((feed: any) => {
        expect(feed).toHaveProperty('id');
        expect(feed).toHaveProperty('price');
        expect(feed.price).toHaveProperty('price');
        expect(feed.price).toHaveProperty('conf');
        expect(feed.price).toHaveProperty('expo');
        expect(feed).toHaveProperty('emaPrice');
      });
    });

    test('update data are hex strings', async () => {
      const client = new PythClient();
      
      const result = await client.getPriceUpdateData(mockPriceIds);
      
      result.forEach((data: string) => {
        expect(typeof data).toBe('string');
        expect(data).toMatch(/^0x[0-9a-f]+$/i);
      });
    });
  });
});