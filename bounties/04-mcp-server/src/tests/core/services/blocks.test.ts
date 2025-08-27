import { describe, test, expect, mock, beforeEach, afterAll } from 'bun:test';
import {
  getBlockNumber,
  getBlockByNumber,
  getBlockByHash,
  getLatestBlock
} from '../../../core/services/blocks.js';
import { getPublicClient } from '../../../core/services/clients.js';

// Mock the dependencies
mock.module('../../../core/services/clients.js', () => ({
  getPublicClient: mock(() => {})
}));

describe('Blocks Service', () => {
  const mockClient = {
    getBlockNumber: mock(() => Promise.resolve(12345n)),
    getBlock: mock(() => Promise.resolve({
      number: 12345n,
      hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      timestamp: 1234567890n,
      transactions: []
    }))
  };

  beforeEach(() => {
    // Setup default mock implementations
    (getPublicClient as any).mockReturnValue(mockClient);
  });

  afterAll(() => {
    mock.restore();
  });

  describe('getBlockNumber', () => {
    test('should return the current block number', async () => {
      const result = await getBlockNumber();
      expect(result).toBe(12345n);
      expect(mockClient.getBlockNumber).toHaveBeenCalled();
    });

    test('should use default network when no network specified', async () => {
      await getBlockNumber();
      expect(getPublicClient).toHaveBeenCalledWith('conflux');
    });

    test('should use specified network', async () => {
      await getBlockNumber('conflux-testnet');
      expect(getPublicClient).toHaveBeenCalledWith('conflux-testnet');
    });
  });

  describe('getBlockByNumber', () => {
    test('should return block by number', async () => {
      const result = await getBlockByNumber(12345);
      expect(result).toBeDefined();
      expect(result.number).toBe(12345n);
      expect(mockClient.getBlock).toHaveBeenCalledWith({ blockNumber: 12345n });
    });

    test('should use default network when no network specified', async () => {
      await getBlockByNumber(12345);
      expect(getPublicClient).toHaveBeenCalledWith('conflux');
    });

    test('should use specified network', async () => {
      await getBlockByNumber(12345, 'conflux-testnet');
      expect(getPublicClient).toHaveBeenCalledWith('conflux-testnet');
    });

    test('should convert number to bigint', async () => {
      await getBlockByNumber(999);
      expect(mockClient.getBlock).toHaveBeenCalledWith({ blockNumber: 999n });
    });
  });

  describe('getBlockByHash', () => {
    test('should return block by hash', async () => {
      const blockHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = await getBlockByHash(blockHash);
      expect(result).toBeDefined();
      expect(mockClient.getBlock).toHaveBeenCalledWith({ blockHash });
    });

    test('should use default network when no network specified', async () => {
      const blockHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      await getBlockByHash(blockHash);
      expect(getPublicClient).toHaveBeenCalledWith('conflux');
    });

    test('should use specified network', async () => {
      const blockHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      await getBlockByHash(blockHash, 'conflux-testnet');
      expect(getPublicClient).toHaveBeenCalledWith('conflux-testnet');
    });
  });

  describe('getLatestBlock', () => {
    test('should return the latest block', async () => {
      const result = await getLatestBlock();
      expect(result).toBeDefined();
      expect(mockClient.getBlock).toHaveBeenCalledWith();
    });

    test('should use default network when no network specified', async () => {
      await getLatestBlock();
      expect(getPublicClient).toHaveBeenCalledWith('conflux');
    });

    test('should use specified network', async () => {
      await getLatestBlock('conflux-testnet');
      expect(getPublicClient).toHaveBeenCalledWith('conflux-testnet');
    });
  });
});
