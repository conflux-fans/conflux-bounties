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
    // Clean up any environment overrides from previous tests
    const envKeysToCleanup = [
      "CONFLUX_RPC_URL", "CONFLUX_WS_URL", "CONFLUX_CHAIN_ID", "CONFLUX_CONFIRMATIONS",
      "DATABASE_URL", "DATABASE_POOL_SIZE", "DATABASE_CONNECTION_TIMEOUT",
      "REDIS_URL", "REDIS_KEY_PREFIX", "REDIS_TTL",
      "LOG_LEVEL", "METRICS_ENABLED", "HEALTH_CHECK_PORT",
      "MAX_CONCURRENT_WEBHOOKS", "DEFAULT_RETRY_ATTEMPTS", "DEFAULT_RETRY_DELAY",
      "WEBHOOK_TIMEOUT", "QUEUE_PROCESSING_INTERVAL"
    ];
    envKeysToCleanup.forEach(key => delete process.env[key]);
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
        logLevel: 'error', // Set to match test environment
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
      const error = new Error('File not found') as Error & { code: string };
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
      const originalEnv = { ...process.env };
      process.env = {
        ...originalEnv,
        CONFLUX_RPC_URL: 'https://override.rpc.url',
        DATABASE_URL: 'postgresql://override:pass@localhost:5432/db',
        LOG_LEVEL: 'debug'
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const config = await configManager.loadConfig();

      expect(config.network.rpcUrl).toBe('https://override.rpc.url');
      expect(config.database?.url).toBe('postgresql://override:pass@localhost:5432/db');
      expect(config.monitoring.logLevel).toBe('debug');

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

  describe('environment-first configuration', () => {
    it('should create database config from DATABASE_URL when missing from config.json', async () => {
      const originalEnv = { ...process.env };
      process.env = { ...originalEnv, DATABASE_URL: 'postgresql://env:pass@localhost:5432/envdb' };

      const configWithoutDatabase = { ...mockConfig };
      delete (configWithoutDatabase as any).database;

      mockFs.readFile.mockResolvedValue(JSON.stringify(configWithoutDatabase));

      const config = await configManager.loadConfig();

      expect(config.database).toBeDefined();
      expect(config.database?.url).toBe('postgresql://env:pass@localhost:5432/envdb');
      expect(config.database?.poolSize).toBe(10); // Default value
      expect(config.database?.connectionTimeout).toBe(5000); // Default value

      process.env = originalEnv;
    });

    it('should create database config with all fields from environment variables', async () => {
      const originalEnv = { ...process.env };
      process.env = { 
        ...originalEnv, 
        DATABASE_URL: 'postgresql://env:pass@localhost:5432/envdb',
        DATABASE_POOL_SIZE: '20',
        DATABASE_CONNECTION_TIMEOUT: '10000'
      };

      const configWithoutDatabase = { ...mockConfig };
      delete (configWithoutDatabase as any).database;

      mockFs.readFile.mockResolvedValue(JSON.stringify(configWithoutDatabase));

      const config = await configManager.loadConfig();

      expect(config.database).toBeDefined();
      expect(config.database?.url).toBe('postgresql://env:pass@localhost:5432/envdb');
      expect(config.database?.poolSize).toBe(20); // From environment
      expect(config.database?.connectionTimeout).toBe(10000); // From environment

      process.env = originalEnv;
    });

    it('should create redis config from REDIS_URL when missing from config.json', async () => {
      const originalEnv = { ...process.env };
      process.env = { ...originalEnv, REDIS_URL: 'redis://env:6379' };

      const configWithoutRedis = { ...mockConfig };
      delete (configWithoutRedis as any).redis;

      mockFs.readFile.mockResolvedValue(JSON.stringify(configWithoutRedis));

      const config = await configManager.loadConfig();

      expect(config.redis).toBeDefined();
      expect(config.redis?.url).toBe('redis://env:6379');
      expect(config.redis?.keyPrefix).toBe('webhook-relay:'); // Default value
      expect(config.redis?.ttl).toBe(3600); // Default value

      process.env = originalEnv;
    });

    it('should create redis config with all fields from environment variables', async () => {
      const originalEnv = { ...process.env };
      process.env = { 
        ...originalEnv, 
        REDIS_URL: 'redis://env:6379',
        REDIS_KEY_PREFIX: 'custom-prefix:',
        REDIS_TTL: '7200'
      };

      const configWithoutRedis = { ...mockConfig };
      delete (configWithoutRedis as any).redis;

      mockFs.readFile.mockResolvedValue(JSON.stringify(configWithoutRedis));

      const config = await configManager.loadConfig();

      expect(config.redis).toBeDefined();
      expect(config.redis?.url).toBe('redis://env:6379');
      expect(config.redis?.keyPrefix).toBe('custom-prefix:'); // From environment
      expect(config.redis?.ttl).toBe(7200); // From environment

      process.env = originalEnv;
    });

    it('should apply defaults to existing database config when optional parameters are missing', async () => {
      const configWithPartialDatabase = {
        ...mockConfig,
        database: {
          url: 'postgresql://partial:pass@localhost:5432/db'
          // poolSize and connectionTimeout are missing
        }
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(configWithPartialDatabase));

      const config = await configManager.loadConfig();

      expect(config.database?.url).toBe('postgresql://partial:pass@localhost:5432/db');
      expect(config.database?.poolSize).toBe(10); // Default value
      expect(config.database?.connectionTimeout).toBe(5000); // Default value
    });

    it('should apply defaults to existing redis config when optional parameters are missing', async () => {
      const configWithPartialRedis = {
        ...mockConfig,
        redis: {
          url: 'redis://partial:6379'
          // keyPrefix and ttl are missing
        }
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(configWithPartialRedis));

      const config = await configManager.loadConfig();

      expect(config.redis?.url).toBe('redis://partial:6379');
      expect(config.redis?.keyPrefix).toBe('webhook-relay:'); // Default value
      expect(config.redis?.ttl).toBe(3600); // Default value
    });

    it('should fail validation when neither config.json sections nor environment variables are provided', async () => {
      const configWithoutDatabaseAndRedis = { ...mockConfig };
      delete (configWithoutDatabaseAndRedis as any).database;
      delete (configWithoutDatabaseAndRedis as any).redis;

      mockFs.readFile.mockResolvedValue(JSON.stringify(configWithoutDatabaseAndRedis));

      await expect(configManager.loadConfig()).rejects.toThrow('Configuration validation failed');
    });

    it('should validate successfully when DATABASE_URL is provided but database section is missing', async () => {
      const originalEnv = { ...process.env };
      process.env = { 
        ...originalEnv, 
        DATABASE_URL: 'postgresql://env:pass@localhost:5432/envdb',
        REDIS_URL: 'redis://env:6379'
      };

      const configWithoutDatabaseAndRedis = { ...mockConfig };
      delete (configWithoutDatabaseAndRedis as any).database;
      delete (configWithoutDatabaseAndRedis as any).redis;

      mockFs.readFile.mockResolvedValue(JSON.stringify(configWithoutDatabaseAndRedis));

      const config = await configManager.loadConfig();

      expect(config.database).toBeDefined();
      expect(config.redis).toBeDefined();

      process.env = originalEnv;
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
        env: { DATABASE_URL: 'postgresql://test:test@localhost/test', DATABASE_POOL_SIZE: '25' },
        expectedPath: 'database.poolSize',
        expectedValue: 25
      },
      {
        env: { DATABASE_URL: 'postgresql://test:test@localhost/test', DATABASE_CONNECTION_TIMEOUT: '15000' },
        expectedPath: 'database.connectionTimeout',
        expectedValue: 15000
      },
      {
        env: { REDIS_URL: 'redis://test:6379' },
        expectedPath: 'redis.url',
        expectedValue: 'redis://test:6379'
      },
      {
        env: { REDIS_URL: 'redis://test:6379', REDIS_KEY_PREFIX: 'test-prefix:' },
        expectedPath: 'redis.keyPrefix',
        expectedValue: 'test-prefix:'
      },
      {
        env: { REDIS_URL: 'redis://test:6379', REDIS_TTL: '1800' },
        expectedPath: 'redis.ttl',
        expectedValue: 1800
      },
      {
        env: { LOG_LEVEL: 'error' },
        expectedPath: 'monitoring.logLevel',
        expectedValue: 'error'
      }
    ];

    envTestCases.forEach(({ env, expectedPath, expectedValue }) => {
      it(`should override ${expectedPath} with environment variable`, async () => {
        const originalEnv = { ...process.env };
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

    // Additional environment variable overrides to cover uncovered lines
    it('should override network.confirmations with environment variable', async () => {
      const originalEnv = { ...process.env };
      process.env = { ...originalEnv, CONFLUX_CONFIRMATIONS: '24' };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const config = await configManager.loadConfig();
      expect(config.network.confirmations).toBe(24);

      process.env = originalEnv;
    });


  });

  describe('validation error scenarios', () => {
    it('should return validation errors for missing database config when no environment variable is provided', () => {
      const invalidConfig = { ...mockConfig };
      delete (invalidConfig as any).database;

      const result = configManager.validateConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'database',
        message: 'Database configuration is required. Provide either a database section in config.json or set DATABASE_URL environment variable.'
      });
    });

    it('should return validation errors for missing redis config when no environment variable is provided', () => {
      const invalidConfig = { ...mockConfig };
      delete (invalidConfig as any).redis;

      const result = configManager.validateConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'redis',
        message: 'Redis configuration is required. Provide either a redis section in config.json or set REDIS_URL environment variable.'
      });
    });

    it('should return validation errors for invalid redis config', () => {
      const invalidConfig = {
        ...mockConfig,
        redis: {
          url: '',
          keyPrefix: 123 as any, // Invalid type
          ttl: -1
        }
      };

      const result = configManager.validateConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'redis.url',
            message: 'Redis URL is required and must be a string'
          }),
          expect.objectContaining({
            field: 'redis.keyPrefix',
            message: 'Redis key prefix must be a string'
          }),
          expect.objectContaining({
            field: 'redis.ttl',
            message: 'Redis TTL must be a positive number'
          })
        ])
      );
    });

    it('should return validation errors for missing monitoring config', () => {
      const invalidConfig = { ...mockConfig };
      delete (invalidConfig as any).monitoring;

      const result = configManager.validateConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'monitoring',
        message: 'Monitoring configuration is required'
      });
    });

    it('should return validation errors for invalid monitoring config', () => {
      const invalidConfig = {
        ...mockConfig,
        monitoring: {
          logLevel: 'invalid',
          metricsEnabled: 'not-boolean' as any, // Cast to any to test validation
          healthCheckPort: 70000
        }
      };

      const result = configManager.validateConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'monitoring.logLevel',
            message: 'Log level must be one of: error, warn, info, debug'
          }),
          expect.objectContaining({
            field: 'monitoring.metricsEnabled',
            message: 'Metrics enabled must be a boolean'
          }),
          expect.objectContaining({
            field: 'monitoring.healthCheckPort',
            message: 'Health check port must be a number between 1 and 65535'
          })
        ])
      );
    });

    it('should return validation errors for missing system options config', () => {
      const invalidConfig = { ...mockConfig };
      delete (invalidConfig as any).options;

      const result = configManager.validateConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'options',
        message: 'System options configuration is required'
      });
    });

    it('should return validation errors for invalid system options config', () => {
      const invalidConfig = {
        ...mockConfig,
        options: {
          maxConcurrentWebhooks: 0,
          defaultRetryAttempts: -1,
          defaultRetryDelay: 0,
          webhookTimeout: -1,
          queueProcessingInterval: 0
        }
      };

      const result = configManager.validateConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'options.maxConcurrentWebhooks',
            message: 'Max concurrent webhooks must be a positive number'
          }),
          expect.objectContaining({
            field: 'options.defaultRetryAttempts',
            message: 'Default retry attempts must be a non-negative number'
          }),
          expect.objectContaining({
            field: 'options.defaultRetryDelay',
            message: 'Default retry delay must be a positive number'
          }),
          expect.objectContaining({
            field: 'options.webhookTimeout',
            message: 'Webhook timeout must be a positive number'
          }),
          expect.objectContaining({
            field: 'options.queueProcessingInterval',
            message: 'Queue processing interval must be a positive number'
          })
        ])
      );
    });

    it('should validate environment-generated database configuration correctly', () => {
      // Simulate a config that was generated from environment variables
      const configWithEnvDatabase = {
        ...mockConfig,
        database: {
          url: 'postgresql://env:pass@localhost:5432/envdb',
          poolSize: 10, // Default value applied by applyEnvironmentOverrides
          connectionTimeout: 5000 // Default value applied by applyEnvironmentOverrides
        }
      };

      const result = configManager.validateConfig(configWithEnvDatabase);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate environment-generated redis configuration correctly', () => {
      // Simulate a config that was generated from environment variables
      const configWithEnvRedis = {
        ...mockConfig,
        redis: {
          url: 'redis://env:6379',
          keyPrefix: 'webhook-relay:', // Default value applied by applyEnvironmentOverrides
          ttl: 3600 // Default value applied by applyEnvironmentOverrides
        }
      };

      const result = configManager.validateConfig(configWithEnvRedis);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid environment-generated database configuration', () => {
      // Simulate an invalid config that was generated from environment variables
      const configWithInvalidEnvDatabase = {
        ...mockConfig,
        database: {
          url: 'invalid-database-url', // Invalid URL from environment
          poolSize: 10,
          connectionTimeout: 5000
        }
      };

      const result = configManager.validateConfig(configWithInvalidEnvDatabase);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'database.url',
        message: 'Database URL must be a valid PostgreSQL connection string',
        value: 'invalid-database-url'
      });
    });

    it('should return validation errors for invalid environment-generated redis configuration', () => {
      // Simulate an invalid config that was generated from environment variables
      const configWithInvalidEnvRedis = {
        ...mockConfig,
        redis: {
          url: '', // Invalid empty URL from environment
          keyPrefix: 'webhook-relay:',
          ttl: 3600
        }
      };

      const result = configManager.validateConfig(configWithInvalidEnvRedis);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'redis.url',
        message: 'Redis URL is required and must be a string',
        value: ''
      });
    });
  });

  describe('file watcher', () => {
    it('should handle file watcher errors in non-test environment', async () => {
      const originalNodeEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      // Mock fs.watch to throw an error
      mockWatch.mockImplementation(() => {
        throw new Error('Watch failed');
      });

      const errorSpy = jest.fn();
      configManager.on('error', errorSpy);

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));
      await configManager.loadConfig();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to start config watcher')
        })
      );

      process.env['NODE_ENV'] = originalNodeEnv;
    });

    it('should handle config reload errors in file watcher', async () => {
      const mockWatcher = {
        on: jest.fn(),
        close: jest.fn()
      };

      mockWatch.mockReturnValue(mockWatcher);

      // First call succeeds for initial load
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfig));
      // Second call fails for reload
      mockFs.readFile.mockRejectedValueOnce(new Error('Reload failed'));

      const errorSpy = jest.fn();
      configManager.on('error', errorSpy);

      await configManager.loadConfig();

      // Simulate a change event that triggers reload
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      await changeHandler('change');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to reload configuration')
        })
      );
    });

    it('should handle watcher errors that are not AbortError', async () => {
      const mockWatcher = {
        on: jest.fn(),
        close: jest.fn()
      };

      mockWatch.mockReturnValue(mockWatcher);

      const errorSpy = jest.fn();
      configManager.on('error', errorSpy);

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));
      await configManager.loadConfig();

      // Simulate an error event that is not AbortError
      const errorHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'error')[1];
      errorHandler(new Error('Watcher error'));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Configuration watcher error')
        })
      );
    });

    it('should ignore AbortError from watcher', async () => {
      const mockWatcher = {
        on: jest.fn(),
        close: jest.fn()
      };

      mockWatch.mockReturnValue(mockWatcher);

      const errorSpy = jest.fn();
      configManager.on('error', errorSpy);

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));
      await configManager.loadConfig();

      // Simulate an AbortError event
      const errorHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'error')[1];
      const abortError = new Error('AbortError');
      (abortError as any).name = 'AbortError';
      errorHandler(abortError);

      // Should not emit error for AbortError
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
