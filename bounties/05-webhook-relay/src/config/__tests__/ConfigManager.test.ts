import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigManager } from '../ConfigManager';
import { SystemConfig } from '../../types';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock fs.watch
const mockWatch = jest.fn();
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  watch: mockWatch
}));

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let mockConfig: SystemConfig;
  const testConfigPath = 'test-config.json';
  const originalNodeEnv = process.env['NODE_ENV'];

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['NODE_ENV'] = 'test';
    
    // Mock fs.watch to return an async iterable
    mockWatch.mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        // Empty async iterator for tests
      }
    });
    
    configManager = new ConfigManager(testConfigPath);
    
    mockConfig = {
      network: {
        rpcUrl: 'https://evm.confluxrpc.com',
        wsUrl: 'wss://evm.confluxrpc.com/ws',
        chainId: 1030,
        confirmations: 12
      },
      subscriptions: [
        {
          id: 'test-subscription',
          contractAddress: '0x1234567890123456789012345678901234567890',
          eventSignature: 'Transfer(address,address,uint256)',
          filters: {},
          webhooks: [
            {
              id: 'test-webhook',
              url: 'https://example.com/webhook',
              format: 'generic',
              headers: {},
              timeout: 30000,
              retryAttempts: 3
            }
          ]
        }
      ],
      database: {
        url: 'postgresql://user:pass@localhost:5432/db',
        poolSize: 10,
        connectionTimeout: 5000
      },
      redis: {
        url: 'redis://localhost:6379',
        keyPrefix: 'webhook-relay:',
        ttl: 3600
      },
      monitoring: {
        logLevel: 'info',
        metricsEnabled: true,
        healthCheckPort: 3001
      },
      options: {
        maxConcurrentWebhooks: 10,
        defaultRetryAttempts: 3,
        defaultRetryDelay: 1000,
        webhookTimeout: 30000,
        queueProcessingInterval: 5000
      }
    };
  });

  afterEach(() => {
    configManager.stopWatching();
    process.env['NODE_ENV'] = originalNodeEnv;
  });

  describe('loadConfig', () => {
    it('should load and validate configuration from file', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const config = await configManager.loadConfig();

      expect(config).toEqual(mockConfig);
      expect(mockFs.readFile).toHaveBeenCalledWith(path.resolve(testConfigPath), 'utf-8');
    });

    it('should throw error when config file does not exist', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFs.readFile.mockRejectedValue(error);

      await expect(configManager.loadConfig()).rejects.toThrow('Configuration file not found');
    });

    it('should throw error when config file has invalid JSON', async () => {
      mockFs.readFile.mockResolvedValue('invalid json');

      await expect(configManager.loadConfig()).rejects.toThrow('Failed to parse configuration file');
    });

    it('should throw error when configuration validation fails', async () => {
      const invalidConfig = { ...mockConfig };
      delete (invalidConfig as any).network;
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

      await expect(configManager.loadConfig()).rejects.toThrow('Configuration validation failed');
    });

    it('should apply environment variable overrides', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        CONFLUX_RPC_URL: 'https://override.rpc.url',
        DATABASE_URL: 'postgresql://override:pass@localhost:5432/db',
        LOG_LEVEL: 'debug',
        MAX_CONCURRENT_WEBHOOKS: '20'
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const config = await configManager.loadConfig();

      expect(config.network.rpcUrl).toBe('https://override.rpc.url');
      expect(config.database.url).toBe('postgresql://override:pass@localhost:5432/db');
      expect(config.monitoring.logLevel).toBe('debug');
      expect(config.options.maxConcurrentWebhooks).toBe(20);

      process.env = originalEnv;
    });
  });

  describe('validateConfig', () => {
    it('should return valid result for correct configuration', () => {
      const result = configManager.validateConfig(mockConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid network config', () => {
      const invalidConfig = {
        ...mockConfig,
        network: {
          ...mockConfig.network,
          rpcUrl: 'invalid-url',
          chainId: -1
        }
      };

      const result = configManager.validateConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'network.rpcUrl',
            message: 'RPC URL must be a valid URL'
          }),
          expect.objectContaining({
            field: 'network.chainId',
            message: 'Chain ID must be a positive number'
          })
        ])
      );
    });

    it('should return validation errors for invalid database config', () => {
      const invalidConfig = {
        ...mockConfig,
        database: {
          ...mockConfig.database,
          url: 'invalid-db-url',
          poolSize: 0
        }
      };

      const result = configManager.validateConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'database.url',
            message: 'Database URL must be a valid PostgreSQL connection string'
          }),
          expect.objectContaining({
            field: 'database.poolSize',
            message: 'Pool size must be a positive number'
          })
        ])
      );
    });

    it('should return validation errors for invalid subscriptions', () => {
      const invalidConfig = {
        ...mockConfig,
        subscriptions: [
          {
            id: '',
            contractAddress: 'invalid-address',
            eventSignature: '',
            filters: {},
            webhooks: []
          }
        ]
      };

      const result = configManager.validateConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'subscriptions[0].id',
            message: 'Subscription ID is required and must be a string'
          }),
          expect.objectContaining({
            field: 'subscriptions[0].contractAddress',
            message: 'Contract address must be a valid Ethereum address'
          })
        ])
      );
    });
  });

  describe('reloadConfig', () => {
    it('should reload configuration and emit configChanged event', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));
      
      const configChangedSpy = jest.fn();
      configManager.onConfigChange(configChangedSpy);

      await configManager.reloadConfig();

      expect(configChangedSpy).toHaveBeenCalledWith(mockConfig);
    });

    it('should handle reload errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Read error'));

      await expect(configManager.reloadConfig()).rejects.toThrow('Failed to load configuration');
    });
  });

  describe('onConfigChange', () => {
    it('should register callback for configuration changes', async () => {
      const callback = jest.fn();
      configManager.onConfigChange(callback);

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));
      await configManager.reloadConfig();

      expect(callback).toHaveBeenCalledWith(mockConfig);
    });

    it('should support multiple callbacks', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      configManager.onConfigChange(callback1);
      configManager.onConfigChange(callback2);

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));
      await configManager.reloadConfig();

      expect(callback1).toHaveBeenCalledWith(mockConfig);
      expect(callback2).toHaveBeenCalledWith(mockConfig);
    });
  });

  describe('getCurrentConfig', () => {
    it('should return null when no config is loaded', () => {
      expect(configManager.getCurrentConfig()).toBeNull();
    });

    it('should return current config after loading', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));
      
      await configManager.loadConfig();
      
      expect(configManager.getCurrentConfig()).toEqual(mockConfig);
    });
  });

  describe('environment variable overrides', () => {
    const envTestCases = [
      {
        env: { CONFLUX_RPC_URL: 'https://test.rpc' },
        expectedPath: 'network.rpcUrl',
        expectedValue: 'https://test.rpc'
      },
      {
        env: { CONFLUX_WS_URL: 'wss://test.ws' },
        expectedPath: 'network.wsUrl',
        expectedValue: 'wss://test.ws'
      },
      {
        env: { CONFLUX_CHAIN_ID: '1337' },
        expectedPath: 'network.chainId',
        expectedValue: 1337
      },
      {
        env: { DATABASE_URL: 'postgresql://test:test@localhost/test' },
        expectedPath: 'database.url',
        expectedValue: 'postgresql://test:test@localhost/test'
      },
      {
        env: { REDIS_URL: 'redis://test:6379' },
        expectedPath: 'redis.url',
        expectedValue: 'redis://test:6379'
      },
      {
        env: { LOG_LEVEL: 'error' },
        expectedPath: 'monitoring.logLevel',
        expectedValue: 'error'
      },
      {
        env: { METRICS_ENABLED: 'false' },
        expectedPath: 'monitoring.metricsEnabled',
        expectedValue: false
      },
      {
        env: { MAX_CONCURRENT_WEBHOOKS: '50' },
        expectedPath: 'options.maxConcurrentWebhooks',
        expectedValue: 50
      }
    ];

    envTestCases.forEach(({ env, expectedPath, expectedValue }) => {
      it(`should override ${expectedPath} with environment variable`, async () => {
        const originalEnv = process.env;
        process.env = { ...originalEnv, ...env };

        mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

        const config = await configManager.loadConfig();
        const pathParts = expectedPath.split('.');
        let value = config;
        for (const part of pathParts) {
          value = (value as any)[part];
        }

        expect(value).toBe(expectedValue);

        process.env = originalEnv;
      });
    });
  });
});