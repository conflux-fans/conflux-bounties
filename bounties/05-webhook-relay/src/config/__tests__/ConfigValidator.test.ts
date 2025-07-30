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
            message: 'Event signature is required and must be a string'
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
  });
});