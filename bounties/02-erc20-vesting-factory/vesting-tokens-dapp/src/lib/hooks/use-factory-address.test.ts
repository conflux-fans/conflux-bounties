import { renderHook } from '@testing-library/react';
import { useFactoryAddress, useChainExplorer } from './use-factory-address';
import { getExplorerAddressUrl, getExplorerTxUrl, getFactoryAddress } from '@/lib/web3/config';

// Mock wagmi
jest.mock('wagmi', () => ({
  useChainId: jest.fn()
}));

// Mock the config functions
jest.mock('@/lib/web3/config', () => ({
  getExplorerAddressUrl: jest.fn(),
  getExplorerTxUrl: jest.fn(),
  getFactoryAddress: jest.fn()
}));

import { useChainId } from 'wagmi';

const mockUseChainId = jest.mocked(useChainId);
const mockGetExplorerAddressUrl = getExplorerAddressUrl as jest.MockedFunction<typeof getExplorerAddressUrl>;
const mockGetExplorerTxUrl = getExplorerTxUrl as jest.MockedFunction<typeof getExplorerTxUrl>;
const mockGetFactoryAddress = getFactoryAddress as jest.MockedFunction<typeof getFactoryAddress>;

describe('use-factory-address', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useFactoryAddress', () => {
    it('should return factory address when available', () => {
      const mockChainId = 1;
      const mockFactoryAddress = '0x1234567890123456789012345678901234567890';
      
      mockUseChainId.mockReturnValue(mockChainId);
      mockGetFactoryAddress.mockReturnValue(mockFactoryAddress);

      const { result } = renderHook(() => useFactoryAddress());

      expect(mockGetFactoryAddress).toHaveBeenCalledWith(mockChainId);
      expect(result.current).toBe(mockFactoryAddress);
    });

    it('should return null when factory address is not available', () => {
      const mockChainId = 999; // Non-existent chain
      
      mockUseChainId.mockReturnValue(mockChainId);
      mockGetFactoryAddress.mockReturnValue(null as any);

      const { result } = renderHook(() => useFactoryAddress());

      expect(mockGetFactoryAddress).toHaveBeenCalledWith(mockChainId);
      expect(result.current).toBe(null);
    });

    it('should handle errors and return null', () => {
      const mockChainId = 1;
      const mockError = new Error('Factory not found');
      
      mockUseChainId.mockReturnValue(mockChainId);
      mockGetFactoryAddress.mockImplementation(() => {
        throw mockError;
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useFactoryAddress());

      expect(mockGetFactoryAddress).toHaveBeenCalledWith(mockChainId);
      expect(consoleSpy).toHaveBeenCalledWith('Factory not deployed on this chain:', mockChainId);
      expect(result.current).toBe(null);

      consoleSpy.mockRestore();
    });

    it('should handle undefined chain ID', () => {
      mockUseChainId.mockReturnValue(undefined as any);
      mockGetFactoryAddress.mockReturnValue(null as any);

      const { result } = renderHook(() => useFactoryAddress());

      expect(mockGetFactoryAddress).toHaveBeenCalledWith(undefined);
      expect(result.current).toBe(null);
    });

    it('should handle zero chain ID', () => {
      const mockChainId = 0;
      mockUseChainId.mockReturnValue(mockChainId);
      mockGetFactoryAddress.mockReturnValue(null as any);

      const { result } = renderHook(() => useFactoryAddress());

      expect(mockGetFactoryAddress).toHaveBeenCalledWith(mockChainId);
      expect(result.current).toBe(null);
    });
  });

  describe('useChainExplorer', () => {
    it('should return explorer functions for valid chain ID', () => {
      const mockChainId = 1;
      const mockAddress = '0x1234567890123456789012345678901234567890';
      const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const mockAddressUrl = 'https://etherscan.io/address/0x1234567890123456789012345678901234567890';
      const mockTxUrl = 'https://etherscan.io/tx/0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      
      mockUseChainId.mockReturnValue(mockChainId);
      mockGetExplorerAddressUrl.mockReturnValue(mockAddressUrl);
      mockGetExplorerTxUrl.mockReturnValue(mockTxUrl);

      const { result } = renderHook(() => useChainExplorer());

      expect(result.current.getAddressUrl).toBeDefined();
      expect(result.current.getTxUrl).toBeDefined();

      const addressUrl = result.current.getAddressUrl(mockAddress);
      const txUrl = result.current.getTxUrl(mockTxHash);

      expect(mockGetExplorerAddressUrl).toHaveBeenCalledWith(mockChainId, mockAddress);
      expect(mockGetExplorerTxUrl).toHaveBeenCalledWith(mockChainId, mockTxHash);
      expect(addressUrl).toBe(mockAddressUrl);
      expect(txUrl).toBe(mockTxUrl);
    });

    it('should handle undefined chain ID', () => {
      mockUseChainId.mockReturnValue(undefined as any);
      mockGetExplorerAddressUrl.mockReturnValue('');
      mockGetExplorerTxUrl.mockReturnValue('');

      const { result } = renderHook(() => useChainExplorer());

      const mockAddress = '0x1234567890123456789012345678901234567890';
      const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

      result.current.getAddressUrl(mockAddress);
      result.current.getTxUrl(mockTxHash);

      expect(mockGetExplorerAddressUrl).toHaveBeenCalledWith(undefined, mockAddress);
      expect(mockGetExplorerTxUrl).toHaveBeenCalledWith(undefined, mockTxHash);
    });

    it('should handle zero chain ID', () => {
      const mockChainId = 0;
      mockUseChainId.mockReturnValue(mockChainId);
      mockGetExplorerAddressUrl.mockReturnValue('');
      mockGetExplorerTxUrl.mockReturnValue('');

      const { result } = renderHook(() => useChainExplorer());

      const mockAddress = '0x1234567890123456789012345678901234567890';
      const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

      result.current.getAddressUrl(mockAddress);
      result.current.getTxUrl(mockTxHash);

      expect(mockGetExplorerAddressUrl).toHaveBeenCalledWith(mockChainId, mockAddress);
      expect(mockGetExplorerTxUrl).toHaveBeenCalledWith(mockChainId, mockTxHash);
    });

    it('should handle empty address and transaction hash', () => {
      const mockChainId = 1;
      mockUseChainId.mockReturnValue(mockChainId);
      mockGetExplorerAddressUrl.mockReturnValue('');
      mockGetExplorerTxUrl.mockReturnValue('');

      const { result } = renderHook(() => useChainExplorer());

      const emptyAddress = '';
      const emptyTxHash = '';

      result.current.getAddressUrl(emptyAddress);
      result.current.getTxUrl(emptyTxHash);

      expect(mockGetExplorerAddressUrl).toHaveBeenCalledWith(mockChainId, emptyAddress);
      expect(mockGetExplorerTxUrl).toHaveBeenCalledWith(mockChainId, emptyTxHash);
    });

    it('should handle special characters in address and transaction hash', () => {
      const mockChainId = 1;
      mockUseChainId.mockReturnValue(mockChainId);
      mockGetExplorerAddressUrl.mockReturnValue('https://example.com/address/special');
      mockGetExplorerTxUrl.mockReturnValue('https://example.com/tx/special');

      const { result } = renderHook(() => useChainExplorer());

      const specialAddress = '0x1234567890123456789012345678901234567890!@#';
      const specialTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890!@#';

      result.current.getAddressUrl(specialAddress);
      result.current.getTxUrl(specialTxHash);

      expect(mockGetExplorerAddressUrl).toHaveBeenCalledWith(mockChainId, specialAddress);
      expect(mockGetExplorerTxUrl).toHaveBeenCalledWith(mockChainId, specialTxHash);
    });

    it('should handle multiple calls with different parameters', () => {
      const mockChainId = 1;
      mockUseChainId.mockReturnValue(mockChainId);
      mockGetExplorerAddressUrl.mockReturnValue('https://example.com/address/');
      mockGetExplorerTxUrl.mockReturnValue('https://example.com/tx/');

      const { result } = renderHook(() => useChainExplorer());

      const address1 = '0x1111111111111111111111111111111111111111';
      const address2 = '0x2222222222222222222222222222222222222222';
      const txHash1 = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const txHash2 = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

      result.current.getAddressUrl(address1);
      result.current.getAddressUrl(address2);
      result.current.getTxUrl(txHash1);
      result.current.getTxUrl(txHash2);

      expect(mockGetExplorerAddressUrl).toHaveBeenCalledTimes(2);
      expect(mockGetExplorerTxUrl).toHaveBeenCalledTimes(2);
      expect(mockGetExplorerAddressUrl).toHaveBeenNthCalledWith(1, mockChainId, address1);
      expect(mockGetExplorerAddressUrl).toHaveBeenNthCalledWith(2, mockChainId, address2);
      expect(mockGetExplorerTxUrl).toHaveBeenNthCalledWith(1, mockChainId, txHash1);
      expect(mockGetExplorerTxUrl).toHaveBeenNthCalledWith(2, mockChainId, txHash2);
    });
  });

  describe('Integration scenarios', () => {
    it('should work with Ethereum mainnet', () => {
      const mockChainId = 1; // Ethereum mainnet
      const mockFactoryAddress = '0x1234567890123456789012345678901234567890';
      
      mockUseChainId.mockReturnValue(mockChainId);
      mockGetFactoryAddress.mockReturnValue(mockFactoryAddress);
      mockGetExplorerAddressUrl.mockReturnValue('https://etherscan.io/address/');
      mockGetExplorerTxUrl.mockReturnValue('https://etherscan.io/tx/');

      const { result: factoryResult } = renderHook(() => useFactoryAddress());
      const { result: explorerResult } = renderHook(() => useChainExplorer());

      expect(factoryResult.current).toBe(mockFactoryAddress);
      expect(explorerResult.current.getAddressUrl).toBeDefined();
      expect(explorerResult.current.getTxUrl).toBeDefined();
    });

    it('should work with Polygon', () => {
      const mockChainId = 137; // Polygon
      const mockFactoryAddress = '0x9876543210987654321098765432109876543210';
      
      mockUseChainId.mockReturnValue(mockChainId);
      mockGetFactoryAddress.mockReturnValue(mockFactoryAddress);
      mockGetExplorerAddressUrl.mockReturnValue('https://polygonscan.com/address/');
      mockGetExplorerTxUrl.mockReturnValue('https://polygonscan.com/tx/');

      const { result: factoryResult } = renderHook(() => useFactoryAddress());
      const { result: explorerResult } = renderHook(() => useChainExplorer());

      expect(factoryResult.current).toBe(mockFactoryAddress);
      expect(explorerResult.current.getAddressUrl).toBeDefined();
      expect(explorerResult.current.getTxUrl).toBeDefined();
    });

    it('should handle unsupported chain gracefully', () => {
      const mockChainId = 999999; // Unsupported chain
      
      mockUseChainId.mockReturnValue(mockChainId);
      mockGetFactoryAddress.mockImplementation(() => {
        throw new Error('Chain not supported');
      });
      mockGetExplorerAddressUrl.mockReturnValue('');
      mockGetExplorerTxUrl.mockReturnValue('');

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result: factoryResult } = renderHook(() => useFactoryAddress());
      const { result: explorerResult } = renderHook(() => useChainExplorer());

      expect(factoryResult.current).toBe(null);
      expect(consoleSpy).toHaveBeenCalledWith('Factory not deployed on this chain:', mockChainId);
      expect(explorerResult.current.getAddressUrl).toBeDefined();
      expect(explorerResult.current.getTxUrl).toBeDefined();

      consoleSpy.mockRestore();
    });
  });
}); 