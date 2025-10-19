import {
  CONFLUX_ESPACE_TESTNET,
  CONFLUX_ESPACE_MAINNET,
  PRICE_FEED_IDS,
  CONTRACT_ADDRESSES,
  PYTH_CONFIG,
} from '../lib/constants';

describe('Conflux eSpace Configuration', () => {
  describe('CONFLUX_ESPACE_TESTNET', () => {
    it('should have correct chain id', () => {
      expect(CONFLUX_ESPACE_TESTNET.id).toBe(71);
    });

    it('should have correct chain name', () => {
      expect(CONFLUX_ESPACE_TESTNET.name).toBe('Conflux eSpace Testnet');
    });

    it('should have correct network identifier', () => {
      expect(CONFLUX_ESPACE_TESTNET.network).toBe('conflux-espace-testnet');
    });

    it('should have correct native currency configuration', () => {
      expect(CONFLUX_ESPACE_TESTNET.nativeCurrency).toEqual({
        decimals: 18,
        name: 'CFX',
        symbol: 'CFX',
      });
    });

    it('should have correct RPC URLs', () => {
      expect(CONFLUX_ESPACE_TESTNET.rpcUrls.default.http).toEqual(['https://evmtestnet.confluxrpc.com']);
      expect(CONFLUX_ESPACE_TESTNET.rpcUrls.public.http).toEqual(['https://evmtestnet.confluxrpc.com']);
    });

    it('should have correct block explorer configuration', () => {
      expect(CONFLUX_ESPACE_TESTNET.blockExplorers.default).toEqual({
        name: 'ConfluxScan',
        url: 'https://evmtestnet.confluxscan.net/',
      });
    });

    it('should be marked as testnet', () => {
      expect(CONFLUX_ESPACE_TESTNET.testnet).toBe(true);
    });

    it('should have all required properties', () => {
      expect(CONFLUX_ESPACE_TESTNET).toHaveProperty('id');
      expect(CONFLUX_ESPACE_TESTNET).toHaveProperty('name');
      expect(CONFLUX_ESPACE_TESTNET).toHaveProperty('network');
      expect(CONFLUX_ESPACE_TESTNET).toHaveProperty('nativeCurrency');
      expect(CONFLUX_ESPACE_TESTNET).toHaveProperty('rpcUrls');
      expect(CONFLUX_ESPACE_TESTNET).toHaveProperty('blockExplorers');
      expect(CONFLUX_ESPACE_TESTNET).toHaveProperty('testnet');
    });
  });

  describe('CONFLUX_ESPACE_MAINNET', () => {
    it('should have correct chain id', () => {
      expect(CONFLUX_ESPACE_MAINNET.id).toBe(1030);
    });

    it('should have correct chain name', () => {
      expect(CONFLUX_ESPACE_MAINNET.name).toBe('Conflux eSpace');
    });

    it('should have correct network identifier', () => {
      expect(CONFLUX_ESPACE_MAINNET.network).toBe('conflux-espace');
    });

    it('should have correct native currency configuration', () => {
      expect(CONFLUX_ESPACE_MAINNET.nativeCurrency).toEqual({
        decimals: 18,
        name: 'CFX',
        symbol: 'CFX',
      });
    });

    it('should have correct RPC URLs', () => {
      expect(CONFLUX_ESPACE_MAINNET.rpcUrls.default.http).toEqual(['https://evm.confluxrpc.com']);
      expect(CONFLUX_ESPACE_MAINNET.rpcUrls.public.http).toEqual(['https://evm.confluxrpc.com']);
    });

    it('should have correct block explorer configuration', () => {
      expect(CONFLUX_ESPACE_MAINNET.blockExplorers.default).toEqual({
        name: 'ConfluxScan',
        url: 'https://evm.confluxscan.io',
      });
    });

    it('should not be marked as testnet', () => {
      expect(CONFLUX_ESPACE_MAINNET.testnet).toBe(false);
    });

    it('should have all required properties', () => {
      expect(CONFLUX_ESPACE_MAINNET).toHaveProperty('id');
      expect(CONFLUX_ESPACE_MAINNET).toHaveProperty('name');
      expect(CONFLUX_ESPACE_MAINNET).toHaveProperty('network');
      expect(CONFLUX_ESPACE_MAINNET).toHaveProperty('nativeCurrency');
      expect(CONFLUX_ESPACE_MAINNET).toHaveProperty('rpcUrls');
      expect(CONFLUX_ESPACE_MAINNET).toHaveProperty('blockExplorers');
      expect(CONFLUX_ESPACE_MAINNET).toHaveProperty('testnet');
    });

    it('should have different chain id from testnet', () => {
      expect(CONFLUX_ESPACE_MAINNET.id).not.toBe(CONFLUX_ESPACE_TESTNET.id);
    });

    it('should have same native currency as testnet', () => {
      expect(CONFLUX_ESPACE_MAINNET.nativeCurrency).toEqual(CONFLUX_ESPACE_TESTNET.nativeCurrency);
    });
  });

  describe('PRICE_FEED_IDS', () => {
    it('should have BTC_USD price feed id', () => {
      expect(PRICE_FEED_IDS.BTC_USD).toBe('0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43');
    });

    it('should have ETH_USD price feed id', () => {
      expect(PRICE_FEED_IDS.ETH_USD).toBe('0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace');
    });

    it('should have CFX_USD price feed id', () => {
      expect(PRICE_FEED_IDS.CFX_USD).toBe('0x8879170230c9603342f3837cf9a8e76c61791198fb1271bb2552c9af7b33c933');
    });

    it('should have exactly 3 price feed ids', () => {
      expect(Object.keys(PRICE_FEED_IDS)).toHaveLength(3);
    });

    it('should have all price feed ids as valid hex strings', () => {
      Object.values(PRICE_FEED_IDS).forEach((feedId) => {
        expect(feedId).toMatch(/^0x[a-f0-9]{64}$/);
      });
    });

    it('should have all price feed ids starting with 0x', () => {
      Object.values(PRICE_FEED_IDS).forEach((feedId) => {
        expect(feedId).toMatch(/^0x/);
      });
    });

    it('should have unique price feed ids', () => {
      const feedIds = Object.values(PRICE_FEED_IDS);
      const uniqueIds = new Set(feedIds);
      expect(uniqueIds.size).toBe(feedIds.length);
    });

    it('should be immutable (readonly)', () => {
      const originalValue = PRICE_FEED_IDS.BTC_USD;
      
      expect(() => {
        PRICE_FEED_IDS.BTC_USD = 'new-value';
      }).toThrow();
      
      expect(PRICE_FEED_IDS.BTC_USD).toBe(originalValue);
    });
  });

  describe('CONTRACT_ADDRESSES', () => {
    it('should have PYTH_ORACLE address', () => {
      expect(CONTRACT_ADDRESSES.PYTH_ORACLE).toBe('0xe9d69CdD6Fe41e7B621B4A688C5D1a68cB5c8ADc');
    });

    it('should have PRICE_CONSUMER address', () => {
      expect(CONTRACT_ADDRESSES.PRICE_CONSUMER).toBe('0x540182717b8A2D723f9Fc0218558a7De224e8b17');
    });

    it('should have BETTING address', () => {
      expect(CONTRACT_ADDRESSES.BETTING).toBe('0x6a5D4C136B20C3946f38B2b76eddd56452eA4156');
    });

    it('should have LENDING address', () => {
      expect(CONTRACT_ADDRESSES.LENDING).toBe('0x0FC5A8c24b13E4178911a739866A0E7c27d90345');
    });

    it('should have FEE_MANAGER address', () => {
      expect(CONTRACT_ADDRESSES.FEE_MANAGER).toBe('0x1A45Bd20Db43f9E47e07D8529e0831F3883223e3');
    });

    it('should have FALLBACK_ORACLE address', () => {
      expect(CONTRACT_ADDRESSES.FALLBACK_ORACLE).toBe('0x6B1D3d3c054bd0F12d75752e83EfD1210BDac24E');
    });

    it('should have exactly 6 contract addresses', () => {
      expect(Object.keys(CONTRACT_ADDRESSES)).toHaveLength(6);
    });

    it('should have all addresses as valid Ethereum addresses', () => {
      Object.values(CONTRACT_ADDRESSES).forEach((address) => {
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
    });

    it('should have all addresses starting with 0x', () => {
      Object.values(CONTRACT_ADDRESSES).forEach((address) => {
        expect(address.startsWith('0x')).toBe(true);
      });
    });

    it('should have all addresses with correct length (42 characters)', () => {
      Object.values(CONTRACT_ADDRESSES).forEach((address) => {
        expect(address).toHaveLength(42);
      });
    });

    it('should have unique contract addresses', () => {
      const addresses = Object.values(CONTRACT_ADDRESSES);
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(addresses.length);
    });

    it('should be immutable (readonly)', () => {
      const originalValue = CONTRACT_ADDRESSES.PYTH_ORACLE;
      
      expect(() => {
        CONTRACT_ADDRESSES.PYTH_ORACLE = '0x0000000000000000000000000000000000000000';
      }).toThrow();
      
      expect(CONTRACT_ADDRESSES.PYTH_ORACLE).toBe(originalValue);
    });
  });

  describe('PYTH_CONFIG', () => {
    it('should have WEBSOCKET_URL', () => {
      expect(PYTH_CONFIG.WEBSOCKET_URL).toBe('wss://hermes.pyth.network/ws');
    });

    it('should have API_URL', () => {
      expect(PYTH_CONFIG.API_URL).toBe('https://hermes.pyth.network');
    });

    it('should have REFRESH_INTERVAL', () => {
      expect(PYTH_CONFIG.REFRESH_INTERVAL).toBe(10000);
    });

    it('should have exactly 3 configuration properties', () => {
      expect(Object.keys(PYTH_CONFIG)).toHaveLength(3);
    });

    it('should have WEBSOCKET_URL as WebSocket protocol', () => {
      expect(PYTH_CONFIG.WEBSOCKET_URL.startsWith('wss://')).toBe(true);
    });

    it('should have API_URL as HTTPS protocol', () => {
      expect(PYTH_CONFIG.API_URL.startsWith('https://')).toBe(true);
    });

    it('should have REFRESH_INTERVAL as positive number', () => {
      expect(PYTH_CONFIG.REFRESH_INTERVAL).toBeGreaterThan(0);
      expect(typeof PYTH_CONFIG.REFRESH_INTERVAL).toBe('number');
    });

    it('should have REFRESH_INTERVAL in milliseconds (10 seconds)', () => {
      expect(PYTH_CONFIG.REFRESH_INTERVAL).toBe(10 * 1000);
    });

    it('should be immutable (readonly)', () => {
      const originalValue = PYTH_CONFIG.REFRESH_INTERVAL;
      
      expect(() => {
        PYTH_CONFIG.REFRESH_INTERVAL = 5000;
      }).toThrow();
      
      expect(PYTH_CONFIG.REFRESH_INTERVAL).toBe(originalValue);
    });
  });

  describe('Configuration Integration', () => {
    it('should have both mainnet and testnet configurations', () => {
      expect(CONFLUX_ESPACE_MAINNET).toBeDefined();
      expect(CONFLUX_ESPACE_TESTNET).toBeDefined();
    });

    it('should have consistent CFX currency across networks', () => {
      expect(CONFLUX_ESPACE_MAINNET.nativeCurrency.symbol).toBe('CFX');
      expect(CONFLUX_ESPACE_TESTNET.nativeCurrency.symbol).toBe('CFX');
    });

    it('should have all required price feeds defined', () => {
      expect(PRICE_FEED_IDS.BTC_USD).toBeDefined();
      expect(PRICE_FEED_IDS.ETH_USD).toBeDefined();
      expect(PRICE_FEED_IDS.CFX_USD).toBeDefined();
    });

    it('should have all critical contracts defined', () => {
      expect(CONTRACT_ADDRESSES.PYTH_ORACLE).toBeDefined();
      expect(CONTRACT_ADDRESSES.PRICE_CONSUMER).toBeDefined();
    });

    it('should have valid Pyth configuration', () => {
      expect(PYTH_CONFIG.WEBSOCKET_URL).toContain('pyth.network');
      expect(PYTH_CONFIG.API_URL).toContain('pyth.network');
    });
  });
});