import { renderHook, waitFor, act } from '@testing-library/react';
import { usePythPrices } from '../hooks/usePythPrices';
import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js';

// Mock the Pyth SDK
jest.mock('@pythnetwork/pyth-evm-js');

describe('usePythPrices Custom Hook', () => {
  const mockGetLatestPriceFeeds = jest.fn();
  const mockGetPriceFeedsUpdateData = jest.fn();

  const mockPriceFeeds = [
    {
      id: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      getPriceUnchecked: () => ({
        price: '5000000000000',
        conf: '100000000',
        expo: -8,
        publishTime: Math.floor(Date.now() / 1000) - 10,
      }),
    },
    {
      id: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
      getPriceUnchecked: () => ({
        price: '300000000000',
        conf: '50000000',
        expo: -8,
        publishTime: Math.floor(Date.now() / 1000) - 10,
      }),
    },
    {
      id: '8879170230c9603342f3837cf9a8e76c61791198fb1271bb2552c9af7b33c933',
      getPriceUnchecked: () => ({
        price: '15230000',
        conf: '10000',
        expo: -8,
        publishTime: Math.floor(Date.now() / 1000) - 10,
      }),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock console methods
    global.console.log = jest.fn();
    global.console.error = jest.fn();
    global.console.warn = jest.fn();

    // Mock EvmPriceServiceConnection
    (EvmPriceServiceConnection as jest.Mock).mockImplementation(() => ({
      getLatestPriceFeeds: mockGetLatestPriceFeeds,
      getPriceFeedsUpdateData: mockGetPriceFeedsUpdateData,
    }));

    // Default successful response
    mockGetLatestPriceFeeds.mockResolvedValue(mockPriceFeeds);
    mockGetPriceFeedsUpdateData.mockResolvedValue(['0xupdate1', '0xupdate2']);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('Hook Initialization', () => {
    test('returns correct initial structure', () => {
      const { result } = renderHook(() => usePythPrices());
      
      expect(result.current).toHaveProperty('prices');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('getPriceUpdateData');
      expect(result.current).toHaveProperty('PRICE_FEEDS');
    });

    test('initializes with empty prices', () => {
      const { result } = renderHook(() => usePythPrices());
      
      expect(result.current.prices).toEqual({});
    });

    test('initializes with loading true', () => {
      const { result } = renderHook(() => usePythPrices());
      
      expect(result.current.loading).toBe(true);
    });

    test('initializes with no error', () => {
      const { result } = renderHook(() => usePythPrices());
      
      expect(result.current.error).toBeNull();
    });

    test('provides PRICE_FEEDS constant', () => {
      const { result } = renderHook(() => usePythPrices());
      
      expect(result.current.PRICE_FEEDS).toEqual({
        BTC: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        ETH: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
        CFX: '0x8879170230c9603342f3837cf9a8e76c61791198fb1271bb2552c9af7b33c933',
      });
    });
  });

  describe('Connection Setup', () => {
    test('creates EvmPriceServiceConnection on mount', () => {
      renderHook(() => usePythPrices());
      
      expect(EvmPriceServiceConnection).toHaveBeenCalledWith(
        'https://hermes.pyth.network'
      );
    });

    test('creates connection only once', () => {
      const { rerender } = renderHook(() => usePythPrices());
      
      rerender();
      
      expect(EvmPriceServiceConnection).toHaveBeenCalledTimes(1);
    });
  });

  describe('Price Fetching', () => {
    test('fetches prices on mount', async () => {
      renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(mockGetLatestPriceFeeds).toHaveBeenCalledWith([
          '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
          '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
          '0x8879170230c9603342f3837cf9a8e76c61791198fb1271bb2552c9af7b33c933',
        ]);
      });
    });

    test('updates prices state after successful fetch', async () => {
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.prices).toHaveProperty('BTC');
      expect(result.current.prices).toHaveProperty('ETH');
      expect(result.current.prices).toHaveProperty('CFX');
    });

    test('sets loading to false after fetch', async () => {
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    test('clears error on successful fetch', async () => {
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.error).toBeNull();
    });

    test('logs price updates', async () => {
      renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('BTC/USD Update:'),
          expect.any(Object)
        );
      });
    });

    test('logs all updated price symbols', async () => {
      renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          '✅ All prices updated:',
          expect.arrayContaining(['BTC', 'ETH', 'CFX'])
        );
      });
    });
  });

  describe('Price Data Structure', () => {
    test('creates correct price data structure for BTC', async () => {
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.prices.BTC).toMatchObject({
        id: expect.any(String),
        price: expect.any(String),
        confidence: expect.any(String),
        expo: expect.any(Number),
        publishTime: expect.any(Number),
        formattedPrice: expect.any(String),
        rawPrice: expect.any(Number),
      });
    });

    test('calculates raw price correctly', async () => {
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.prices.BTC.rawPrice).toBe(50000);
    });

    test('formats price as string', async () => {
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.prices.BTC.formattedPrice).toBe('50000');
    });

    test('stores all price feed data', async () => {
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      const btcPrice = result.current.prices.BTC;
      expect(btcPrice.id).toBe('e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43');
      expect(btcPrice.price).toBe('5000000000000');
      expect(btcPrice.confidence).toBe('100000000');
      expect(btcPrice.expo).toBe(-8);
    });
  });

  describe('Price Symbol Mapping', () => {
    test('maps BTC price feed ID to symbol', async () => {
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.prices).toHaveProperty('BTC');
    });

    test('maps ETH price feed ID to symbol', async () => {
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.prices).toHaveProperty('ETH');
    });

    test('maps CFX price feed ID to symbol', async () => {
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.prices).toHaveProperty('CFX');
    });

    test('warns about unknown price feeds', async () => {
      const unknownFeed = {
        id: 'unknown123',
        getPriceUnchecked: () => ({
          price: '100000000',
          conf: '1000000',
          expo: -8,
          publishTime: Math.floor(Date.now() / 1000),
        }),
      };

      mockGetLatestPriceFeeds.mockResolvedValue([...mockPriceFeeds, unknownFeed]);
      
      renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(console.warn).toHaveBeenCalledWith('Unknown price feed:', 'unknown123');
      });
    });

    test('skips unknown price feeds', async () => {
      const unknownFeed = {
        id: 'unknown123',
        getPriceUnchecked: () => ({
          price: '100000000',
          conf: '1000000',
          expo: -8,
          publishTime: Math.floor(Date.now() / 1000),
        }),
      };

      mockGetLatestPriceFeeds.mockResolvedValue([...mockPriceFeeds, unknownFeed]);
      
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(Object.keys(result.current.prices)).toHaveLength(3);
    });
  });

  describe('Error Handling', () => {
    test('handles fetch error', async () => {
      mockGetLatestPriceFeeds.mockRejectedValue(new Error('Network error'));
      
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.error).toBe('Network error');
    });

    test('logs fetch errors', async () => {
      const error = new Error('API error');
      mockGetLatestPriceFeeds.mockRejectedValue(error);
      
      renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith('❌ Error fetching prices:', error);
      });
    });

    test('handles empty price feeds response', async () => {
      mockGetLatestPriceFeeds.mockResolvedValue([]);
      
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.error).toBe('No price feeds received from Pyth Network');
    });

    test('handles null price feeds response', async () => {
      mockGetLatestPriceFeeds.mockResolvedValue(null);
      
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.error).toBe('No price feeds received from Pyth Network');
    });

    test('handles non-Error objects', async () => {
      mockGetLatestPriceFeeds.mockRejectedValue('String error');
      
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.error).toBe('Failed to fetch prices');
    });
  });

  describe('Automatic Refresh Interval', () => {
    test('sets up 5-second interval', async () => {
      renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(mockGetLatestPriceFeeds).toHaveBeenCalledTimes(1);
      });
      
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      
      await waitFor(() => {
        expect(mockGetLatestPriceFeeds).toHaveBeenCalledTimes(2);
      });
    });

    test('logs before each refresh', async () => {
      renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(mockGetLatestPriceFeeds).toHaveBeenCalledTimes(1);
      });
      
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith('⏰ Fetching new prices...');
      });
    });

    test('fetches multiple times on interval', async () => {
      renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(mockGetLatestPriceFeeds).toHaveBeenCalledTimes(1);
      });
      
      for (let i = 0; i < 3; i++) {
        act(() => {
          jest.advanceTimersByTime(5000);
        });
      }
      
      await waitFor(() => {
        expect(mockGetLatestPriceFeeds).toHaveBeenCalledTimes(4);
      });
    });

    test('continues fetching after error', async () => {
      mockGetLatestPriceFeeds
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockPriceFeeds);
      
      renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(mockGetLatestPriceFeeds).toHaveBeenCalledTimes(1);
      });
      
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      
      await waitFor(() => {
        expect(mockGetLatestPriceFeeds).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Cleanup', () => {
    test('clears interval on unmount', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      const { unmount } = renderHook(() => usePythPrices());
      
      unmount();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    test('logs cleanup message', () => {
      const { unmount } = renderHook(() => usePythPrices());
      
      unmount();
      
      expect(console.log).toHaveBeenCalledWith('🛑 Stopping price updates');
    });

    test('stops fetching after unmount', async () => {
      const { unmount } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(mockGetLatestPriceFeeds).toHaveBeenCalledTimes(1);
      });
      
      unmount();
      
      const callCount = mockGetLatestPriceFeeds.mock.calls.length;
      
      act(() => {
        jest.advanceTimersByTime(10000);
      });
      
      expect(mockGetLatestPriceFeeds).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('getPriceUpdateData Callback', () => {
    test('is a function', () => {
      const { result } = renderHook(() => usePythPrices());
      
      expect(typeof result.current.getPriceUpdateData).toBe('function');
    });

    test('calls connection.getPriceFeedsUpdateData', async () => {
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      const priceIds = ['0xabc123', '0xdef456'];
      
      await act(async () => {
        await result.current.getPriceUpdateData(priceIds);
      });
      
      expect(mockGetPriceFeedsUpdateData).toHaveBeenCalledWith(priceIds);
    });

    test('returns update data', async () => {
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      const updateData = await result.current.getPriceUpdateData(['0xabc']);
      
      expect(updateData).toEqual(['0xupdate1', '0xupdate2']);
    });

    test('returns empty array when connection is not ready', async () => {
      mockGetPriceFeedsUpdateData.mockRejectedValueOnce(new Error('Connection not ready'));
      
      const { result } = renderHook(() => usePythPrices());
      
      let updateData;
      await act(async () => {
        updateData = await result.current.getPriceUpdateData(['0xabc']);
      });
      
      expect(updateData).toEqual([]);
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      mockGetPriceFeedsUpdateData.mockResolvedValue(['0xupdate1', '0xupdate2']);
      
      await act(async () => {
        updateData = await result.current.getPriceUpdateData(['0xabc']);
      });
      
      expect(updateData).toEqual(['0xupdate1', '0xupdate2']);
    });

    test('handles errors gracefully', async () => {
      mockGetPriceFeedsUpdateData.mockRejectedValue(new Error('Update data error'));
      
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      const updateData = await result.current.getPriceUpdateData(['0xabc']);
      
      expect(console.error).toHaveBeenCalledWith(
        'Error getting update data:',
        expect.any(Error)
      );
      expect(updateData).toEqual([]);
    });

    test('maintains stable reference', () => {
      const { result, rerender } = renderHook(() => usePythPrices());
      
      const firstCallback = result.current.getPriceUpdateData;
      
      rerender();
      
      expect(result.current.getPriceUpdateData).toBe(firstCallback);
    });
  });

  describe('Price Calculations', () => {
    test('calculates ETH price correctly', async () => {
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.prices.ETH.rawPrice).toBe(3000);
      expect(result.current.prices.ETH.formattedPrice).toBe('3000');
    });

    test('calculates CFX price correctly', async () => {
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.prices.CFX.rawPrice).toBe(0.1523);
      expect(result.current.prices.CFX.formattedPrice).toBe('0.1523');
    });

    test('handles different exponents', async () => {
      jest.clearAllMocks();
      
      const customConnection = {
        getLatestPriceFeeds: jest.fn().mockResolvedValue([{
          id: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
          getPriceUnchecked: () => ({
            price: '5000000',
            conf: '1000',
            expo: -4,
            publishTime: Math.floor(Date.now() / 1000),
          }),
        }]),
        getPriceFeedsUpdateData: jest.fn().mockResolvedValue([]),
      };
      
      (EvmPriceServiceConnection as jest.Mock).mockImplementation(() => customConnection);
      
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(customConnection.getLatestPriceFeeds).toHaveBeenCalled();
      }, { timeout: 10000 });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });
      
      expect(result.current.prices.BTC).toBeDefined();
      
      // Check that rawPrice is approximately 500 (handles floating point precision)
      expect(result.current.prices.BTC.rawPrice).toBeGreaterThan(499);
      expect(result.current.prices.BTC.rawPrice).toBeLessThan(501);
      
      // formattedPrice should be the string '500'
      expect(result.current.prices.BTC.formattedPrice).toBe('500');
    });

    test('handles zero price', async () => {
      const zeroFeed = [{
        id: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        getPriceUnchecked: () => ({
          price: '0',
          conf: '0',
          expo: -8,
          publishTime: Math.floor(Date.now() / 1000),
        }),
      }];

      mockGetLatestPriceFeeds.mockResolvedValue(zeroFeed);
      
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.prices.BTC.rawPrice).toBe(0);
      expect(result.current.prices.BTC.formattedPrice).toBe('0');
    });
  });

  describe('Timestamp Handling', () => {
    test('stores publish time', async () => {
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.prices.BTC.publishTime).toBeGreaterThan(0);
    });

    test('logs formatted timestamp', async () => {
      renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('BTC/USD Update:'),
          expect.objectContaining({
            time: expect.any(String),
            timestamp: expect.any(Number),
          })
        );
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles negative price values', async () => {
      const negativeFeed = [{
        id: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        getPriceUnchecked: () => ({
          price: '-100000000',
          conf: '1000000',
          expo: -8,
          publishTime: Math.floor(Date.now() / 1000),
        }),
      }];

      mockGetLatestPriceFeeds.mockResolvedValue(negativeFeed);
      
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.prices.BTC.rawPrice).toBe(-1);
    });

    test('handles very large numbers', async () => {
      const largeFeed = [{
        id: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        getPriceUnchecked: () => ({
          price: '999999999999999',
          conf: '1000000',
          expo: -8,
          publishTime: Math.floor(Date.now() / 1000),
        }),
      }];

      mockGetLatestPriceFeeds.mockResolvedValue(largeFeed);
      
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.prices.BTC.rawPrice).toBeGreaterThan(0);
    });

    test('handles missing getPriceUnchecked method', async () => {
      const brokenFeed = [{
        id: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      }];

      mockGetLatestPriceFeeds.mockResolvedValue(brokenFeed);
      
      const { result } = renderHook(() => usePythPrices());
      
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });
  });
});