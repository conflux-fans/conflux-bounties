import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

import { renderHook, act, waitFor } from '@testing-library/react';

// Mutable test-controlled state for mocks
let mockAddress: string | undefined;
let mockPrices: Record<string, { formattedPrice: string }>;
let mockFeeds: Record<string, string>;
let readContractMock: jest.Mock<any, any>;
let mockPublicClient: { readContract: jest.Mock };

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: jest.fn(() => ({ address: mockAddress })),
  usePublicClient: jest.fn(() => mockPublicClient),
}));

// Mock contract constants
jest.mock('../lib/contractABI', () => ({
  LENDING_CONTRACT_ADDRESS: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  LENDING_ABI: [],
}));

// Mock Pyth prices hook
jest.mock('../hooks/usePythPrices', () => ({
  usePythPrices: jest.fn(() => ({
    prices: mockPrices,
    PRICE_FEEDS: mockFeeds,
  })),
}));

// Import the hook
import { useLiquidations } from '../hooks/useLiquidations';

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();

  mockAddress = '0xAabbccDdEeFf0011223344556677889900aAbBcC';
  mockPrices = {};
  mockFeeds = {};
  readContractMock = jest.fn();
  mockPublicClient = { readContract: readContractMock };
});

afterEach(() => {
  jest.clearAllMocks();
});

test('early return when requirements missing (no address/prices/client)', async () => {
  mockAddress = undefined;
  mockPrices = {};

  const { result } = renderHook(() => useLiquidations());

  await act(async () => {
    await result.current.fetchPositions();
  });

  expect(result.current.loading).toBe(false);
  expect(result.current.positions).toEqual([]);
  expect(result.current.liquidatablePositions).toEqual([]);
});

test('no active positions path sets empty arrays and loading false', async () => {
  mockPrices = { ETH: { formattedPrice: '2000' } };
  mockFeeds = { ETH: '0xeth' };

  readContractMock.mockResolvedValue([]);

  const { result } = renderHook(() => useLiquidations());

  await act(async () => {
    await result.current.fetchPositions();
  });

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.positions).toEqual([]);
  expect(result.current.liquidatablePositions).toEqual([]);
});

test('loads positions, filters to user, computes values, and flags liquidatable', async () => {
  mockFeeds = { ETH: '0xeth', USDC: '0xusdc' };
  mockPrices = {
    ETH: { formattedPrice: '2000' },
    USDC: { formattedPrice: '1' },
  };

  readContractMock.mockImplementation((args: any) => {
    if (args.functionName === 'getAllActivePositions') {
      return Promise.resolve([1n, 2n]);
    }
    if (args.functionName === 'positions') {
      const id = args.args?.[0];
      if (id === 1n) {
        return Promise.resolve([
          mockAddress,
          '0xeth',
          '0xusdc',
          2000000000000000000n,
          1000000000000000000n,
          1234n,
          true,
        ]);
      }
      if (id === 2n) {
        return Promise.resolve([
          '0x9999999999999999999999999999999999999999',
          '0xeth',
          '0xusdc',
          1000000000000000000n,
          500000000000000000n,
          2345n,
          true,
        ]);
      }
    }
    if (args.functionName === 'getHealthRatio') {
      const id = args.args?.[0];
      if (id === 1n) return Promise.resolve(14000n);
      if (id === 2n) return Promise.resolve(20000n);
    }
    return Promise.reject(new Error('unexpected call'));
  });

  const { result } = renderHook(() => useLiquidations());

  await act(async () => {
    await result.current.fetchPositions();
  });

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.positions).toHaveLength(1);
  expect(result.current.positions[0].id).toBe(1);
  expect(result.current.positions[0].healthRatio).toBe(140);
  expect(result.current.liquidatablePositions.map(p => p.id)).toEqual([1]);
});

test('skips positions with zero-address borrower or inactive', async () => {
  mockFeeds = { ETH: '0xeth', USDC: '0xusdc' };
  mockPrices = {
    ETH: { formattedPrice: '2000' },
    USDC: { formattedPrice: '1' },
  };

  const ZERO = '0x0000000000000000000000000000000000000000';

  readContractMock.mockImplementation((args: any) => {
    if (args.functionName === 'getAllActivePositions') {
      return Promise.resolve([3n]);
    }
    if (args.functionName === 'positions') {
      return Promise.resolve([
        ZERO,
        '0xeth',
        '0xusdc',
        1000000000000000000n,
        1000000000000000000n,
        999n,
        true,
      ]);
    }
    if (args.functionName === 'getHealthRatio') {
      return Promise.resolve(10000n);
    }
    return Promise.reject(new Error('unexpected call'));
  });

  const { result } = renderHook(() => useLiquidations());

  await act(async () => {
    await result.current.fetchPositions();
  });

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.positions).toEqual([]);
  expect(result.current.liquidatablePositions).toEqual([]);
});

test('continues on per-position read error and logs it', async () => {
  mockFeeds = { ETH: '0xeth' };
  mockPrices = { ETH: { formattedPrice: '2000' } };

  readContractMock.mockImplementation((args: any) => {
    if (args.functionName === 'getAllActivePositions') {
      return Promise.resolve([1n]);
    }
    if (args.functionName === 'positions') {
      return Promise.reject(new Error('boom'));
    }
    return Promise.reject(new Error('unexpected call'));
  });

  const { result } = renderHook(() => useLiquidations());

  await act(async () => {
    await result.current.fetchPositions();
  });

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.positions).toEqual([]);
  expect(result.current.liquidatablePositions).toEqual([]);
});

test('top-level error path logs and resets loading', async () => {
  readContractMock.mockImplementation((args: any) => {
    if (args.functionName === 'getAllActivePositions') {
      return Promise.reject(new Error('rpc down'));
    }
    return Promise.reject(new Error('unexpected call'));
  });

  const { result } = renderHook(() => useLiquidations());

  await act(async () => {
    await result.current.fetchPositions();
  });

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.positions).toEqual([]);
  expect(result.current.liquidatablePositions).toEqual([]);
});

test('handles multiple positions correctly', async () => {
  mockFeeds = { ETH: '0xeth', BTC: '0xbtc' };
  mockPrices = {
    ETH: { formattedPrice: '2000' },
    BTC: { formattedPrice: '50000' },
  };

  readContractMock.mockImplementation((args: any) => {
    if (args.functionName === 'getAllActivePositions') {
      return Promise.resolve([1n, 2n, 3n]);
    }
    if (args.functionName === 'positions') {
      const id = args.args?.[0];
      if (id === 1n) {
        return Promise.resolve([
          mockAddress,
          '0xeth',
          '0xbtc',
          1000000000000000000n,
          1000000000000000000n,
          100n,
          true,
        ]);
      }
      if (id === 2n) {
        return Promise.resolve([
          mockAddress,
          '0xbtc',
          '0xeth',
          2000000000000000000n,
          500000000000000000n,
          200n,
          true,
        ]);
      }
      if (id === 3n) {
        return Promise.resolve([
          mockAddress,
          '0xeth',
          '0xbtc',
          3000000000000000000n,
          100000000000000000n,
          300n,
          true,
        ]);
      }
    }
    if (args.functionName === 'getHealthRatio') {
      const id = args.args?.[0];
      if (id === 1n) return Promise.resolve(13000n);
      if (id === 2n) return Promise.resolve(18000n);
      if (id === 3n) return Promise.resolve(25000n);
    }
    return Promise.reject(new Error('unexpected call'));
  });

  const { result } = renderHook(() => useLiquidations());

  await act(async () => {
    await result.current.fetchPositions();
  });

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.positions).toHaveLength(3);
  expect(result.current.liquidatablePositions).toHaveLength(1);
  expect(result.current.liquidatablePositions[0].id).toBe(1);
});

test('calculates collateral and borrow values correctly', async () => {
  mockFeeds = { ETH: '0xeth', USDC: '0xusdc' };
  mockPrices = {
    ETH: { formattedPrice: '3000' },
    USDC: { formattedPrice: '1' },
  };

  readContractMock.mockImplementation((args: any) => {
    if (args.functionName === 'getAllActivePositions') {
      return Promise.resolve([1n]);
    }
    if (args.functionName === 'positions') {
      return Promise.resolve([
        mockAddress,
        '0xeth',
        '0xusdc',
        5000000000000000000n,
        2000000000000000000n,
        100n,
        true,
      ]);
    }
    if (args.functionName === 'getHealthRatio') {
      return Promise.resolve(15000n);
    }
    return Promise.reject(new Error('unexpected call'));
  });

  const { result } = renderHook(() => useLiquidations());

  await act(async () => {
    await result.current.fetchPositions();
  });

  await waitFor(() => expect(result.current.loading).toBe(false));

  const position = result.current.positions[0];
  expect(position.collateral).toBe('5.0000');
  expect(position.borrowed).toBe('2.0000');
  expect(parseFloat(position.collateralValue)).toBeGreaterThan(10000);
  expect(parseFloat(position.borrowValue)).toBeGreaterThan(1);
});

test('handles missing price feeds gracefully', async () => {
  mockFeeds = {};
  mockPrices = {};

  readContractMock.mockImplementation((args: any) => {
    if (args.functionName === 'getAllActivePositions') {
      return Promise.resolve([1n]);
    }
    if (args.functionName === 'positions') {
      return Promise.resolve([
        mockAddress,
        '0xeth',
        '0xusdc',
        1000000000000000000n,
        1000000000000000000n,
        100n,
        true,
      ]);
    }
    if (args.functionName === 'getHealthRatio') {
      return Promise.resolve(15000n);
    }
    return Promise.reject(new Error('unexpected call'));
  });

  const { result } = renderHook(() => useLiquidations());

  await act(async () => {
    await result.current.fetchPositions();
  });

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.positions).toEqual([]);
  expect(result.current.liquidatablePositions).toEqual([]);
  expect(result.current.loading).toBe(false);
});