import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUserAuth } from './useUserAuth';

// Mock wagmi
jest.mock('wagmi', () => ({
  useAccount: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

import { useAccount } from 'wagmi';

const mockUseAccount = jest.mocked(useAccount);

// Helper function to create properly typed mocks
const createMockUseAccount = (overrides: { isConnected?: boolean; address?: string; status?: string }) => 
  ({ isConnected: false, address: undefined, status: 'disconnected', ...overrides } as any);
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
  
  const Wrapper = ({ children }: { children: React.ReactNode }) => 
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
};

describe('useUserAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User authentication', () => {
    it('should fetch user data when connected with address', async () => {
      const mockUser = {
        id: '1',
        address: '0x1234567890123456789012345678901234567890',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date(),
        isNewUser: false
      };

      mockUseAccount.mockReturnValue(createMockUseAccount({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      } as Response);

      const { result } = renderHook(() => useUserAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: '0x1234567890123456789012345678901234567890' }),
      });
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isNewUser).toBe(false);
    });

    it('should not fetch when not connected', () => {
      mockUseAccount.mockReturnValue(createMockUseAccount({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: false
      }));

      const { result } = renderHook(() => useUserAuth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.user).toBeUndefined();
    });

    it('should not fetch when no address', () => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: true
      } as any);

      const { result } = renderHook(() => useUserAuth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.user).toBeUndefined();
    });

    it('should handle fetch errors', async () => {
      mockUseAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const { result } = renderHook(() => useUserAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle network errors', async () => {
      mockUseAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true
      } as any);

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useUserAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });

      expect(result.current.error).toBeDefined();
    });

    it('should identify new users correctly', async () => {
      const mockNewUser = {
        id: '2',
        address: '0x1234567890123456789012345678901234567890',
        name: undefined,
        email: undefined,
        createdAt: new Date(),
        isNewUser: true
      };

      mockUseAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockNewUser,
      } as Response);

      const { result } = renderHook(() => useUserAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isNewUser).toBe(true);
    });
  });

  describe('Profile updates', () => {
    it('should update user profile successfully', async () => {
      const mockUser = {
        id: '1',
        address: '0x1234567890123456789012345678901234567890',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date(),
        isNewUser: false
      };

      const updatedUser = { ...mockUser, name: 'Jane Doe' };

      mockUseAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true
      } as any);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => updatedUser,
        } as Response);

      const { result } = renderHook(() => useUserAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updateProfile({ name: 'Jane Doe' });
      });

      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: '0x1234567890123456789012345678901234567890',
          name: 'Jane Doe'
        }),
      });
    });

    it('should handle profile update errors', async () => {
      const mockUser = {
        id: '1',
        address: '0x1234567890123456789012345678901234567890',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date(),
        isNewUser: false
      };

      mockUseAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true
      } as any);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser,
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        } as Response);

      const { result } = renderHook(() => useUserAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updateProfile({ name: 'Jane Doe' });
      });

      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: '0x1234567890123456789012345678901234567890',
          name: 'Jane Doe'
        }),
      });
    });

    it('should handle network errors during profile update', async () => {
      const mockUser = {
        id: '1',
        address: '0x1234567890123456789012345678901234567890',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date(),
        isNewUser: false
      };

      mockUseAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true
      } as any);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser,
        } as Response)
        .mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useUserAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updateProfile({ name: 'Jane Doe' });
      });

      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });
    });

    it('should update multiple profile fields', async () => {
      const mockUser = {
        id: '1',
        address: '0x1234567890123456789012345678901234567890',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date(),
        isNewUser: false
      };

      const updatedUser = { ...mockUser, name: 'Jane Doe', email: 'jane@example.com' };

      mockUseAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true
      } as any);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => updatedUser,
        } as Response);

      const { result } = renderHook(() => useUserAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updateProfile({ name: 'Jane Doe', email: 'jane@example.com' });
      });

      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: '0x1234567890123456789012345678901234567890',
          name: 'Jane Doe',
          email: 'jane@example.com'
        }),
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle null address', () => {
      mockUseAccount.mockReturnValue({
        address: null,
        isConnected: true
      } as any);

      const { result } = renderHook(() => useUserAuth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.user).toBeUndefined();
    });

    it('should handle empty string address', () => {
      mockUseAccount.mockReturnValue({
        address: '',
        isConnected: true
      } as any);

      const { result } = renderHook(() => useUserAuth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.user).toBeUndefined();
    });

    it('should handle undefined isConnected', () => {
      mockUseAccount.mockReturnValue({ 
        address: '0x1234567890123456789012345678901234567890',
        isConnected: undefined 
      } as any);

      const { result } = renderHook(() => useUserAuth(), {
        wrapper: createWrapper(),
      });

      // When isConnected is undefined, the hook should still work but may be in loading state
      expect(result.current.isLoading).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
      expect(result.current.user).toBeUndefined();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete user lifecycle', async () => {
      const mockUser = {
        id: '1',
        address: '0x1234567890123456789012345678901234567890',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date(),
        isNewUser: false
      };

      mockUseAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890' as any,
        isConnected: true
      } as any);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockUser, name: 'Jane Doe' }),
        } as Response);

      const { result } = renderHook(() => useUserAuth(), {
        wrapper: createWrapper(),
      });

      // Initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isNewUser).toBe(false);

      // Update profile
      act(() => {
        result.current.updateProfile({ name: 'Jane Doe' });
      });

      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });

      // The query invalidation will trigger another fetch, so we expect 3 calls total
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
}); 