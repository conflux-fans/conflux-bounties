import { SystemConfig } from '../../src/types/config';
import { EventSubscription } from '../../src/types';
import { v4 as uuidv4 } from 'uuid';

export class ConfigFactory {
  static createSystemConfig(overrides: Partial<SystemConfig> = {}): SystemConfig {
    return {
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
      },
      subscriptions: [
        this.createEventSubscription()
      ],
      ...overrides
    };
  }

  static createEventSubscription(overrides: Partial<EventSubscription> = {}): EventSubscription {
    return {
      id: uuidv4(),
      contractAddress: '0x1234567890123456789012345678901234567890',
      eventSignature: 'Transfer(address,address,uint256)',
      filters: {
        from: '0x0000000000000000000000000000000000000000'
      },
      webhooks: [
        {
          id: uuidv4(),
          url: 'https://webhook.example.com/test',
          format: 'generic',
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
          retryAttempts: 3
        }
      ],
      ...overrides
    };
  }

  static createTestConfig(overrides: Partial<SystemConfig> = {}): SystemConfig {
    return this.createSystemConfig(overrides);
  }

  static createTestnetConfig(): SystemConfig {
    return this.createSystemConfig({
      network: {
        rpcUrl: 'https://evmtestnet.confluxrpc.com',
        wsUrl: 'wss://evmtestnet.confluxrpc.com/ws',
        chainId: 71,
        confirmations: 1
      }
    });
  }
}