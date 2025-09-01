import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import {
  getERC20TokenInfo,
  getERC721TokenMetadata,
  getERC1155TokenURI
} from '../../../core/services/tokens.js';
import { getPublicClient } from '../../../core/services/clients.js';

// Mock the dependencies
mock.module('../../../core/services/clients.js', () => ({
  getPublicClient: mock(() => {})
}));

// Mock viem functions
const mockGetContract = mock(() => ({}));
const mockFormatUnits = mock(() => '1000000');

mock.module('viem', () => ({
  getContract: mockGetContract,
  formatUnits: mockFormatUnits
}));

describe('Tokens Service', () => {
  const mockContract = {
    read: {
      name: mock(() => Promise.resolve('Test Token')),
      symbol: mock(() => Promise.resolve('TEST')),
      decimals: mock(() => Promise.resolve(18)),
      totalSupply: mock(() => Promise.resolve(1000000000000000000000000n)),
      tokenURI: mock(() => Promise.resolve('https://example.com/token/1')),
      uri: mock(() => Promise.resolve('https://example.com/token/1'))
    }
  };

  const mockPublicClient = {};

  beforeEach(() => {
    // Reset all mocks before each test
    mock.restore();

    // Setup default mock implementations
    (getPublicClient as any).mockReturnValue(mockPublicClient);
    mockGetContract.mockReturnValue(mockContract);
    mockFormatUnits.mockReturnValue('1000000');
  });

  afterEach(() => {
    mock.restore();
  });

  describe('getERC20TokenInfo', () => {
    test('should get ERC20 token information', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      const result = await getERC20TokenInfo(tokenAddress);
      
      expect(result).toEqual({
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18,
        totalSupply: 1000000000000000000000000n,
        formattedTotalSupply: '1000000'
      });
      
      expect(getPublicClient).toHaveBeenCalledWith('conflux');
      expect(mockGetContract).toHaveBeenCalledWith({
        address: tokenAddress,
        abi: expect.any(Array),
        client: mockPublicClient
      });
      expect(mockFormatUnits).toHaveBeenCalledWith(1000000000000000000000000n, 18);
    });

    test('should use specified network', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      await getERC20TokenInfo(tokenAddress, 'conflux-testnet');
      
      expect(getPublicClient).toHaveBeenCalledWith('conflux-testnet');
    });

    test('should call all required contract methods', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      await getERC20TokenInfo(tokenAddress);
      
      expect(mockContract.read.name).toHaveBeenCalled();
      expect(mockContract.read.symbol).toHaveBeenCalled();
      expect(mockContract.read.decimals).toHaveBeenCalled();
      expect(mockContract.read.totalSupply).toHaveBeenCalled();
    });
  });

  describe('getERC721TokenMetadata', () => {
    test('should get ERC721 token metadata', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      const tokenId = 1n;
      const result = await getERC721TokenMetadata(tokenAddress, tokenId);
      
      expect(result).toEqual({
        name: 'Test Token',
        symbol: 'TEST',
        tokenURI: 'https://example.com/token/1'
      });
      
      expect(getPublicClient).toHaveBeenCalledWith('conflux');
      expect(mockGetContract).toHaveBeenCalledWith({
        address: tokenAddress,
        abi: expect.any(Array),
        client: mockPublicClient
      });
    });

    test('should use specified network', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      const tokenId = 1n;
      await getERC721TokenMetadata(tokenAddress, tokenId, 'conflux-testnet');
      
      expect(getPublicClient).toHaveBeenCalledWith('conflux-testnet');
    });

    test('should call all required contract methods', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      const tokenId = 1n;
      await getERC721TokenMetadata(tokenAddress, tokenId);
      
      expect(mockContract.read.name).toHaveBeenCalled();
      expect(mockContract.read.symbol).toHaveBeenCalled();
      expect(mockContract.read.tokenURI).toHaveBeenCalledWith([tokenId]);
    });
  });

  describe('getERC1155TokenURI', () => {
    test('should get ERC1155 token URI', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      const tokenId = 1n;
      const result = await getERC1155TokenURI(tokenAddress, tokenId);
      
      expect(result).toBe('https://example.com/token/1');
      
      expect(getPublicClient).toHaveBeenCalledWith('conflux');
      expect(mockGetContract).toHaveBeenCalledWith({
        address: tokenAddress,
        abi: expect.any(Array),
        client: mockPublicClient
      });
    });

    test('should use specified network', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      const tokenId = 1n;
      await getERC1155TokenURI(tokenAddress, tokenId, 'conflux-testnet');
      
      expect(getPublicClient).toHaveBeenCalledWith('conflux-testnet');
    });

    test('should call contract uri method with token ID', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      const tokenId = 1n;
      await getERC1155TokenURI(tokenAddress, tokenId);
      
      expect(mockContract.read.uri).toHaveBeenCalledWith([tokenId]);
    });
  });
});
