import { ConfigFactory } from '../ConfigFactory';
import { SystemConfig, EventSubscription } from '../../../src/types';

describe('ConfigFactory', () => {
  describe('createSystemConfig', () => {
    it('should create a default system config', () => {
      const config = ConfigFactory.createSystemConfig();

      expect(config).toMatchObject({
        network: {
          rpcUrl: 'https://evmtestnet.confluxrpc.com',
          wsUrl: 'wss://evmtestnet.confluxrpc.com/ws',
          chainId: 71,
          confirmations: 1
        },
        database: {
          url: 'postgresql://webhook_user:webhook_pass@postgres:5432/webhook_relay_test',
          poolSize: 10,
          connectionTimeout: 30000
        },
        redis: {
          url: 'redis://redis:6379',
          keyPrefix: 'webhook_relay:test:',
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
          queueProcessingInterval: 1000
        }
      });

      expect(config.subscriptions).toHaveLength(1);
      expect(config.subscriptions[0]).toMatchObject({
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventSignature: 'Transfer(address,address,uint256)',
        filters: {
          from: '0x0000000000000000000000000000000000000000'
        }
      });
    });

    it('should apply overrides to system config', () => {
      const overrides: Partial<SystemConfig> = {
        network: {
          rpcUrl: 'https://custom.rpc.url',
          wsUrl: 'wss://custom.ws.url',
          chainId: 999,
          confirmations: 5
        },
        options: {
          maxConcurrentWebhooks: 20,
          defaultRetryAttempts: 5,
          defaultRetryDelay: 2000,
          webhookTimeout: 60000,
          queueProcessingInterval: 2000
        }
      };

      const config = ConfigFactory.createSystemConfig(overrides);

      expect(config.network).toEqual(overrides.network);
      expect(config.options).toEqual(overrides.options);
      // Other properties should remain default
      expect(config.database?.url).toBe('postgresql://webhook_user:webhook_pass@postgres:5432/webhook_relay_test');
    });

    it('should handle partial overrides', () => {
      const overrides: Partial<SystemConfig> = {
        monitoring: {
          logLevel: 'debug',
          metricsEnabled: false,
          healthCheckPort: 4001
        }
      };

      const config = ConfigFactory.createSystemConfig(overrides);

      expect(config.monitoring).toEqual(overrides.monitoring);
      expect(config.network.chainId).toBe(71); // Should remain default
    });

    it('should handle empty subscriptions override', () => {
      const config = ConfigFactory.createSystemConfig({ subscriptions: [] });

      expect(config.subscriptions).toHaveLength(0);
    });

    it('should handle multiple subscriptions override', () => {
      const customSubscriptions = [
        ConfigFactory.createEventSubscription({ contractAddress: '0xabc123' }),
        ConfigFactory.createEventSubscription({ contractAddress: '0xdef456' })
      ];

      const config = ConfigFactory.createSystemConfig({ subscriptions: customSubscriptions });

      expect(config.subscriptions).toHaveLength(2);
      expect(config.subscriptions[0]!.contractAddress).toBe('0xabc123');
      expect(config.subscriptions[1]!.contractAddress).toBe('0xdef456');
    });
  });

  describe('createEventSubscription', () => {
    it('should create a default event subscription', () => {
      const subscription = ConfigFactory.createEventSubscription();

      expect(subscription).toMatchObject({
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventSignature: 'Transfer(address,address,uint256)',
        filters: {
          from: '0x0000000000000000000000000000000000000000'
        }
      });

      expect(subscription.id).toBeDefined();
      expect(typeof subscription.id).toBe('string');
      expect(subscription.webhooks).toHaveLength(1);
      expect(subscription.webhooks[0]).toMatchObject({
        url: 'https://webhook.example.com/test',
        format: 'generic',
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        retryAttempts: 3
      });
    });

    it('should apply overrides to event subscription', () => {
      const overrides: Partial<EventSubscription> = {
        contractAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
        eventSignature: 'Approval(address,address,uint256)',
        filters: {
          owner: '0x1111111111111111111111111111111111111111',
          spender: '0x2222222222222222222222222222222222222222'
        }
      };

      const subscription = ConfigFactory.createEventSubscription(overrides);

      expect(subscription.contractAddress).toBe(overrides.contractAddress);
      expect(subscription.eventSignature).toBe(overrides.eventSignature);
      expect(subscription.filters).toEqual(overrides.filters);
      expect(subscription.webhooks).toHaveLength(1); // Should remain default
    });

    it('should generate unique IDs for each subscription', () => {
      const subscription1 = ConfigFactory.createEventSubscription();
      const subscription2 = ConfigFactory.createEventSubscription();

      expect(subscription1.id).not.toBe(subscription2.id);
      expect(subscription1.webhooks[0]!.id).not.toBe(subscription2.webhooks[0]!.id);
    });

    it('should handle custom webhooks override', () => {
      const customWebhooks = [
        {
          id: 'webhook-1',
          url: 'https://zapier.com/hooks/catch/123/abc',
          format: 'zapier' as const,
          headers: { 'Authorization': 'Bearer token123' },
          timeout: 15000,
          retryAttempts: 5
        },
        {
          id: 'webhook-2',
          url: 'https://make.com/webhook/456',
          format: 'make' as const,
          headers: {},
          timeout: 20000,
          retryAttempts: 2
        }
      ];

      const subscription = ConfigFactory.createEventSubscription({ webhooks: customWebhooks });

      expect(subscription.webhooks).toHaveLength(2);
      expect(subscription.webhooks).toEqual(customWebhooks);
    });

    it('should handle empty filters', () => {
      const subscription = ConfigFactory.createEventSubscription({ filters: {} });

      expect(subscription.filters).toEqual({});
    });

    it('should handle complex filter expressions', () => {
      const complexFilters = {
        from: '0x0000000000000000000000000000000000000000',
        to: ['0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222'],
        value: { operator: 'gt', value: '1000000000000000000' }
      };

      const subscription = ConfigFactory.createEventSubscription({ filters: complexFilters });

      expect(subscription.filters).toEqual(complexFilters);
    });
  });

  describe('createTestConfig', () => {
    it('should create test configuration with overrides', () => {
      const overrides: Partial<SystemConfig> = {
        monitoring: {
          logLevel: 'debug',
          metricsEnabled: false,
          healthCheckPort: 9999
        }
      };

      const config = ConfigFactory.createTestConfig(overrides);

      expect(config.monitoring).toEqual(overrides.monitoring);
      expect(config.network.chainId).toBe(71); // Should remain default
    });

    it('should create test configuration without overrides', () => {
      const config = ConfigFactory.createTestConfig();

      // Should have the same structure as default config
      expect(config.network.chainId).toBe(71);
      expect(config.database?.url).toBe('postgresql://webhook_user:webhook_pass@postgres:5432/webhook_relay_test');
      expect(config.monitoring.logLevel).toBe('info');
      expect(config.subscriptions).toHaveLength(1);
    });
  });

  describe('createTestnetConfig', () => {
    it('should create testnet configuration', () => {
      const config = ConfigFactory.createTestnetConfig();

      expect(config.network).toEqual({
        rpcUrl: 'https://evmtestnet.confluxrpc.com',
        wsUrl: 'wss://evmtestnet.confluxrpc.com/ws',
        chainId: 71,
        confirmations: 1
      });

      // Other properties should remain the same as default
      expect(config.database?.url).toBe('postgresql://webhook_user:webhook_pass@postgres:5432/webhook_relay_test');
      expect(config.monitoring.logLevel).toBe('info');
      expect(config.subscriptions).toHaveLength(1);
    });

    it('should maintain all other default properties', () => {
      const defaultConfig = ConfigFactory.createSystemConfig();
      const testnetConfig = ConfigFactory.createTestnetConfig();

      // Network should be same
      expect(testnetConfig.network).toEqual(defaultConfig.network);

      // Everything else should be the same
      expect(testnetConfig.database).toEqual(defaultConfig.database);
      expect(testnetConfig.redis).toEqual(defaultConfig.redis);
      expect(testnetConfig.monitoring).toEqual(defaultConfig.monitoring);
      expect(testnetConfig.options).toEqual(defaultConfig.options);
      expect(testnetConfig.subscriptions).toHaveLength(defaultConfig.subscriptions.length);
    });
  });

  describe('integration with other components', () => {
    it('should create valid configuration for application startup', () => {
      const config = ConfigFactory.createSystemConfig();

      // Validate required properties exist
      expect(config.network.rpcUrl).toBeTruthy();
      expect(config.network.chainId).toBeGreaterThan(0);
      expect(config.database?.url).toBeTruthy();
      expect(config.options.maxConcurrentWebhooks).toBeGreaterThan(0);
      expect(config.subscriptions.length).toBeGreaterThanOrEqual(0);
    });

    it('should create configuration compatible with different environments', () => {
      const prodConfig = ConfigFactory.createSystemConfig({
        network: {
          rpcUrl: 'https://evm.confluxrpc.com',
          wsUrl: 'wss://evm.confluxrpc.com/ws',
          chainId: 1030,
          confirmations: 3
        },
        monitoring: {
          logLevel: 'warn',
          metricsEnabled: true,
          healthCheckPort: 8080
        }
      });

      const devConfig = ConfigFactory.createTestnetConfig();

      expect(prodConfig.network.chainId).toBe(1030);
      expect(devConfig.network.chainId).toBe(71);
      expect(prodConfig.monitoring.logLevel).toBe('warn');
      expect(devConfig.monitoring.logLevel).toBe('info');
    });
  });
});