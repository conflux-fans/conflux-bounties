import { WS_URL, API_URL, CONTRACT_ADDRESS, CHAIN_ID, PYTH_ENDPOINT } from '../lib/env';

describe('env configuration', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  describe('WS_URL', () => {
    it('should use default value', () => {
      delete process.env.VITE_WS_URL;
      jest.resetModules();
      const { WS_URL } = require('../lib/env');
      expect(WS_URL).toBe('ws://localhost:3001');
    });

    it('should use custom value from env', () => {
      process.env.VITE_WS_URL = 'ws://custom.com';
      jest.resetModules();
      const { WS_URL } = require('../lib/env');
      expect(WS_URL).toBe('ws://custom.com');
    });

    it('should use fallback for empty string', () => {
      process.env.VITE_WS_URL = '';
      jest.resetModules();
      const { WS_URL } = require('../lib/env');
      expect(WS_URL).toBe('ws://localhost:3001');
    });
  });

  describe('API_URL', () => {
    it('should use default value', () => {
      delete process.env.VITE_API_URL;
      jest.resetModules();
      const { API_URL } = require('../lib/env');
      expect(API_URL).toBe('http://localhost:3000');
    });

    it('should use custom value from env', () => {
      process.env.VITE_API_URL = 'https://api.prod.com';
      jest.resetModules();
      const { API_URL } = require('../lib/env');
      expect(API_URL).toBe('https://api.prod.com');
    });
  });

  describe('CONTRACT_ADDRESS', () => {
    it('should use default value', () => {
      delete process.env.VITE_CONTRACT_ADDRESS;
      jest.resetModules();
      const { CONTRACT_ADDRESS } = require('../lib/env');
      expect(CONTRACT_ADDRESS).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should use custom value from env', () => {
      process.env.VITE_CONTRACT_ADDRESS = '0xABCDEF0123456789ABCDEF0123456789ABCDEF01';
      jest.resetModules();
      const { CONTRACT_ADDRESS } = require('../lib/env');
      expect(CONTRACT_ADDRESS).toBe('0xABCDEF0123456789ABCDEF0123456789ABCDEF01');
    });

    it('should match Ethereum address format', () => {
      delete process.env.VITE_CONTRACT_ADDRESS;
      jest.resetModules();
      const { CONTRACT_ADDRESS } = require('../lib/env');
      expect(CONTRACT_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('CHAIN_ID', () => {
    it('should use default value', () => {
      delete process.env.VITE_CHAIN_ID;
      jest.resetModules();
      const { CHAIN_ID } = require('../lib/env');
      expect(CHAIN_ID).toBe(1030);
    });

    it('should parse to number', () => {
      process.env.VITE_CHAIN_ID = '42';
      jest.resetModules();
      const { CHAIN_ID } = require('../lib/env');
      expect(CHAIN_ID).toBe(42);
      expect(typeof CHAIN_ID).toBe('number');
    });

    it('should handle zero', () => {
      process.env.VITE_CHAIN_ID = '0';
      jest.resetModules();
      const { CHAIN_ID } = require('../lib/env');
      expect(CHAIN_ID).toBe(0);
    });

    it('should handle negative', () => {
      process.env.VITE_CHAIN_ID = '-1';
      jest.resetModules();
      const { CHAIN_ID } = require('../lib/env');
      expect(CHAIN_ID).toBe(-1);
    });

    it('should handle large numbers', () => {
      process.env.VITE_CHAIN_ID = '999999999';
      jest.resetModules();
      const { CHAIN_ID } = require('../lib/env');
      expect(CHAIN_ID).toBe(999999999);
    });

    it('should handle invalid as NaN', () => {
      process.env.VITE_CHAIN_ID = 'invalid';
      jest.resetModules();
      const { CHAIN_ID } = require('../lib/env');
      expect(isNaN(CHAIN_ID)).toBe(true);
    });
  });

  describe('PYTH_ENDPOINT', () => {
    it('should use default value', () => {
      delete process.env.VITE_PYTH_ENDPOINT;
      jest.resetModules();
      const { PYTH_ENDPOINT } = require('../lib/env');
      expect(PYTH_ENDPOINT).toBe('https://hermes.pyth.network');
    });

    it('should use custom value from env', () => {
      process.env.VITE_PYTH_ENDPOINT = 'https://custom-pyth.com';
      jest.resetModules();
      const { PYTH_ENDPOINT } = require('../lib/env');
      expect(PYTH_ENDPOINT).toBe('https://custom-pyth.com');
    });
  });

  describe('getEnvVar function behavior', () => {
    it('should prioritize process.env', () => {
      process.env.VITE_WS_URL = 'ws://test.com';
      jest.resetModules();
      const { WS_URL } = require('../lib/env');
      expect(WS_URL).toBe('ws://test.com');
    });

    it('should handle all variables together', () => {
      process.env.VITE_WS_URL = 'ws://all.com';
      process.env.VITE_API_URL = 'https://api.all.com';
      process.env.VITE_CONTRACT_ADDRESS = '0x1111111111111111111111111111111111111111';
      process.env.VITE_CHAIN_ID = '5';
      process.env.VITE_PYTH_ENDPOINT = 'https://pyth.all.com';
      
      jest.resetModules();
      const env = require('../lib/env');
      
      expect(env.WS_URL).toBe('ws://all.com');
      expect(env.API_URL).toBe('https://api.all.com');
      expect(env.CONTRACT_ADDRESS).toBe('0x1111111111111111111111111111111111111111');
      expect(env.CHAIN_ID).toBe(5);
      expect(env.PYTH_ENDPOINT).toBe('https://pyth.all.com');
    });
  });

  describe('Type validation', () => {
    it('should have correct types', () => {
      jest.resetModules();
      const env = require('../lib/env');
      
      expect(typeof env.WS_URL).toBe('string');
      expect(typeof env.API_URL).toBe('string');
      expect(typeof env.CONTRACT_ADDRESS).toBe('string');
      expect(typeof env.CHAIN_ID).toBe('number');
      expect(typeof env.PYTH_ENDPOINT).toBe('string');
    });

    it('should not be empty', () => {
      delete process.env.VITE_WS_URL;
      delete process.env.VITE_API_URL;
      delete process.env.VITE_CONTRACT_ADDRESS;
      delete process.env.VITE_PYTH_ENDPOINT;
      
      jest.resetModules();
      const env = require('../lib/env');
      
      expect(env.WS_URL.length).toBeGreaterThan(0);
      expect(env.API_URL.length).toBeGreaterThan(0);
      expect(env.CONTRACT_ADDRESS.length).toBeGreaterThan(0);
      expect(env.PYTH_ENDPOINT.length).toBeGreaterThan(0);
    });
  });
});