import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ConfluxESpace } from '../lib/chains';

jest.mock('viem', () => {
  const actualViem = jest.requireActual('viem');
  return {
    ...actualViem,
    createPublicClient: jest.fn((config) => ({
      chain: config.chain,
      transport: config.transport,
      type: 'publicClient',
    })),
    createWalletClient: jest.fn((config) => ({
      chain: config.chain,
      transport: config.transport,
      type: 'walletClient',
    })),
    http: jest.fn((url) => ({
      type: 'http',
      url: url || 'https://evm.confluxrpc.com',
    })),
    custom: jest.fn((provider) => ({
      type: 'custom',
      provider,
    })),
  };
});

import { publicClient, getWalletClient } from '../lib/viemClient';
import { createPublicClient, createWalletClient, http, custom } from 'viem';

describe('Viem Clients Configuration', () => {
  describe('publicClient', () => {
    it('should be defined', () => {
      expect(publicClient).toBeDefined();
    });

    it('should be created with createPublicClient', () => {
      expect(createPublicClient).toHaveBeenCalled();
    });

    it('should have chain property', () => {
      expect(publicClient).toHaveProperty('chain');
    });

    it('should have ConfluxESpace chain configuration', () => {
      expect(publicClient.chain).toEqual(ConfluxESpace);
    });

    it('should have correct chain id', () => {
      expect(publicClient.chain.id).toBe(1030);
    });

    it('should have transport property', () => {
      expect(publicClient).toHaveProperty('transport');
    });

    it('should use http transport', () => {
      expect(http).toHaveBeenCalledWith('https://evm.confluxrpc.com');
    });
  });

  describe('getWalletClient', () => {
    let mockEthereum: any;

    beforeEach(() => {
      jest.clearAllMocks();
      
      mockEthereum = {
        request: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn(),
        isMetaMask: true,
      };
    });

    afterEach(() => {
      if (typeof window !== 'undefined') {
        delete (window as any).ethereum;
      }
    });

    describe('when window.ethereum is available', () => {
      beforeEach(() => {
        Object.defineProperty(global, 'window', {
          value: { ethereum: mockEthereum },
          writable: true,
          configurable: true,
        });
      });

      it('should return a wallet client', () => {
        const result = getWalletClient();
        
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
      });

      it('should call createWalletClient', () => {
        getWalletClient();
        
        expect(createWalletClient).toHaveBeenCalled();
      });

      it('should create wallet client with ConfluxESpace chain', () => {
        getWalletClient();
        
        expect(createWalletClient).toHaveBeenCalledWith(
          expect.objectContaining({
            chain: ConfluxESpace,
          })
        );
      });

      it('should use custom transport with window.ethereum', () => {
        getWalletClient();
        
        expect(custom).toHaveBeenCalledWith(mockEthereum);
      });

      it('should return wallet client with chain property', () => {
        const result = getWalletClient();
        
        expect(result).toHaveProperty('chain');
        expect(result?.chain).toEqual(ConfluxESpace);
      });

      it('should return wallet client with transport property', () => {
        const result = getWalletClient();
        
        expect(result).toHaveProperty('transport');
      });

      it('should create new wallet client on each call', () => {
        const result1 = getWalletClient();
        const result2 = getWalletClient();
        
        expect(createWalletClient).toHaveBeenCalledTimes(2);
      });
    });

    describe('when window.ethereum is not available', () => {
      beforeEach(() => {
        Object.defineProperty(global, 'window', {
          value: {},
          writable: true,
          configurable: true,
        });
      });

      it('should return null', () => {
        const result = getWalletClient();
        
        expect(result).toBeNull();
      });

      it('should not call createWalletClient', () => {
        getWalletClient();
        
        expect(createWalletClient).not.toHaveBeenCalled();
      });

      it('should return null consistently', () => {
        const result1 = getWalletClient();
        const result2 = getWalletClient();
        
        expect(result1).toBeNull();
        expect(result2).toBeNull();
      });
    });

    describe('when window is undefined (SSR)', () => {
      beforeEach(() => {
        Object.defineProperty(global, 'window', {
          value: undefined,
          writable: true,
          configurable: true,
        });
      });

      it('should return null', () => {
        const result = getWalletClient();
        
        expect(result).toBeNull();
      });

      it('should not throw error', () => {
        expect(() => getWalletClient()).not.toThrow();
      });

      it('should not call createWalletClient', () => {
        getWalletClient();
        
        expect(createWalletClient).not.toHaveBeenCalled();
      });
    });

    describe('edge cases', () => {
      it('should return null when window.ethereum is null', () => {
        Object.defineProperty(global, 'window', {
          value: { ethereum: null },
          writable: true,
          configurable: true,
        });
        
        const result = getWalletClient();
        expect(result).toBeNull();
      });

      it('should return null when window.ethereum is undefined', () => {
        Object.defineProperty(global, 'window', {
          value: { ethereum: undefined },
          writable: true,
          configurable: true,
        });
        
        const result = getWalletClient();
        expect(result).toBeNull();
      });

      it('should return null when window.ethereum is false', () => {
        Object.defineProperty(global, 'window', {
          value: { ethereum: false },
          writable: true,
          configurable: true,
        });
        
        const result = getWalletClient();
        expect(result).toBeNull();
      });

      it('should return null when window.ethereum is 0', () => {
        Object.defineProperty(global, 'window', {
          value: { ethereum: 0 },
          writable: true,
          configurable: true,
        });
        
        const result = getWalletClient();
        expect(result).toBeNull();
      });

      it('should return null when window.ethereum is empty string', () => {
        Object.defineProperty(global, 'window', {
          value: { ethereum: '' },
          writable: true,
          configurable: true,
        });
        
        const result = getWalletClient();
        expect(result).toBeNull();
      });

      it('should create client when window.ethereum is empty object', () => {
        Object.defineProperty(global, 'window', {
          value: { ethereum: {} },
          writable: true,
          configurable: true,
        });
        
        const result = getWalletClient();
        expect(result).toBeDefined();
      });
    });
  });

  describe('Integration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      
      Object.defineProperty(global, 'window', {
        value: {
          ethereum: {
            request: jest.fn(),
            on: jest.fn(),
          },
        },
        writable: true,
        configurable: true,
      });
    });

    it('should have both public and wallet clients available', () => {
      const walletClient = getWalletClient();
      
      expect(publicClient).toBeDefined();
      expect(walletClient).toBeDefined();
    });

    it('should use same chain for both clients', () => {
      const walletClient = getWalletClient();
      
      expect(publicClient.chain).toEqual(ConfluxESpace);
      expect(walletClient?.chain).toEqual(ConfluxESpace);
    });

    it('should have different transport types', () => {
      const walletClient = getWalletClient();
      
      expect(publicClient.transport.type).toBe('http');
      expect(walletClient?.transport.type).toBe('custom');
    });
  });
});