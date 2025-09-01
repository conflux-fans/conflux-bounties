import { ConfigValidator } from '../ConfigValidator';

describe('ConfigValidator', () => {
  let validator: ConfigValidator;

  beforeEach(() => {
    validator = new ConfigValidator();
  });

  describe('validateNetworkConfig', () => {
    it('should validate correct network configuration', () => {
      const config = {
        rpcUrl: 'https://evm.confluxrpc.com',
        wsUrl: 'wss://evm.confluxrpc.com/ws',
        chainId: 1030,
        confirmations: 12
      };

      const result = validator.validateNetworkConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error when network config is missing', () => {
      const result = validator.validateNetworkConfig(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'network',
        message: 'Network configuration is required'
      });
    });

    it('should return error for invalid RPC URL', () => {
      const config = {
        rpcUrl: 'invalid-url',
        chainId: 1030,
        confirmations: 12
      };

      const result = validator.validateNetworkConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'network.rpcUrl',
        message: 'RPC URL must be a valid URL',
        value: 'invalid-url'
      });
    });

    it('should return error for missing RPC URL', () => {
      const config = {
        chainId: 1030,
        confirmations: 12
      };

      const result = validator.validateNetworkConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'network.rpcUrl',
        message: 'RPC URL is required and must be a string',
        value: undefined
      });
    });

    it('should return error for invalid WebSocket URL', () => {
      const config = {
        rpcUrl: 'https://evm.confluxrpc.com',
        wsUrl: 'invalid-ws-url',
        chainId: 1030,
        confirmations: 12
      };

      const result = validator.validateNetworkConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'network.wsUrl',
        message: 'WebSocket URL must be a valid URL',
        value: 'invalid-ws-url'
      });
    });

    it('should return error for invalid chain ID', () => {
      const config = {
        rpcUrl: 'https://evm.confluxrpc.com',
        chainId: -1,
        confirmations: 12
      };

      const result = validator.validateNetworkConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'network.chainId',
        message: 'Chain ID must be a positive number',
        value: -1
      });
    });

    it('should return error for invalid confirmations', () => {
      const config = {
        rpcUrl: 'https://evm.confluxrpc.com',
        chainId: 1030,
        confirmations: -1
      };

      const result = validator.validateNetworkConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'network.confirmations',
        message: 'Confirmations must be a non-negative number',
        value: -1
      });
    });

    it('should accept valid WebSocket URL protocols', () => {
      const testCases = [
        'wss://example.com/ws',
        'ws://example.com/ws',
        'https://example.com',
        'http://example.com'
      ];

      testCases.forEach(wsUrl => {
        const config = {
          rpcUrl: 'https://evm.confluxrpc.com',
          wsUrl,
          chainId: 1030,
          confirmations: 12
        };

        const result = validator.validateNetworkConfig(config);
        expect(result.isValid).toBe(true);
      });
    });

    it('should return error for non-string WebSocket URL', () => {
      const config = {
        rpcUrl: 'https://evm.confluxrpc.com',
        wsUrl: 123, // non-string value
        chainId: 1030,
        confirmations: 12
      };

      const result = validator.validateNetworkConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'network.wsUrl',
        message: 'WebSocket URL must be a string',
        value: 123
      });
    });
  });

  describe('validateDatabaseConfig', () => {
    it('should validate correct database configuration', () => {
      const config = {
        url: 'postgresql://user:pass@localhost:5432/db',
        poolSize: 10,
        connectionTimeout: 5000
      };

      const result = validator.validateDatabaseConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error when database config is missing', () => {
      const result = validator.validateDatabaseConfig(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'database',
        message: 'Database configuration is required'
      });
    });

    it('should return error for invalid database URL', () => {
      const config = {
        url: 'invalid-db-url',
        poolSize: 10,
        connectionTimeout: 5000
      };

      const result = validator.validateDatabaseConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'database.url',
        message: 'Database URL must be a valid PostgreSQL connection string',
        value: 'invalid-db-url'
      });
    });

    it('should accept postgres and postgresql protocols', () => {
      const testCases = [
        'postgresql://user:pass@localhost:5432/db',
        'postgres://user:pass@localhost:5432/db'
      ];

      testCases.forEach(url => {
        const config = {
          url,
          poolSize: 10,
          connectionTimeout: 5000
        };

        const result = validator.validateDatabaseConfig(config);
        expect(result.isValid).toBe(true);
      });
    });

    it('should return error for invalid pool size', () => {
      const config = {
        url: 'postgresql://user:pass@localhost:5432/db',
        poolSize: 0,
        connectionTimeout: 5000
      };

      const result = validator.validateDatabaseConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'database.poolSize',
        message: 'Pool size must be a positive number',
        value: 0
      });
    });

    it('should return error for invalid connection timeout', () => {
      const config = {
        url: 'postgresql://user:pass@localhost:5432/db',
        poolSize: 10,
        connectionTimeout: -1
      };

      const result = validator.validateDatabaseConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'database.connectionTimeout',
        message: 'Connection timeout must be a positive number',
        value: -1
      });
    });

    it('should return error for missing database URL', () => {
      const config = {
        poolSize: 10,
        connectionTimeout: 5000
      };

      const result = validator.validateDatabaseConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'database.url',
        message: 'Database URL is required and must be a string',
        value: undefined
      });
    });
  });

  describe('validateSubscriptions', () => {
    it('should validate correct subscriptions array', () => {
      const subscriptions = [
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
      ];

      const result = validator.validateSubscriptions(subscriptions);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error when subscriptions is not an array', () => {
      const result = validator.validateSubscriptions('not-an-array' as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'subscriptions',
        message: 'Subscriptions must be an array',
        value: 'not-an-array'
      });
    });

    it('should return error for invalid subscription object', () => {
      const subscriptions = [
        {
          id: '',
          contractAddress: 'invalid-address',
          eventSignature: '',
          filters: {},
          webhooks: []
        }
      ];

      const result = validator.validateSubscriptions(subscriptions);

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
          }),
          expect.objectContaining({
            field: 'subscriptions[0].eventSignature',
            message: 'Event signature is required'
          })
        ])
      );
    });

    it('should validate Ethereum addresses correctly', () => {
      const validAddresses = [
        '0x1234567890123456789012345678901234567890',
        '0xABCDEF1234567890123456789012345678901234',
        '0xabcdef1234567890123456789012345678901234'
      ];

      const invalidAddresses = [
        '1234567890123456789012345678901234567890', // missing 0x
        '0x123456789012345678901234567890123456789', // too short
        '0x12345678901234567890123456789012345678901', // too long
        '0xGHIJKL1234567890123456789012345678901234' // invalid hex
      ];

      validAddresses.forEach(address => {
        const subscriptions = [{
          id: 'test',
          contractAddress: address,
          eventSignature: 'Test()',
          filters: {},
          webhooks: [{
            id: 'webhook',
            url: 'https://example.com',
            format: 'generic',
            headers: {},
            timeout: 30000,
            retryAttempts: 3
          }]
        }];

        const result = validator.validateSubscriptions(subscriptions);
        expect(result.errors.filter(e => e.field.includes('contractAddress'))).toHaveLength(0);
      });

      invalidAddresses.forEach(address => {
        const subscriptions = [{
          id: 'test',
          contractAddress: address,
          eventSignature: 'Test()',
          filters: {},
          webhooks: [{
            id: 'webhook',
            url: 'https://example.com',
            format: 'generic',
            headers: {},
            timeout: 30000,
            retryAttempts: 3
          }]
        }];

        const result = validator.validateSubscriptions(subscriptions);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'subscriptions[0].contractAddress',
            message: 'Contract address must be a valid Ethereum address'
          })
        );
      });
    });

    it('should validate webhook configurations', () => {
      const subscriptions = [
        {
          id: 'test-subscription',
          contractAddress: '0x1234567890123456789012345678901234567890',
          eventSignature: 'Transfer(address,address,uint256)',
          filters: {},
          webhooks: [
            {
              id: '',
              url: 'invalid-url',
              format: 'invalid-format',
              headers: 'not-an-object',
              timeout: -1,
              retryAttempts: -1
            }
          ]
        }
      ];

      const result = validator.validateSubscriptions(subscriptions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'subscriptions[0].webhooks[0].id',
            message: 'Webhook ID is required and must be a string'
          }),
          expect.objectContaining({
            field: 'subscriptions[0].webhooks[0].url',
            message: 'Webhook URL must be a valid URL'
          }),
          expect.objectContaining({
            field: 'subscriptions[0].webhooks[0].format',
            message: 'Webhook format must be one of: zapier, make, n8n, generic'
          }),
          expect.objectContaining({
            field: 'subscriptions[0].webhooks[0].headers',
            message: 'Webhook headers must be an object'
          }),
          expect.objectContaining({
            field: 'subscriptions[0].webhooks[0].timeout',
            message: 'Webhook timeout must be a positive number'
          }),
          expect.objectContaining({
            field: 'subscriptions[0].webhooks[0].retryAttempts',
            message: 'Webhook retry attempts must be a non-negative number'
          })
        ])
      );
    });

    it('should validate webhook formats correctly', () => {
      const validFormats = ['zapier', 'make', 'n8n', 'generic'];
      const invalidFormats = ['invalid', 'webhook', 'json'];

      validFormats.forEach(format => {
        const subscriptions = [{
          id: 'test',
          contractAddress: '0x1234567890123456789012345678901234567890',
          eventSignature: 'Test()',
          filters: {},
          webhooks: [{
            id: 'webhook',
            url: 'https://example.com',
            format,
            headers: {},
            timeout: 30000,
            retryAttempts: 3
          }]
        }];

        const result = validator.validateSubscriptions(subscriptions);
        expect(result.errors.filter(e => e.field.includes('format'))).toHaveLength(0);
      });

      invalidFormats.forEach(format => {
        const subscriptions = [{
          id: 'test',
          contractAddress: '0x1234567890123456789012345678901234567890',
          eventSignature: 'Test()',
          filters: {},
          webhooks: [{
            id: 'webhook',
            url: 'https://example.com',
            format,
            headers: {},
            timeout: 30000,
            retryAttempts: 3
          }]
        }];

        const result = validator.validateSubscriptions(subscriptions);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'subscriptions[0].webhooks[0].format',
            message: 'Webhook format must be one of: zapier, make, n8n, generic'
          })
        );
      });
    });

    it('should return error for non-object subscription', () => {
      const subscriptions = [
        'not-an-object' // This should trigger line 99
      ];

      const result = validator.validateSubscriptions(subscriptions as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'subscriptions[0]',
        message: 'Subscription must be an object',
        value: 'not-an-object'
      });
    });

    it('should return error for missing subscription fields', () => {
      const subscriptions = [
        {
          // Missing id, contractAddress, eventSignature
          filters: {},
          webhooks: []
        }
      ];

      const result = validator.validateSubscriptions(subscriptions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'subscriptions[0].id',
            message: 'Subscription ID is required and must be a string',
            value: undefined
          }),
          expect.objectContaining({
            field: 'subscriptions[0].contractAddress',
            message: 'Contract address is required',
            value: undefined
          }),
          expect.objectContaining({
            field: 'subscriptions[0].eventSignature',
            message: 'Event signature is required',
            value: undefined
          })
        ])
      );
    });

    it('should return error for non-string subscription fields', () => {
      const subscriptions = [
        {
          id: 123, // non-string
          contractAddress: 456, // non-string
          eventSignature: 789, // non-string
          filters: 'not-an-object', // non-object
          webhooks: 'not-an-array' // non-array
        }
      ];

      const result = validator.validateSubscriptions(subscriptions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'subscriptions[0].id',
            message: 'Subscription ID is required and must be a string',
            value: 123
          }),
          expect.objectContaining({
            field: 'subscriptions[0].contractAddress',
            message: 'Contract address must be a string or array of strings',
            value: 456
          }),
          expect.objectContaining({
            field: 'subscriptions[0].eventSignature',
            message: 'Event signature must be a string or array of strings',
            value: 789
          }),
          expect.objectContaining({
            field: 'subscriptions[0].filters',
            message: 'Filters must be an object',
            value: 'not-an-object'
          }),
          expect.objectContaining({
            field: 'subscriptions[0].webhooks',
            message: 'Webhooks must be an array',
            value: 'not-an-array'
          })
        ])
      );
    });

    it('should return error for non-object webhook', () => {
      const subscriptions = [
        {
          id: 'test-subscription',
          contractAddress: '0x1234567890123456789012345678901234567890',
          eventSignature: 'Transfer(address,address,uint256)',
          filters: {},
          webhooks: [
            'not-an-object' // This should trigger line 142
          ]
        }
      ];

      const result = validator.validateSubscriptions(subscriptions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'subscriptions[0].webhooks[0]',
        message: 'Webhook must be an object',
        value: 'not-an-object'
      });
    });

    it('should return error for missing webhook fields', () => {
      const subscriptions = [
        {
          id: 'test-subscription',
          contractAddress: '0x1234567890123456789012345678901234567890',
          eventSignature: 'Transfer(address,address,uint256)',
          filters: {},
          webhooks: [
            {
              // Missing id, url, format, timeout, retryAttempts
              headers: {}
            }
          ]
        }
      ];

      const result = validator.validateSubscriptions(subscriptions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'subscriptions[0].webhooks[0].id',
            message: 'Webhook ID is required and must be a string',
            value: undefined
          }),
          expect.objectContaining({
            field: 'subscriptions[0].webhooks[0].url',
            message: 'Webhook URL is required and must be a string',
            value: undefined
          }),
          expect.objectContaining({
            field: 'subscriptions[0].webhooks[0].format',
            message: 'Webhook format must be one of: zapier, make, n8n, generic',
            value: undefined
          }),
          expect.objectContaining({
            field: 'subscriptions[0].webhooks[0].timeout',
            message: 'Webhook timeout must be a positive number',
            value: undefined
          }),
          expect.objectContaining({
            field: 'subscriptions[0].webhooks[0].retryAttempts',
            message: 'Webhook retry attempts must be a non-negative number',
            value: undefined
          })
        ])
      );
    });
  });

  describe('validateRedisConfig', () => {
    it('should validate correct Redis configuration', () => {
      const config = {
        url: 'redis://localhost:6379',
        keyPrefix: 'webhook-relay:',
        ttl: 3600
      };

      const result = validator.validateRedisConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Redis configuration with minimal required fields', () => {
      const config = {
        url: 'redis://localhost:6379'
      };

      const result = validator.validateRedisConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error when Redis config is missing', () => {
      const result = validator.validateRedisConfig(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'redis',
        message: 'Redis configuration is required when provided'
      });
    });

    it('should return error for missing Redis URL', () => {
      const config = {
        keyPrefix: 'webhook-relay:',
        ttl: 3600
      };

      const result = validator.validateRedisConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'redis.url',
        message: 'Redis URL is required and must be a string',
        value: undefined
      });
    });

    it('should return error for invalid Redis URL', () => {
      const config = {
        url: 'invalid-redis-url',
        keyPrefix: 'webhook-relay:',
        ttl: 3600
      };

      const result = validator.validateRedisConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'redis.url',
        message: 'Redis URL must be a valid Redis connection string',
        value: 'invalid-redis-url'
      });
    });

    it('should accept valid Redis URL protocols', () => {
      const testCases = [
        'redis://localhost:6379',
        'rediss://localhost:6380',
        'redis://user:pass@localhost:6379/0',
        'rediss://user:pass@localhost:6380/1'
      ];

      testCases.forEach(url => {
        const config = {
          url,
          keyPrefix: 'webhook-relay:',
          ttl: 3600
        };

        const result = validator.validateRedisConfig(config);
        expect(result.isValid).toBe(true);
      });
    });

    it('should return error for non-string Redis URL', () => {
      const config = {
        url: 123, // non-string value
        keyPrefix: 'webhook-relay:',
        ttl: 3600
      };

      const result = validator.validateRedisConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'redis.url',
        message: 'Redis URL is required and must be a string',
        value: 123
      });
    });

    it('should return error for invalid key prefix type', () => {
      const config = {
        url: 'redis://localhost:6379',
        keyPrefix: 123, // non-string value
        ttl: 3600
      };

      const result = validator.validateRedisConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'redis.keyPrefix',
        message: 'Redis key prefix must be a string',
        value: 123
      });
    });

    it('should return error for invalid TTL', () => {
      const config = {
        url: 'redis://localhost:6379',
        keyPrefix: 'webhook-relay:',
        ttl: -1 // invalid TTL
      };

      const result = validator.validateRedisConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'redis.ttl',
        message: 'Redis TTL must be a positive number',
        value: -1
      });
    });

    it('should return error for non-number TTL', () => {
      const config = {
        url: 'redis://localhost:6379',
        keyPrefix: 'webhook-relay:',
        ttl: 'invalid' // non-number value
      };

      const result = validator.validateRedisConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'redis.ttl',
        message: 'Redis TTL must be a positive number',
        value: 'invalid'
      });
    });
  });
});