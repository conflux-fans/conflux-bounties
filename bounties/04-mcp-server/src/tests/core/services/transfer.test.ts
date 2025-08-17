import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import {
  transferConflux,
  transferERC20,
  approveERC20,
  transferERC721,
  transferERC1155
} from '../../../core/services/transfer.js';
import { getPublicClient, getWalletClient } from '../../../core/services/clients.js';
import { getPrivateKeyAsHex } from '../../../core/config.js';
import type { Hash } from 'viem';

// Mock the dependencies
mock.module('../../../core/services/clients.js', () => ({
  getPublicClient: mock(() => {}),
  getWalletClient: mock(() => {})
}));

mock.module('../../../core/config.js', () => ({
  getPrivateKeyAsHex: mock(() => '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
}));

// Mock viem's getContract function
const mockGetContract = mock(() => ({}));
// Use consistent parseEther mock with other tests
const mockParseEther = mock((value: string | number) => {
  const str = String(value);
  if (str === '1.0' || str === '1' || value === 1) return 1000000000n;
  if (str === '2.5' || value === 2.5) return 2500000000n;
  if (str === '0' || value === 0) return 0n;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0n;
  return BigInt(Math.round(n * 1e9));
});
const mockParseUnits = mock(() => 1000000000n);

mock.module('viem', () => ({
  getContract: mockGetContract,
  parseEther: mockParseEther,
  parseUnits: mockParseUnits
}));

describe('Transfer Service', () => {
  const mockContract = {
    read: {
      decimals: mock(() => Promise.resolve(9)),
      symbol: mock(() => Promise.resolve('TOKEN')),
      name: mock(() => Promise.resolve('Unknown'))
    }
  };

  const mockPublicClient = {
    readContract: mock((params: { functionName: string }) => {
      if (params.functionName === 'decimals') return 18;
      if (params.functionName === 'symbol') return 'TEST';
      if (params.functionName === 'name') return 'Test NFT';
      return null;
    }),
    getContract: mock(() => {})
  };

  const mockWalletClient = {
    sendTransaction: mock(() => '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hash),
    writeContract: mock(() => '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hash),
    account: { address: '0x1234567890123456789012345678901234567890' },
    chain: { id: 1 }
  };

  beforeEach(() => {
    // Reset all mocks before each test
    mock.restore();

    // Setup default mock implementations
    (getPublicClient as any).mockReturnValue(mockPublicClient);
    (getWalletClient as any).mockReturnValue(mockWalletClient);
    (getPrivateKeyAsHex as any).mockReturnValue('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');

    // Mock viem functions
    mockGetContract.mockReturnValue(mockContract);
    mockParseEther.mockReturnValue(1000000000n); // Use consistent value
    mockParseUnits.mockReturnValue(1000000000n);
  });

  describe('transferConflux', () => {
    test('should transfer Conflux tokens successfully', async () => {
      const mockHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hash;
      (mockWalletClient.sendTransaction as any).mockResolvedValue(mockHash);

      const result = await transferConflux(
        '0x1234567890123456789012345678901234567890',
        '1.0',
        'conflux'
      );

      expect(result).toBe(mockHash);
      expect(mockWalletClient.sendTransaction).toHaveBeenCalledWith({
        to: '0x1234567890123456789012345678901234567890',
        value: 1000000000n, // Use consistent value
        account: mockWalletClient.account,
        chain: mockWalletClient.chain
      });
    });

    test('should throw error when private key is not available', async () => {
      (getPrivateKeyAsHex as any).mockReturnValue(null);

      await expect(transferConflux(
        '0x1234567890123456789012345678901234567890',
        '1.0'
      )).rejects.toThrow('Private key not available');
    });
  });

  describe('transferERC20', () => {
    test('should transfer ERC20 tokens successfully', async () => {
      const mockHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hash;

      (mockWalletClient.writeContract as any).mockResolvedValue(mockHash);

      const result = await transferERC20(
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321',
        '1.0'
      );

      expect(result).toEqual({
        txHash: mockHash,
        amount: {
          raw: 1000000000n,
          formatted: '1.0'
        },
        token: {
          symbol: 'TOKEN',
          decimals: 9
        }
      });
    });
  });

  describe('approveERC20', () => {
    test('should approve ERC20 token spending successfully', async () => {
      const mockHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hash;

      (mockWalletClient.writeContract as any).mockResolvedValue(mockHash);

      const result = await approveERC20(
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321',
        '1.0'
      );

      expect(result).toEqual({
        txHash: mockHash,
        amount: {
          raw: 1000000000n,
          formatted: '1.0'
        },
        token: {
          symbol: 'TOKEN',
          decimals: 9
        }
      });
    });
  });

  describe('transferERC721', () => {
    test('should transfer ERC721 token successfully', async () => {
      const mockHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hash;

      (mockWalletClient.writeContract as any).mockResolvedValue(mockHash);

      const result = await transferERC721(
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321',
        1n
      );

      expect(result).toEqual({
        txHash: mockHash,
        tokenId: '1',
        token: {
          name: 'Unknown',
          symbol: 'TOKEN'
        }
      });
    });
  });

  describe('transferERC1155', () => {
    test('should transfer ERC1155 token successfully', async () => {
      const mockHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hash;

      (mockWalletClient.writeContract as any).mockResolvedValue(mockHash);

      const result = await transferERC1155(
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321',
        1n,
        '1'
      );

      expect(result).toEqual({
        txHash: mockHash,
        tokenId: '1',
        amount: '1'
      });
    });
  });
});
