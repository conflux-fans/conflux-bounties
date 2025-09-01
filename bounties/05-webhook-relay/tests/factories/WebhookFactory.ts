import { WebhookConfig } from '../../src/types/common';
import { v4 as uuidv4 } from 'uuid';

export class WebhookFactory {
  static createWebhookConfig(overrides: Partial<WebhookConfig> = {}): WebhookConfig {
    return {
      id: uuidv4(),
      url: 'https://webhook.example.com/endpoint',
      format: 'generic',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      timeout: 30000,
      retryAttempts: 3,
      ...overrides
    };
  }

  static createZapierWebhook(url?: string): WebhookConfig {
    return this.createWebhookConfig({
      url: url || 'https://hooks.zapier.com/hooks/catch/123456/abcdef',
      format: 'zapier',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  static createBatchWebhooks(count: number, baseConfig?: Partial<WebhookConfig>): WebhookConfig[] {
    return Array.from({ length: count }, (_, index) => 
      this.createWebhookConfig({
        ...baseConfig,
        url: `https://webhook-${index}.example.com/endpoint`,
        id: uuidv4()
      })
    );
  }
}