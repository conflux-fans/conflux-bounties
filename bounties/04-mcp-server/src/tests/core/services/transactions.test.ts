import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import {
  getTransaction,
  getTransactionReceipt,
  getTransactionCount,
  estimateGas,
  getChainId
} from '../../../core/services/transactions.js';
import { getPublicClient } from '../../../core/services/clients.js';

// Mock the dependencies
mock.module('../../../core/services/clients.js', () => ({
  getPublicClient: mock(() => {})
}));

describe('Transactions Service', () => {
  const mockClient = {
    getTransaction: mock(() => Promise.resolve({
      hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      from: '0x1234567890123456789012345678901234567890',
      to: '0x0987654321098765432109876543210987654321',
      value: 1000000000000000000n
    })),
    getTransactionReceipt: mock(() => Promise.resolve({
      hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      status: 'success',
      blockNumber: 12345n,
      gasUsed: 21000n
    })),
    getTransactionCount: mock(() => Promise.resolve(5n)),
    estimateGas: mock(() => Promise.resolve(21000n)),
    getChainId: mock(() => Promise.resolve(1030n))
  };

  beforeEach(() => {
    // Reset all mocks before each test
    mock.restore();

    // Setup default mock implementations
    (getPublicClient as any).mockReturnValue(mockClient);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('getTransaction', () => {
    test('should get transaction by hash with default network', async () => {
      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = await getTransaction(hash);
      
      expect(result).toBeDefined();
      expect(result.hash).toBe(hash);
      expect(getPublicClient).toHaveBeenCalledWith('conflux');
      expect(mockClient.getTransaction).toHaveBeenCalledWith({ hash });
    });

    test('should get transaction with specified network', async () => {
      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      await getTransaction(hash, 'conflux-testnet');
      
      expect(getPublicClient).toHaveBeenCalledWith('conflux-testnet');
    });
  });

  describe('getTransactionReceipt', () => {
    test('should get transaction receipt by hash with default network', async () => {
      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = await getTransactionReceipt(hash);
      
      expect(result).toBeDefined();
      expect(result.hash).toBe(hash);
      expect(result.status).toBe('success');
      expect(getPublicClient).toHaveBeenCalledWith('conflux');
      expect(mockClient.getTransactionReceipt).toHaveBeenCalledWith({ hash });
    });

    test('should get transaction receipt with specified network', async () => {
      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      await getTransactionReceipt(hash, 'conflux-testnet');
      
      expect(getPublicClient).toHaveBeenCalledWith('conflux-testnet');
    });
  });

  describe('getTransactionCount', () => {
    test('should get transaction count for address with default network', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const result = await getTransactionCount(address);
      
      expect(result).toBe(5);
      expect(getPublicClient).toHaveBeenCalledWith('conflux');
      expect(mockClient.getTransactionCount).toHaveBeenCalledWith({ address });
    });

    test('should get transaction count with specified network', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      await getTransactionCount(address, 'conflux-testnet');
      
      expect(getPublicClient).toHaveBeenCalledWith('conflux-testnet');
    });

    test('should convert bigint to number', async () => {
      (mockClient.getTransactionCount as any).mockResolvedValue(42n);
      
      const address = '0x1234567890123456789012345678901234567890';
      const result = await getTransactionCount(address);
      
      expect(result).toBe(42);
    });
  });

  describe('estimateGas', () => {
    test('should estimate gas with default network', async () => {
      const params = {
        to: '0x1234567890123456789012345678901234567890',
        value: 1000000000000000000n
      };
      const result = await estimateGas(params);
      
      expect(result).toBe(21000n);
      expect(getPublicClient).toHaveBeenCalledWith('conflux');
      expect(mockClient.estimateGas).toHaveBeenCalledWith(params);
    });

    test('should estimate gas with specified network', async () => {
      const params = {
        to: '0x1234567890123456789012345678901234567890',
        value: 1000000000000000000n
      };
      await estimateGas(params, 'conflux-testnet');
      
      expect(getPublicClient).toHaveBeenCalledWith('conflux-testnet');
    });
  });

  describe('getChainId', () => {
    test('should get chain ID with default network', async () => {
      const result = await getChainId();
      
      expect(result).toBe(1030);
      expect(getPublicClient).toHaveBeenCalledWith('conflux');
      expect(mockClient.getChainId).toHaveBeenCalled();
    });

    test('should get chain ID with specified network', async () => {
      await getChainId('conflux-testnet');
      
      expect(getPublicClient).toHaveBeenCalledWith('conflux-testnet');
    });

    test('should convert bigint to number', async () => {
      (mockClient.getChainId as any).mockResolvedValue(71n);
      
      const result = await getChainId();
      
      expect(result).toBe(71);
    });
  });
});
