import { ConfluxESpace, supportedChains, getChainById, isChainSupported } from '../lib/chains';
import { Chain } from 'viem';

describe('Chain Configuration', () => {
  describe('ConfluxESpace', () => {
    it('should have correct chain id', () => {
      expect(ConfluxESpace.id).toBe(1030);
    });

    it('should have correct chain name', () => {
      expect(ConfluxESpace.name).toBe('Conflux eSpace');
    });

    it('should have correct native currency configuration', () => {
      expect(ConfluxESpace.nativeCurrency).toEqual({
        decimals: 18,
        name: 'CFX',
        symbol: 'CFX',
      });
    });

    it('should have correct RPC URLs', () => {
      expect(ConfluxESpace.rpcUrls.default.http).toEqual(['https://evm.confluxrpc.com']);
      expect(ConfluxESpace.rpcUrls.public.http).toEqual(['https://evm.confluxrpc.com']);
    });

    it('should have correct block explorer configuration', () => {
      expect(ConfluxESpace.blockExplorers.default).toEqual({
        name: 'ConfluxScan',
        url: 'https://evm.confluxscan.net/',
      });
    });

    it('should not be a testnet', () => {
      expect(ConfluxESpace.testnet).toBe(false);
    });

    it('should have all required Chain properties', () => {
      expect(ConfluxESpace).toHaveProperty('id');
      expect(ConfluxESpace).toHaveProperty('name');
      expect(ConfluxESpace).toHaveProperty('nativeCurrency');
      expect(ConfluxESpace).toHaveProperty('rpcUrls');
      expect(ConfluxESpace).toHaveProperty('blockExplorers');
      expect(ConfluxESpace).toHaveProperty('testnet');
    });
  });

  describe('supportedChains', () => {
    it('should contain ConfluxESpace', () => {
      expect(supportedChains).toContain(ConfluxESpace);
    });

    it('should have length of 1', () => {
      expect(supportedChains).toHaveLength(1);
    });

    it('should be an array of Chain objects', () => {
      supportedChains.forEach((chain) => {
        expect(chain).toHaveProperty('id');
        expect(chain).toHaveProperty('name');
        expect(chain).toHaveProperty('nativeCurrency');
        expect(chain).toHaveProperty('rpcUrls');
      });
    });

    it('should contain only valid chain configurations', () => {
      supportedChains.forEach((chain) => {
        expect(typeof chain.id).toBe('number');
        expect(typeof chain.name).toBe('string');
        expect(chain.nativeCurrency).toBeDefined();
        expect(chain.rpcUrls).toBeDefined();
      });
    });
  });

  describe('getChainById', () => {
    it('should return ConfluxESpace when chainId is 1030', () => {
      const result = getChainById(1030);
      expect(result).toBeDefined();
      expect(result).toEqual(ConfluxESpace);
      expect(result?.id).toBe(1030);
    });

    it('should return correct chain object with all properties', () => {
      const result = getChainById(1030);
      expect(result?.name).toBe('Conflux eSpace');
      expect(result?.nativeCurrency.symbol).toBe('CFX');
    });

    it('should return undefined for unsupported chainId', () => {
      const result = getChainById(1);
      expect(result).toBeUndefined();
    });

    it('should return undefined for non-existent chainId', () => {
      const result = getChainById(999999);
      expect(result).toBeUndefined();
    });

    it('should return undefined for negative chainId', () => {
      const result = getChainById(-1);
      expect(result).toBeUndefined();
    });

    it('should return undefined for zero chainId', () => {
      const result = getChainById(0);
      expect(result).toBeUndefined();
    });
  });

  describe('isChainSupported', () => {
    it('should return true for ConfluxESpace chainId (1030)', () => {
      expect(isChainSupported(1030)).toBe(true);
    });

    it('should return false for Ethereum mainnet (1)', () => {
      expect(isChainSupported(1)).toBe(false);
    });

    it('should return false for BSC mainnet (56)', () => {
      expect(isChainSupported(56)).toBe(false);
    });

    it('should return false for Polygon mainnet (137)', () => {
      expect(isChainSupported(137)).toBe(false);
    });

    it('should return false for Arbitrum One (42161)', () => {
      expect(isChainSupported(42161)).toBe(false);
    });

    it('should return false for non-existent chainId', () => {
      expect(isChainSupported(999999)).toBe(false);
    });

    it('should return false for negative chainId', () => {
      expect(isChainSupported(-1)).toBe(false);
    });

    it('should return false for zero chainId', () => {
      expect(isChainSupported(0)).toBe(false);
    });
  });
});