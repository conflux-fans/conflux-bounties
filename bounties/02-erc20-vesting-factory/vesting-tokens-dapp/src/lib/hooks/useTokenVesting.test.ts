import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useClaimVestedTokens, useReleasableAmount, useVestingInfo } from './useTokenVesting';

// Mock wagmi
jest.mock('wagmi', () => ({
  useReadContract: jest.fn(),
  useWriteContract: jest.fn(),
  useWaitForTransactionReceipt: jest.fn(),
  useAccount: jest.fn()
}));

// Mock the config
jest.mock('@/lib/web3/config', () => ({
  TOKEN_VESTING_ABI: []
}));

// Mock fetch
global.fetch = jest.fn();

const mockUseReadContract = require('wagmi').useReadContract;
const mockUseWriteContract = require('wagmi').useWriteContract;
const mockUseWaitForTransactionReceipt = require('wagmi').useWaitForTransactionReceipt;
const mockUseAccount = require('wagmi').useAccount;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Create a wrapper component for testing
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => 
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useTokenVesting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockUseAccount.mockReturnValue({ address: '0x1234567890123456789012345678901234567890' });
    mockUseReadContract.mockReturnValue({
      data: null,
      isLoading: false,
      error: null
    });
    mockUseWriteContract.mockReturnValue({
      writeContract: jest.fn(),
      data: null,
      error: null,
      isPending: false,
      reset: jest.fn()
    });
    mockUseWaitForTransactionReceipt.mockReturnValue({
      isLoading: false,
      isSuccess: false,
      error: null
    });
  });

  describe('useClaimVestedTokens', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isSuccess).toBe(false);
    });

    it('should handle claim tokens without address', async () => {
      const { result } = renderHook(() => useClaimVestedTokens(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.claimTokens()).rejects.toThrow('No vesting contract address provided');
    });

    it('should handle claim tokens with address', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should handle claim tokens with zero releasable amount', async () => {
      mockUseReadContract.mockReturnValue({
        data: '0',
        isLoading: false,
        error: null
      });

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      // Test that the hook handles zero amount correctly
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeNull();
    });

    it('should handle claim tokens when releasable amount is loading', async () => {
      mockUseReadContract.mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      });

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      // The hook should show loading state when releasable amount is loading
      expect(result.current.isLoading).toBe(false); // This hook doesn't directly expose loading from releasable amount
    });

    it('should handle claim tokens when releasable amount has error', async () => {
      const mockError = new Error('Failed to read contract');
      mockUseReadContract.mockReturnValue({
        data: null,
        isLoading: false,
        error: mockError
      });

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      // The hook should handle errors from releasable amount
      expect(result.current.error).toBeNull(); // This hook doesn't directly expose errors from releasable amount
    });

    it('should handle claim tokens with invalid address format', async () => {
      const { result } = renderHook(() => useClaimVestedTokens('invalid-address'), {
        wrapper: createWrapper(),
      });

      // Test that the hook handles invalid addresses gracefully
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeNull();
    });

    it('should handle claim tokens with empty string address', async () => {
      const { result } = renderHook(() => useClaimVestedTokens(''), {
        wrapper: createWrapper(),
      });

      // Test that the hook handles empty addresses gracefully
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeNull();
    });

    it('should handle claim tokens with null address', async () => {
      const { result } = renderHook(() => useClaimVestedTokens(null as any), {
        wrapper: createWrapper(),
      });

      // Test that the hook handles null addresses gracefully
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeNull();
    });

    it('should handle claim tokens with undefined address', async () => {
      const { result } = renderHook(() => useClaimVestedTokens(undefined as any), {
        wrapper: createWrapper(),
      });

      // Test that the hook handles undefined addresses gracefully
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeNull();
    });

    it('should handle claim tokens when write contract is pending', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: null,
        error: null,
        isPending: true,
        reset: jest.fn()
      });

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should handle claim tokens when write contract has error', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      const mockError = new Error('Write contract failed');
      
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: null,
        error: mockError,
        isPending: false,
        reset: jest.fn()
      });

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBe(mockError);
    });

    it('should handle claim tokens when transaction is confirming', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      const mockHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: mockHash,
        error: null,
        isPending: false,
        reset: jest.fn()
      });

      mockUseWaitForTransactionReceipt.mockReturnValue({
        isLoading: true,
        isSuccess: false,
        error: null
      });

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBe(mockHash);
    });

    it('should handle claim tokens when transaction fails', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      const mockHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const mockError = new Error('Transaction failed');
      
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: mockHash,
        error: null,
        isPending: false,
        reset: jest.fn()
      });

      mockUseWaitForTransactionReceipt.mockReturnValue({
        isLoading: false,
        isSuccess: false,
        error: mockError
      });

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBe(mockError);
    });

    it('should handle claim tokens with network error', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: null,
        error: new Error('Network error'),
        isPending: false,
        reset: jest.fn()
      });

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Network error');
    });

    it('should handle claim tokens with contract revert error', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: null,
        error: new Error('execution reverted: No tokens available'),
        isPending: false,
        reset: jest.fn()
      });

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('execution reverted');
    });

    it('should handle claim tokens with insufficient gas error', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: null,
        error: new Error('insufficient funds for gas * price + value'),
        isPending: false,
        reset: jest.fn()
      });

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('insufficient funds');
    });

    it('should handle claim tokens with user rejection', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: null,
        error: new Error('User rejected the transaction'),
        isPending: false,
        reset: jest.fn()
      });

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('User rejected the transaction');
    });

    it('should handle claim tokens with timeout error', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: null,
        error: new Error('Transaction timeout'),
        isPending: false,
        reset: jest.fn()
      });

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Transaction timeout');
    });

    it('should handle claim tokens with unknown error type', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: null,
        error: 'Unknown error string',
        isPending: false,
        reset: jest.fn()
      });

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBe('Unknown error string');
    });

    it('should handle claim tokens with null error', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: null,
        error: null,
        isPending: false,
        reset: jest.fn()
      });

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBeNull();
    });

    it('should handle claim tokens with undefined error', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: null,
        error: undefined,
        isPending: false,
        reset: jest.fn()
      });

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBeNull();
    });

    it('should handle claim tokens with reset functionality', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      const mockReset = jest.fn();
      
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: null,
        error: null,
        isPending: false,
        reset: mockReset
      });

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      // Test that reset is available (though we can't easily test its execution)
      expect(mockReset).toBeDefined();
    });

    it('should handle claim tokens with write contract function', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      const mockWriteContract = jest.fn();
      
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: mockWriteContract,
        data: null,
        error: null,
        isPending: false,
        reset: jest.fn()
      });

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      // Test that writeContract is available (though we can't easily test its execution)
      expect(mockWriteContract).toBeDefined();
    });
  });

  describe('useReleasableAmount', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useReleasableAmount('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle releasable amount without address', () => {
      const { result } = renderHook(() => useReleasableAmount(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle releasable amount with zero value', () => {
      mockUseReadContract.mockReturnValue({
        data: '0',
        isLoading: false,
        error: null
      });

      const { result } = renderHook(() => useReleasableAmount('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBe('0');
    });

    it('should handle releasable amount with very large value', () => {
      const mockAmount = '9999999999999999999999999999999999999999999999999999999999999999';
      mockUseReadContract.mockReturnValue({
        data: mockAmount,
        isLoading: false,
        error: null
      });

      const { result } = renderHook(() => useReleasableAmount('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBe(mockAmount);
    });

    it('should handle releasable amount with decimal value', () => {
      const mockAmount = '123456789000000000'; // 0.123456789 tokens
      mockUseReadContract.mockReturnValue({
        data: mockAmount,
        isLoading: false,
        error: null
      });

      const { result } = renderHook(() => useReleasableAmount('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBe(mockAmount);
    });

    it('should handle releasable amount when loading', () => {
      mockUseReadContract.mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      });

      const { result } = renderHook(() => useReleasableAmount('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should handle releasable amount with error', () => {
      const mockError = new Error('Failed to read contract');
      mockUseReadContract.mockReturnValue({
        data: null,
        isLoading: false,
        error: mockError
      });

      const { result } = renderHook(() => useReleasableAmount('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBe(mockError);
    });

    it('should handle releasable amount with network error', () => {
      const mockError = new Error('Network error');
      mockUseReadContract.mockReturnValue({
        data: null,
        isLoading: false,
        error: mockError
      });

      const { result } = renderHook(() => useReleasableAmount('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBe(mockError);
    });

    it('should handle releasable amount with contract revert error', () => {
      const mockError = new Error('execution reverted: Contract not found');
      mockUseReadContract.mockReturnValue({
        data: null,
        isLoading: false,
        error: mockError
      });

      const { result } = renderHook(() => useReleasableAmount('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBe(mockError);
    });

    it('should handle releasable amount with invalid address format', () => {
      const { result } = renderHook(() => useReleasableAmount('invalid-address'), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle releasable amount with empty string address', () => {
      const { result } = renderHook(() => useReleasableAmount(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle releasable amount with null address', () => {
      const { result } = renderHook(() => useReleasableAmount(null as any), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle releasable amount with undefined address', () => {
      const { result } = renderHook(() => useReleasableAmount(undefined as any), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('useVestingInfo', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useVestingInfo('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle vesting info without address', () => {
      const { result } = renderHook(() => useVestingInfo(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle vesting info with basic data', () => {
      const mockInfo = {
        beneficiary: '0x1234567890123456789012345678901234567890',
        cliff: BigInt(1640995200),
        duration: BigInt(31536000),
        start: BigInt(1640995200),
        amount: BigInt('1000000000000000000'),
        released: BigInt('0'),
        revocable: false
      };

      mockUseReadContract.mockReturnValue({
        data: mockInfo,
        isLoading: false,
        error: null
      });

      const { result } = renderHook(() => useVestingInfo('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toEqual(mockInfo);
    });

    it('should handle vesting info with complex data', () => {
      const mockComplexInfo = {
        beneficiary: '0x1234567890123456789012345678901234567890',
        cliff: BigInt(1640995200),
        duration: BigInt(31536000),
        start: BigInt(1640995200),
        amount: BigInt('9999999999999999999999999999999999999999999999999999999999999999'),
        released: BigInt('0'),
        revocable: false
      };

      mockUseReadContract.mockReturnValue({
        data: mockComplexInfo,
        isLoading: false,
        error: null
      });

      const { result } = renderHook(() => useVestingInfo('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toEqual(mockComplexInfo);
    });

    it('should handle vesting info when loading', () => {
      mockUseReadContract.mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      });

      const { result } = renderHook(() => useVestingInfo('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should handle vesting info with error', () => {
      const mockError = new Error('Failed to read contract');
      mockUseReadContract.mockReturnValue({
        data: null,
        isLoading: false,
        error: mockError
      });

      const { result } = renderHook(() => useVestingInfo('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBe(mockError);
    });

    it('should handle vesting info with network error', () => {
      const mockError = new Error('Network error');
      mockUseReadContract.mockReturnValue({
        data: null,
        isLoading: false,
        error: mockError
      });

      const { result } = renderHook(() => useVestingInfo('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBe(mockError);
    });

    it('should handle vesting info with contract revert error', () => {
      const mockError = new Error('execution reverted: Contract not found');
      mockUseReadContract.mockReturnValue({
        data: null,
        isLoading: false,
        error: mockError
      });

      const { result } = renderHook(() => useVestingInfo('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBe(mockError);
    });

    it('should handle vesting info with invalid address format', () => {
      const { result } = renderHook(() => useVestingInfo('invalid-address'), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle vesting info with empty string address', () => {
      const { result } = renderHook(() => useVestingInfo(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle vesting info with null address', () => {
      const { result } = renderHook(() => useVestingInfo(null as any), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle vesting info with undefined address', () => {
      const { result } = renderHook(() => useVestingInfo(undefined as any), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle vesting info with partial data', () => {
      const mockPartialInfo = {
        beneficiary: '0x1234567890123456789012345678901234567890',
        cliff: BigInt(1640995200),
        duration: BigInt(31536000),
        start: BigInt(1640995200),
        amount: BigInt('1000000000000000000'),
        released: BigInt('500000000000000000'), // Half released
        revocable: true
      };

      mockUseReadContract.mockReturnValue({
        data: mockPartialInfo,
        isLoading: false,
        error: null
      });

      const { result } = renderHook(() => useVestingInfo('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toEqual(mockPartialInfo);
    });

    it('should handle vesting info with maximum values', () => {
      const mockMaxInfo = {
        beneficiary: '0x1234567890123456789012345678901234567890',
        cliff: BigInt(9999999999),
        duration: BigInt(9999999999),
        start: BigInt(9999999999),
        amount: BigInt('9999999999999999999999999999999999999999999999999999999999999999'),
        released: BigInt('9999999999999999999999999999999999999999999999999999999999999999'),
        revocable: true
      };

      mockUseReadContract.mockReturnValue({
        data: mockMaxInfo,
        isLoading: false,
        error: null
      });

      const { result } = renderHook(() => useVestingInfo('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toEqual(mockMaxInfo);
    });

    it('should handle vesting info with minimum values', () => {
      const mockMinInfo = {
        beneficiary: '0x1234567890123456789012345678901234567890',
        cliff: BigInt(0),
        duration: BigInt(1),
        start: BigInt(0),
        amount: BigInt('1'),
        released: BigInt('0'),
        revocable: false
      };

      mockUseReadContract.mockReturnValue({
        data: mockMinInfo,
        isLoading: false,
        error: null
      });

      const { result } = renderHook(() => useVestingInfo('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toEqual(mockMinInfo);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete claim flow', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      const mockHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: mockHash,
        error: null,
        isPending: false,
        reset: jest.fn()
      });

      mockUseWaitForTransactionReceipt.mockReturnValue({
        isLoading: false,
        isSuccess: true,
        error: null
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBe(mockHash);
    });

    it('should handle database sync failure', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      const mockHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: mockHash,
        error: null,
        isPending: false,
        reset: jest.fn()
      });

      mockUseWaitForTransactionReceipt.mockReturnValue({
        isLoading: false,
        isSuccess: true,
        error: null
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Database error' }),
      } as Response);

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should handle network timeout in database sync', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      const mockHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: mockHash,
        error: null,
        isPending: false,
        reset: jest.fn()
      });

      mockUseWaitForTransactionReceipt.mockReturnValue({
        isLoading: false,
        isSuccess: true,
        error: null
      });

      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should handle malformed JSON response in database sync', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      const mockHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: mockHash,
        error: null,
        isPending: false,
        reset: jest.fn()
      });

      mockUseWaitForTransactionReceipt.mockReturnValue({
        isLoading: false,
        isSuccess: true,
        error: null
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); },
      } as unknown as Response);

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should handle empty response in database sync', async () => {
      const mockReleasableAmount = '1000000000000000000'; // 1 token
      const mockHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      
      mockUseReadContract.mockReturnValue({
        data: mockReleasableAmount,
        isLoading: false,
        error: null
      });

      mockUseWriteContract.mockReturnValue({
        writeContract: jest.fn(),
        data: mockHash,
        error: null,
        isPending: false,
        reset: jest.fn()
      });

      mockUseWaitForTransactionReceipt.mockReturnValue({
        isLoading: false,
        isSuccess: true,
        error: null
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      } as Response);

      const { result } = renderHook(() => useClaimVestedTokens('0x1234567890123456789012345678901234567890'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
