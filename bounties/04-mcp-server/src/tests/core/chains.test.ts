import { describe, test, expect } from 'bun:test';
import {
  resolveChainId,
  getChain,
  getRpcUrl,
  getSupportedNetworks,
  DEFAULT_NETWORK,
  DEFAULT_RPC_URL,
  DEFAULT_CHAIN_ID,
  chainMap,
  networkNameMap,
  rpcUrlMap
} from '../../core/chains.js';

describe('Chains Module', () => {
  describe('Constants', () => {
    test('should export correct default values', () => {
      expect(DEFAULT_NETWORK).toBe('conflux');
      expect(DEFAULT_RPC_URL).toBe('https://evm.confluxrpc.com');
      expect(DEFAULT_CHAIN_ID).toBe(1030);
    });

    test('should export chain maps', () => {
      expect(chainMap).toBeDefined();
      expect(networkNameMap).toBeDefined();
      expect(rpcUrlMap).toBeDefined();
      expect(chainMap[1030]).toBeDefined();
      expect(chainMap[71]).toBeDefined();
    });
  });

  describe('resolveChainId', () => {
    test('should return the same number when given a number', () => {
      expect(resolveChainId(1030)).toBe(1030);
      expect(resolveChainId(71)).toBe(71);
      expect(resolveChainId(1)).toBe(1);
    });

    test('should resolve network names to chain IDs', () => {
      expect(resolveChainId('conflux')).toBe(1030);
      expect(resolveChainId('conflux-testnet')).toBe(71);
    });

    test('should handle case-insensitive network names', () => {
      expect(resolveChainId('CONFLUX')).toBe(1030);
      expect(resolveChainId('Conflux-Testnet')).toBe(71);
    });

    test('should parse numeric strings', () => {
      expect(resolveChainId('1030')).toBe(1030);
      expect(resolveChainId('71')).toBe(71);
    });

    test('should default to mainnet for unknown networks', () => {
      expect(resolveChainId('unknown')).toBe(DEFAULT_CHAIN_ID);
      expect(resolveChainId('invalid')).toBe(DEFAULT_CHAIN_ID);
    });
  });

  describe('getChain', () => {
    test('should return chain for valid chain ID', () => {
      const chain = getChain(1030);
      expect(chain).toBeDefined();
      expect(chain.id).toBe(1030);
    });

    test('should return chain for valid network name', () => {
      const chain = getChain('conflux');
      expect(chain).toBeDefined();
      expect(chain.id).toBe(1030);
    });

    test('should handle case-insensitive network names', () => {
      const chain = getChain('CONFLUX');
      expect(chain).toBeDefined();
      expect(chain.id).toBe(1030);
    });

    test('should throw error for unsupported network names', () => {
      expect(() => getChain('unsupported')).toThrow('Unsupported network: unsupported');
      expect(() => getChain('invalid-network')).toThrow('Unsupported network: invalid-network');
    });

    test('should default to mainnet when no argument provided', () => {
      const chain = getChain();
      expect(chain).toBeDefined();
      expect(chain.id).toBe(DEFAULT_CHAIN_ID);
    });

    test('should fallback to mainnet for unknown chain IDs', () => {
      const chain = getChain(999);
      expect(chain).toBeDefined();
      expect(chain.id).toBe(DEFAULT_CHAIN_ID);
    });
  });

  describe('getRpcUrl', () => {
    test('should return correct RPC URL for chain ID', () => {
      expect(getRpcUrl(1030)).toBe('https://evm.confluxrpc.com');
      expect(getRpcUrl(71)).toBe('https://evmtestnet.confluxrpc.com');
    });

    test('should return correct RPC URL for network name', () => {
      expect(getRpcUrl('conflux')).toBe('https://evm.confluxrpc.com');
      expect(getRpcUrl('conflux-testnet')).toBe('https://evmtestnet.confluxrpc.com');
    });

    test('should handle case-insensitive network names', () => {
      expect(getRpcUrl('CONFLUX')).toBe('https://evm.confluxrpc.com');
      expect(getRpcUrl('Conflux-Testnet')).toBe('https://evmtestnet.confluxrpc.com');
    });

    test('should default to mainnet RPC when no argument provided', () => {
      expect(getRpcUrl()).toBe(DEFAULT_RPC_URL);
    });

    test('should fallback to default RPC for unknown chain IDs', () => {
      expect(getRpcUrl(999)).toBe(DEFAULT_RPC_URL);
    });
  });

  describe('getSupportedNetworks', () => {
    test('should return array of supported network names', () => {
      const networks = getSupportedNetworks();
      expect(Array.isArray(networks)).toBe(true);
      expect(networks.length).toBeGreaterThan(0);
      expect(networks).toContain('conflux');
      expect(networks).toContain('conflux-testnet');
    });

    test('should filter out short aliases', () => {
      const networks = getSupportedNetworks();
      networks.forEach(network => {
        expect(network.length).toBeGreaterThan(2);
      });
    });

    test('should return sorted networks', () => {
      const networks = getSupportedNetworks();
      const sortedNetworks = [...networks].sort();
      expect(networks).toEqual(sortedNetworks);
    });
  });
});
