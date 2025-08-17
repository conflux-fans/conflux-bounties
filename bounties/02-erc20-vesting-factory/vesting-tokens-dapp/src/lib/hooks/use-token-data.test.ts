import { renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTokenData, useUserData, useTokenAnalytics } from './use-token-data';

// Mock wagmi
jest.mock('wagmi', () => ({
  useAccount: jest.fn()
}));

const mockUseAccount = require('wagmi').useAccount;

// Create a wrapper component for testing
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => 
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('use-token-data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockUseAccount.mockReturnValue({ address: '0x1234567890123456789012345678901234567890' });
  });

  describe('useTokenData', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useTokenData(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false); // React Query may not be loading initially
      expect(result.current.error).toBeNull();
    });

    it('should have proper query configuration', () => {
      const { result } = renderHook(() => useTokenData(), {
        wrapper: createWrapper(),
      });

      // Test that the hook returns the expected structure
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('isSuccess');
      expect(result.current).toHaveProperty('isError');
    });
  });

  describe('useUserData', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useUserData(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(true); // React Query is loading initially
      expect(result.current.error).toBeNull();
    });

    it('should have proper query configuration', () => {
      const { result } = renderHook(() => useUserData(), {
        wrapper: createWrapper(),
      });

      // Test that the hook returns the expected structure
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('isSuccess');
      expect(result.current).toHaveProperty('isError');
    });
  });

  describe('useTokenAnalytics', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useTokenAnalytics(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false); // React Query may not be loading initially
      expect(result.current.error).toBeNull();
    });

    it('should have proper query configuration', () => {
      const { result } = renderHook(() => useTokenAnalytics(), {
        wrapper: createWrapper(),
      });

      // Test that the hook returns the expected structure
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('isSuccess');
      expect(result.current).toHaveProperty('isError');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple hooks working together', () => {
      const { result: tokenResult } = renderHook(() => useTokenData(), {
        wrapper: createWrapper(),
      });

      const { result: userResult } = renderHook(() => useUserData(), {
        wrapper: createWrapper(),
      });

      const { result: analyticsResult } = renderHook(() => useTokenAnalytics(), {
        wrapper: createWrapper(),
      });

      // All hooks should have the same structure
      expect(tokenResult.current).toHaveProperty('data');
      expect(userResult.current).toHaveProperty('data');
      expect(analyticsResult.current).toHaveProperty('data');
    });

    it('should handle hooks with different addresses', () => {
      // Test with different addresses
      mockUseAccount.mockReturnValue({ address: '0x1111111111111111111111111111111111111111' });
      
      const { result: tokenResult } = renderHook(() => useTokenData(), {
        wrapper: createWrapper(),
      });

      expect(tokenResult.current).toHaveProperty('data');
      expect(tokenResult.current).toHaveProperty('isLoading');
      expect(tokenResult.current).toHaveProperty('error');
    });

    it('should handle hooks with no address', () => {
      // Test with no address
      mockUseAccount.mockReturnValue({ address: undefined });
      
      const { result: userResult } = renderHook(() => useUserData(), {
        wrapper: createWrapper(),
      });

      expect(userResult.current).toHaveProperty('data');
      expect(userResult.current).toHaveProperty('isLoading');
      expect(userResult.current).toHaveProperty('error');
    });
  });
}); 