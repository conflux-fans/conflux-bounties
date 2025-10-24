import { renderHook } from '@testing-library/react';

jest.mock('wagmi', () => ({
  useReadContract: jest.fn(),
  useAccount: jest.fn(),
}));

import { useContracts } from '../hooks/useContracts';
import { useReadContract, useAccount } from 'wagmi';

describe('useContracts Custom Hook', () => {
  const mockAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
  const mockBtcPrice = BigInt(5000000000000);
  const mockUserBet = BigInt(1000000000000000000);
  const mockPosition = {
    collateral: BigInt(2000000000000000000),
    debt: BigInt(1000000000000000000),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useAccount as jest.Mock).mockReturnValue({
      address: undefined,
    });

    (useReadContract as jest.Mock).mockReturnValue({
      data: undefined,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Hook Initialization', () => {
    test('returns correct structure', () => {
      const { result } = renderHook(() => useContracts());
      
      expect(result.current).toHaveProperty('btcPrice');
      expect(result.current).toHaveProperty('userBet');
      expect(result.current).toHaveProperty('position');
    });

    test('returns undefined values when not connected', () => {
      const { result } = renderHook(() => useContracts());
      
      expect(result.current.btcPrice).toBeUndefined();
      expect(result.current.userBet).toBeUndefined();
      expect(result.current.position).toBeUndefined();
    });

    test('calls useAccount hook', () => {
      renderHook(() => useContracts());
      
      expect(useAccount).toHaveBeenCalled();
    });

    test('calls useReadContract three times', () => {
      renderHook(() => useContracts());
      
      expect(useReadContract).toHaveBeenCalledTimes(3);
    });
  });

  describe('BTC Price Contract', () => {
    test('configures BTC price contract correctly', () => {
      renderHook(() => useContracts());
      
      const firstCall = (useReadContract as jest.Mock).mock.calls[0][0];
      
      expect(firstCall.address).toBe('0x540182717b8A2D723f9Fc0218558a7De224e8b17');
      expect(firstCall.functionName).toBe('getLatestPrice');
    });

    test('uses correct ABI for BTC price', () => {
      renderHook(() => useContracts());
      
      const firstCall = (useReadContract as jest.Mock).mock.calls[0][0];
      
      expect(firstCall.abi).toEqual([
        {
          inputs: [{ name: 'priceId', type: 'bytes32' }],
          name: 'getLatestPrice',
          outputs: [{ name: '', type: 'int64' }],
          stateMutability: 'view',
          type: 'function',
        },
      ]);
    });

    test('passes BTC price feed ID as argument', () => {
      renderHook(() => useContracts());
      
      const firstCall = (useReadContract as jest.Mock).mock.calls[0][0];
      
      expect(firstCall.args).toEqual([
        '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      ]);
    });

    test('sets query options correctly', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
      });

      renderHook(() => useContracts());
      
      const firstCall = (useReadContract as jest.Mock).mock.calls[0][0];
      
      expect(firstCall.query.enabled).toBe(true);
      expect(firstCall.query.refetchInterval).toBe(5000);
    });

    test('disables query when address is not available', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: undefined,
      });

      renderHook(() => useContracts());
      
      const firstCall = (useReadContract as jest.Mock).mock.calls[0][0];
      
      expect(firstCall.query.enabled).toBe(false);
    });

    test('returns BTC price data', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
      });

      (useReadContract as jest.Mock).mockReturnValueOnce({
        data: mockBtcPrice,
      });

      const { result } = renderHook(() => useContracts());
      
      expect(result.current.btcPrice).toBe(mockBtcPrice);
    });
  });

  describe('User Bet Contract', () => {
    test('configures betting contract correctly', () => {
      renderHook(() => useContracts());
      
      const secondCall = (useReadContract as jest.Mock).mock.calls[1][0];
      
      expect(secondCall.address).toBe('0x6a5D4C136B20C3946f38B2b76eddd56452eA4156');
      expect(secondCall.functionName).toBe('getUserBet');
    });

    test('uses correct ABI for user bet', () => {
      renderHook(() => useContracts());
      
      const secondCall = (useReadContract as jest.Mock).mock.calls[1][0];
      
      expect(secondCall.abi).toEqual([
        {
          inputs: [{ name: 'user', type: 'address' }],
          name: 'getUserBet',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
      ]);
    });

    test('passes user address as argument when connected', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
      });

      renderHook(() => useContracts());
      
      const secondCall = (useReadContract as jest.Mock).mock.calls[1][0];
      
      expect(secondCall.args).toEqual([mockAddress]);
    });

    test('passes undefined args when not connected', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: undefined,
      });

      renderHook(() => useContracts());
      
      const secondCall = (useReadContract as jest.Mock).mock.calls[1][0];
      
      expect(secondCall.args).toBeUndefined();
    });

    test('sets query options correctly', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
      });

      renderHook(() => useContracts());
      
      const secondCall = (useReadContract as jest.Mock).mock.calls[1][0];
      
      expect(secondCall.query.enabled).toBe(true);
      expect(secondCall.query.refetchInterval).toBe(5000);
    });

    test('returns user bet data', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
      });

      (useReadContract as jest.Mock)
        .mockReturnValueOnce({ data: undefined })
        .mockReturnValueOnce({ data: mockUserBet });

      const { result } = renderHook(() => useContracts());
      
      expect(result.current.userBet).toBe(mockUserBet);
    });
  });

  describe('Position Contract', () => {
    test('configures lending contract correctly', () => {
      renderHook(() => useContracts());
      
      const thirdCall = (useReadContract as jest.Mock).mock.calls[2][0];
      
      expect(thirdCall.address).toBe('0x0FC5A8c24b13E4178911a739866A0E7c27d90345');
      expect(thirdCall.functionName).toBe('getPosition');
    });

    test('uses correct ABI for position', () => {
      renderHook(() => useContracts());
      
      const thirdCall = (useReadContract as jest.Mock).mock.calls[2][0];
      
      expect(thirdCall.abi).toEqual([
        {
          inputs: [{ name: 'user', type: 'address' }],
          name: 'getPosition',
          outputs: [
            { name: 'collateral', type: 'uint256' },
            { name: 'debt', type: 'uint256' },
          ],
          stateMutability: 'view',
          type: 'function',
        },
      ]);
    });

    test('passes user address as argument when connected', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
      });

      renderHook(() => useContracts());
      
      const thirdCall = (useReadContract as jest.Mock).mock.calls[2][0];
      
      expect(thirdCall.args).toEqual([mockAddress]);
    });

    test('passes undefined args when not connected', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: undefined,
      });

      renderHook(() => useContracts());
      
      const thirdCall = (useReadContract as jest.Mock).mock.calls[2][0];
      
      expect(thirdCall.args).toBeUndefined();
    });

    test('sets query options correctly', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
      });

      renderHook(() => useContracts());
      
      const thirdCall = (useReadContract as jest.Mock).mock.calls[2][0];
      
      expect(thirdCall.query.enabled).toBe(true);
      expect(thirdCall.query.refetchInterval).toBe(5000);
    });

    test('returns position data', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
      });

      (useReadContract as jest.Mock)
        .mockReturnValueOnce({ data: undefined })
        .mockReturnValueOnce({ data: undefined })
        .mockReturnValueOnce({ data: mockPosition });

      const { result } = renderHook(() => useContracts());
      
      expect(result.current.position).toEqual(mockPosition);
    });
  });

  describe('Connected State', () => {
    test('returns all data when connected', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
      });

      (useReadContract as jest.Mock)
        .mockReturnValueOnce({ data: mockBtcPrice })
        .mockReturnValueOnce({ data: mockUserBet })
        .mockReturnValueOnce({ data: mockPosition });

      const { result } = renderHook(() => useContracts());
      
      expect(result.current.btcPrice).toBe(mockBtcPrice);
      expect(result.current.userBet).toBe(mockUserBet);
      expect(result.current.position).toEqual(mockPosition);
    });

    test('enables all queries when address is present', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
      });

      renderHook(() => useContracts());
      
      const calls = (useReadContract as jest.Mock).mock.calls;
      
      calls.forEach(call => {
        expect(call[0].query.enabled).toBe(true);
      });
    });

    test('sets refetch interval for all contracts', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
      });

      renderHook(() => useContracts());
      
      const calls = (useReadContract as jest.Mock).mock.calls;
      
      calls.forEach(call => {
        expect(call[0].query.refetchInterval).toBe(5000);
      });
    });
  });

  describe('Disconnected State', () => {
    test('disables all queries when address is missing', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: undefined,
      });

      renderHook(() => useContracts());
      
      const calls = (useReadContract as jest.Mock).mock.calls;
      
      calls.forEach(call => {
        expect(call[0].query.enabled).toBe(false);
      });
    });

    test('passes undefined args for user-specific queries', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: undefined,
      });

      renderHook(() => useContracts());
      
      const secondCall = (useReadContract as jest.Mock).mock.calls[1][0];
      const thirdCall = (useReadContract as jest.Mock).mock.calls[2][0];
      
      expect(secondCall.args).toBeUndefined();
      expect(thirdCall.args).toBeUndefined();
    });

    test('still passes args for BTC price even without address', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: undefined,
      });

      renderHook(() => useContracts());
      
      const firstCall = (useReadContract as jest.Mock).mock.calls[0][0];
      
      expect(firstCall.args).toEqual([
        '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      ]);
    });
  });

  describe('Contract Addresses', () => {
    test('uses correct price consumer address', () => {
      renderHook(() => useContracts());
      
      const firstCall = (useReadContract as jest.Mock).mock.calls[0][0];
      
      expect(firstCall.address).toBe('0x540182717b8A2D723f9Fc0218558a7De224e8b17');
    });

    test('uses correct betting address', () => {
      renderHook(() => useContracts());
      
      const secondCall = (useReadContract as jest.Mock).mock.calls[1][0];
      
      expect(secondCall.address).toBe('0x6a5D4C136B20C3946f38B2b76eddd56452eA4156');
    });

    test('uses correct lending address', () => {
      renderHook(() => useContracts());
      
      const thirdCall = (useReadContract as jest.Mock).mock.calls[2][0];
      
      expect(thirdCall.address).toBe('0x0FC5A8c24b13E4178911a739866A0E7c27d90345');
    });

    test('formats addresses as hex strings', () => {
      renderHook(() => useContracts());
      
      const calls = (useReadContract as jest.Mock).mock.calls;
      
      calls.forEach(call => {
        expect(call[0].address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
    });
  });

  describe('Hook Re-rendering', () => {
    test('updates when address changes', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: undefined,
      });

      const { rerender } = renderHook(() => useContracts());
      
      let secondCall = (useReadContract as jest.Mock).mock.calls[1][0];
      expect(secondCall.args).toBeUndefined();
      
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
      });

      rerender();
      
      secondCall = (useReadContract as jest.Mock).mock.calls[4][0];
      expect(secondCall.args).toEqual([mockAddress]);
    });

    test('maintains stable contract configuration', () => {
      const { rerender } = renderHook(() => useContracts());
      
      const firstRenderCalls = (useReadContract as jest.Mock).mock.calls.slice(0, 3);
      
      rerender();
      
      const secondRenderCalls = (useReadContract as jest.Mock).mock.calls.slice(3, 6);
      
      firstRenderCalls.forEach((call, index) => {
        expect(call[0].address).toBe(secondRenderCalls[index][0].address);
        expect(call[0].functionName).toBe(secondRenderCalls[index][0].functionName);
      });
    });
  });

  describe('Data Types', () => {
    test('BTC price is BigInt type', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
      });

      (useReadContract as jest.Mock).mockReturnValueOnce({
        data: BigInt(5000000000000),
      });

      const { result } = renderHook(() => useContracts());
      
      expect(typeof result.current.btcPrice).toBe('bigint');
    });

    test('user bet is BigInt type', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
      });

      (useReadContract as jest.Mock)
        .mockReturnValueOnce({ data: undefined })
        .mockReturnValueOnce({ data: BigInt(1000000000000000000) });

      const { result } = renderHook(() => useContracts());
      
      expect(typeof result.current.userBet).toBe('bigint');
    });

    test('position has correct structure', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
      });

      const positionData = {
        collateral: BigInt(2000000000000000000),
        debt: BigInt(1000000000000000000),
      };

      (useReadContract as jest.Mock)
        .mockReturnValueOnce({ data: undefined })
        .mockReturnValueOnce({ data: undefined })
        .mockReturnValueOnce({ data: positionData });

      const { result } = renderHook(() => useContracts());
      
      expect(result.current.position).toHaveProperty('collateral');
      expect(result.current.position).toHaveProperty('debt');
      expect(typeof result.current.position?.collateral).toBe('bigint');
      expect(typeof result.current.position?.debt).toBe('bigint');
    });
  });

  describe('Edge Cases', () => {
    test('handles null address', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: null,
      });

      renderHook(() => useContracts());
      
      const calls = (useReadContract as jest.Mock).mock.calls;
      
      calls.forEach(call => {
        expect(call[0].query.enabled).toBe(false);
      });
    });

    test('handles empty string address', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: '',
      });

      renderHook(() => useContracts());
      
      const calls = (useReadContract as jest.Mock).mock.calls;
      
      calls.forEach(call => {
        expect(call[0].query.enabled).toBe(false);
      });
    });

    test('handles zero values gracefully', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
      });

      (useReadContract as jest.Mock)
        .mockReturnValueOnce({ data: BigInt(0) })
        .mockReturnValueOnce({ data: BigInt(0) })
        .mockReturnValueOnce({ data: { collateral: BigInt(0), debt: BigInt(0) } });

      const { result } = renderHook(() => useContracts());
      
      expect(result.current.btcPrice).toBe(BigInt(0));
      expect(result.current.userBet).toBe(BigInt(0));
      expect(result.current.position?.collateral).toBe(BigInt(0));
      expect(result.current.position?.debt).toBe(BigInt(0));
    });

    test('handles undefined data gracefully', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
      });

      (useReadContract as jest.Mock)
        .mockReturnValueOnce({ data: undefined })
        .mockReturnValueOnce({ data: undefined })
        .mockReturnValueOnce({ data: undefined });

      const { result } = renderHook(() => useContracts());
      
      expect(result.current.btcPrice).toBeUndefined();
      expect(result.current.userBet).toBeUndefined();
      expect(result.current.position).toBeUndefined();
    });
  });

  describe('Query Configuration', () => {
    test('all contracts use 5 second refetch interval', () => {
      renderHook(() => useContracts());
      
      const calls = (useReadContract as jest.Mock).mock.calls;
      
      calls.forEach(call => {
        expect(call[0].query.refetchInterval).toBe(5000);
      });
    });

    test('query enabled state depends on address', () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
      });

      renderHook(() => useContracts());
      
      const calls = (useReadContract as jest.Mock).mock.calls;
      
      calls.forEach(call => {
        expect(call[0].query.enabled).toBe(true);
      });
    });

    test('all contracts are view functions', () => {
      renderHook(() => useContracts());
      
      const calls = (useReadContract as jest.Mock).mock.calls;
      
      calls.forEach(call => {
        const abi = call[0].abi;
        expect(abi[0].stateMutability).toBe('view');
      });
    });
  });

  describe('ABI Validation', () => {
    test('all ABIs have correct structure', () => {
      renderHook(() => useContracts());
      
      const calls = (useReadContract as jest.Mock).mock.calls;
      
      calls.forEach(call => {
        const abi = call[0].abi[0];
        expect(abi).toHaveProperty('inputs');
        expect(abi).toHaveProperty('name');
        expect(abi).toHaveProperty('outputs');
        expect(abi).toHaveProperty('stateMutability');
        expect(abi).toHaveProperty('type');
        expect(abi.type).toBe('function');
      });
    });

    test('BTC price ABI expects bytes32 input', () => {
      renderHook(() => useContracts());
      
      const firstCall = (useReadContract as jest.Mock).mock.calls[0][0];
      const abi = firstCall.abi[0];
      
      expect(abi.inputs[0].type).toBe('bytes32');
    });

    test('user bet ABI expects address input', () => {
      renderHook(() => useContracts());
      
      const secondCall = (useReadContract as jest.Mock).mock.calls[1][0];
      const abi = secondCall.abi[0];
      
      expect(abi.inputs[0].type).toBe('address');
    });

    test('position ABI expects address input and multiple outputs', () => {
      renderHook(() => useContracts());
      
      const thirdCall = (useReadContract as jest.Mock).mock.calls[2][0];
      const abi = thirdCall.abi[0];
      
      expect(abi.inputs[0].type).toBe('address');
      expect(abi.outputs).toHaveLength(2);
      expect(abi.outputs[0].name).toBe('collateral');
      expect(abi.outputs[1].name).toBe('debt');
    });
  });
});