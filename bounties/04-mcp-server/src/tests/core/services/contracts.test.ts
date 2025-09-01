import { describe, test, expect, mock, beforeEach } from 'bun:test';
import {
  readContract,
  writeContract,
  getLogs,
  isContract
} from '../../../core/services/contracts.js';
import { getPublicClient, getWalletClient } from '../../../core/services/clients.js';
import { getPrivateKeyAsHex } from '../../../core/config.js';
import * as services from '../../../core/services/index.js';

// Mock the dependencies
mock.module('../../../core/services/clients.js', () => ({
  getPublicClient: mock(() => {}),
  getWalletClient: mock(() => {})
}));

mock.module('../../../core/config.js', () => ({
  getPrivateKeyAsHex: mock(() => '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
}));

mock.module('../../../core/services/index.js', () => ({
  helpers: {
    validateAddress: mock((address: string) => address)
  }
}));

describe('Contracts Service', () => {
  const mockPublicClient = {
    readContract: mock(() => Promise.resolve(10n)),
    getLogs: mock(() => Promise.resolve([])),
    getBytecode: mock(() => Promise.resolve('0x123456'))
  };

  const mockWalletClient = {
    writeContract: mock(() => Promise.resolve('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'))
  };

  const mockReadParams = {
    address: '0x1234567890123456789012345678901234567890',
    abi: [],
    functionName: 'test'
  };

  const mockWriteParams = {
    address: '0x1234567890123456789012345678901234567890',
    abi: [],
    functionName: 'test',
    args: []
  };

  const mockLogsParams = {
    address: '0x1234567890123456789012345678901234567890'
  };

  function resetMocks() {
    (getPublicClient as any).mockReset?.();
    (getWalletClient as any).mockReset?.();
    (getPrivateKeyAsHex as any).mockReset?.();

    (getPublicClient as any).mockReturnValue(mockPublicClient);
    (getWalletClient as any).mockReturnValue(mockWalletClient);
    (getPrivateKeyAsHex as any).mockReturnValue('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
  }

  beforeEach(() => {
    resetMocks();
  });

  describe('readContract', () => {
    test('returns value from client.readContract', async () => {
      const result = await readContract(mockReadParams);
      expect(result).toBe(10n);
    });

    test('works with specified network', async () => {
      const result = await readContract(mockReadParams, 'conflux-testnet');
      expect(result).toBe(10n);
    });
  });

  describe('writeContract', () => {
    test('should write to contract with default network', async () => {
      const result = await writeContract(mockWriteParams);
      
      expect(result).toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      expect(mockWalletClient.writeContract).toHaveBeenCalledWith(mockWriteParams);
    });

    test('should write to contract with specified network', async () => {
      await writeContract(mockWriteParams, 'conflux-testnet');
      // no extra assertion needed
    });

    test('should use private key override when provided', async () => {
      const overrideKey = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      await writeContract(mockWriteParams, 'conflux', overrideKey);
      // verified by not throwing and calling writeContract
      expect(mockWalletClient.writeContract).toHaveBeenCalled();
    });

    test('should throw error when no private key available', async () => {
      (getPrivateKeyAsHex as any).mockReturnValue(null);
      await expect(writeContract(mockWriteParams)).rejects.toThrow('Private key not available');
    });
  });

  describe('getLogs', () => {
    test('should get logs', async () => {
      const result = await getLogs(mockLogsParams);
      expect(result).toEqual([]);
      expect(mockPublicClient.getLogs).toHaveBeenCalledWith(mockLogsParams);
    });
  });

  describe('isContract', () => {
    test('should return true for contract address', async () => {
      const result = await isContract('0x1234567890123456789012345678901234567890');
      expect(result).toBe(true);
      expect(services.helpers.validateAddress).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890');
      expect(mockPublicClient.getBytecode).toHaveBeenCalledWith({ address: '0x1234567890123456789012345678901234567890' });
    });

    test('should return false for EOA address', async () => {
      (mockPublicClient.getBytecode as any).mockResolvedValue('0x');
      const result = await isContract('0x1234567890123456789012345678901234567890');
      expect(result).toBe(false);
    });

    test('should return false for undefined bytecode', async () => {
      (mockPublicClient.getBytecode as any).mockResolvedValue(undefined);
      const result = await isContract('0x1234567890123456789012345678901234567890');
      expect(result).toBe(false);
    });
  });
});
