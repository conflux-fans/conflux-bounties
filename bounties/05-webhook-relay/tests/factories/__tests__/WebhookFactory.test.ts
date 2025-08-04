import { WebhookFactory } from '../WebhookFactory';
import { WebhookConfig } from '../../../src/types/common';

describe('WebhookFactory', () => {
  describe('createWebhookConfig', () => {
    it('should create a default webhook configuration', () => {
      const webhook = WebhookFactory.createWebhookConfig();

      expect(webhook).toBeDefined();
      expect(webhook.id).toBeDefined();
      expect(webhook.url).toBe('https://webhook.example.com/endpoint');
      expect(webhook.format).toBe('generic');
      expect(webhook.timeout).toBe(30000);
      expect(webhook.retryAttempts).toBe(3);
    });

    it('should create webhook with correct headers', () => {
      const webhook = WebhookFactory.createWebhookConfig();

      expect(webhook.headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      });
    });

    it('should generate unique IDs for each webhook', () => {
      const webhook1 = WebhookFactory.createWebhookConfig();
      const webhook2 = WebhookFactory.createWebhookConfig();

      expect(webhook1.id).not.toBe(webhook2.id);
      expect(webhook1.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(webhook2.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should apply overrides correctly', () => {
      const overrides: Partial<WebhookConfig> = {
        url: 'https://custom.webhook.com/endpoint',
        format: 'zapier',
        timeout: 60000,
        retryAttempts: 5
      };

      const webhook = WebhookFactory.createWebhookConfig(overrides);

      expect(webhook.url).toBe(overrides.url);
      expect(webhook.format).toBe(overrides.format);
      expect(webhook.timeout).toBe(overrides.timeout);
      expect(webhook.retryAttempts).toBe(overrides.retryAttempts);
      // Non-overridden properties should remain default
      expect(webhook.headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      });
    });

    it('should allow overriding headers', () => {
      const customHeaders = {
        'Content-Type': 'application/xml',
        'X-API-Key': 'custom-api-key',
        'X-Custom-Header': 'custom-value'
      };

      const webhook = WebhookFactory.createWebhookConfig({
        headers: customHeaders
      });

      expect(webhook.headers).toEqual(customHeaders);
    });

    it('should allow overriding ID', () => {
      const customId = 'custom-webhook-id';
      const webhook = WebhookFactory.createWebhookConfig({
        id: customId
      });

      expect(webhook.id).toBe(customId);
    });

    it('should handle different webhook formats', () => {
      const formats: Array<WebhookConfig['format']> = ['generic', 'zapier', 'make', 'n8n'];

      formats.forEach(format => {
        const webhook = WebhookFactory.createWebhookConfig({ format });
        expect(webhook.format).toBe(format);
      });
    });

    it('should create webhook with valid URL', () => {
      const webhook = WebhookFactory.createWebhookConfig();
      expect(webhook.url).toMatch(/^https?:\/\/.+/);
    });

    it('should create webhook with positive timeout and retry values', () => {
      const webhook = WebhookFactory.createWebhookConfig();
      expect(webhook.timeout).toBeGreaterThan(0);
      expect(webhook.retryAttempts).toBeGreaterThan(0);
    });
  });

  describe('createZapierWebhook', () => {
    it('should create a Zapier-specific webhook configuration', () => {
      const webhook = WebhookFactory.createZapierWebhook();

      expect(webhook.format).toBe('zapier');
      expect(webhook.url).toBe('https://hooks.zapier.com/hooks/catch/123456/abcdef');
      expect(webhook.headers).toEqual({
        'Content-Type': 'application/json'
      });
    });

    it('should use custom URL when provided', () => {
      const customUrl = 'https://hooks.zapier.com/hooks/catch/999999/custom';
      const webhook = WebhookFactory.createZapierWebhook(customUrl);

      expect(webhook.url).toBe(customUrl);
      expect(webhook.format).toBe('zapier');
    });

    it('should inherit default properties for Zapier webhook', () => {
      const webhook = WebhookFactory.createZapierWebhook();

      expect(webhook.id).toBeDefined();
      expect(webhook.timeout).toBe(30000);
      expect(webhook.retryAttempts).toBe(3);
    });

    it('should create webhook with simplified headers for Zapier', () => {
      const webhook = WebhookFactory.createZapierWebhook();

      expect(webhook.headers).not.toHaveProperty('Authorization');
      expect(webhook.headers['Content-Type']).toBe('application/json');
    });

    it('should generate unique IDs for Zapier webhooks', () => {
      const webhook1 = WebhookFactory.createZapierWebhook();
      const webhook2 = WebhookFactory.createZapierWebhook();

      expect(webhook1.id).not.toBe(webhook2.id);
    });

    it('should create valid Zapier webhook URL format', () => {
      const webhook = WebhookFactory.createZapierWebhook();
      expect(webhook.url).toMatch(/^https:\/\/hooks\.zapier\.com\/hooks\/catch\/\d+\/[a-zA-Z0-9]+$/);
    });
  });

  describe('createBatchWebhooks', () => {
    it('should create specified number of webhooks', () => {
      const count = 5;
      const webhooks = WebhookFactory.createBatchWebhooks(count);

      expect(webhooks).toHaveLength(count);
      webhooks.forEach(webhook => {
        expect(webhook).toBeDefined();
        expect(webhook.format).toBe('generic');
      });
    });

    it('should create webhooks with unique IDs', () => {
      const count = 3;
      const webhooks = WebhookFactory.createBatchWebhooks(count);

      const ids = webhooks.map(webhook => webhook.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(count);
    });

    it('should create webhooks with unique URLs', () => {
      const count = 4;
      const webhooks = WebhookFactory.createBatchWebhooks(count);

      const urls = webhooks.map(webhook => webhook.url);
      const uniqueUrls = new Set(urls);
      expect(uniqueUrls.size).toBe(count);

      webhooks.forEach((webhook, index) => {
        expect(webhook.url).toBe(`https://webhook-${index}.example.com/endpoint`);
      });
    });

    it('should apply base configuration to all webhooks', () => {
      const count = 3;
      const baseConfig: Partial<WebhookConfig> = {
        format: 'zapier',
        timeout: 45000,
        retryAttempts: 5
      };

      const webhooks = WebhookFactory.createBatchWebhooks(count, baseConfig);

      webhooks.forEach(webhook => {
        expect(webhook.format).toBe(baseConfig.format);
        expect(webhook.timeout).toBe(baseConfig.timeout);
        expect(webhook.retryAttempts).toBe(baseConfig.retryAttempts);
      });
    });

    it('should handle zero count', () => {
      const webhooks = WebhookFactory.createBatchWebhooks(0);
      expect(webhooks).toHaveLength(0);
    });

    it('should handle large batch sizes', () => {
      const count = 50;
      const webhooks = WebhookFactory.createBatchWebhooks(count);

      expect(webhooks).toHaveLength(count);
      // Check first and last webhooks
      expect(webhooks[0]!.url).toBe('https://webhook-0.example.com/endpoint');
      expect(webhooks[49]!.url).toBe('https://webhook-49.example.com/endpoint');
    });

    it('should preserve custom headers in batch webhooks', () => {
      const customHeaders = {
        'X-API-Key': 'batch-api-key',
        'Content-Type': 'application/json'
      };

      const webhooks = WebhookFactory.createBatchWebhooks(2, {
        headers: customHeaders
      });

      webhooks.forEach(webhook => {
        expect(webhook.headers).toEqual(customHeaders);
      });
    });

    it('should allow overriding URL pattern in base config', () => {
      const baseConfig = {
        url: 'https://custom-base.com/webhook'
      };

      const webhooks = WebhookFactory.createBatchWebhooks(2, baseConfig);

      // URLs should still be unique despite base config
      expect(webhooks[0]!.url).toBe('https://webhook-0.example.com/endpoint');
      expect(webhooks[1]!.url).toBe('https://webhook-1.example.com/endpoint');
    });

    it('should create webhooks with consistent structure', () => {
      const webhooks = WebhookFactory.createBatchWebhooks(3);

      webhooks.forEach(webhook => {
        expect(typeof webhook.id).toBe('string');
        expect(typeof webhook.url).toBe('string');
        expect(typeof webhook.format).toBe('string');
        expect(typeof webhook.headers).toBe('object');
        expect(typeof webhook.timeout).toBe('number');
        expect(typeof webhook.retryAttempts).toBe('number');
      });
    });
  });

  describe('webhook validation', () => {
    it('should create webhooks with valid structure', () => {
      const webhook = WebhookFactory.createWebhookConfig();

      expect(typeof webhook.id).toBe('string');
      expect(typeof webhook.url).toBe('string');
      expect(typeof webhook.format).toBe('string');
      expect(typeof webhook.headers).toBe('object');
      expect(typeof webhook.timeout).toBe('number');
      expect(typeof webhook.retryAttempts).toBe('number');
    });

    it('should create webhooks with valid format values', () => {
      const validFormats = ['generic', 'zapier', 'make', 'n8n'];
      const webhook = WebhookFactory.createWebhookConfig();

      expect(validFormats).toContain(webhook.format);
    });

    it('should create webhooks with positive numeric values', () => {
      const webhook = WebhookFactory.createWebhookConfig();

      expect(webhook.timeout).toBeGreaterThan(0);
      expect(webhook.retryAttempts).toBeGreaterThan(0);
    });

    it('should create webhooks with valid URLs', () => {
      const webhook = WebhookFactory.createWebhookConfig();
      expect(webhook.url).toMatch(/^https?:\/\/.+/);
    });

    it('should create webhooks with non-empty IDs', () => {
      const webhook = WebhookFactory.createWebhookConfig();
      expect(webhook.id.length).toBeGreaterThan(0);
    });

    it('should create webhooks with headers object', () => {
      const webhook = WebhookFactory.createWebhookConfig();
      expect(webhook.headers).toBeDefined();
      expect(typeof webhook.headers).toBe('object');
      expect(webhook.headers).not.toBeNull();
    });
  });

  describe('integration with other factories', () => {
    it('should create webhook configs compatible with delivery factory', () => {
      const webhook = WebhookFactory.createWebhookConfig();

      // Verify the webhook has all properties needed for delivery
      expect(webhook.id).toBeDefined();
      expect(webhook.url).toBeDefined();
      expect(webhook.format).toBeDefined();
      expect(webhook.headers).toBeDefined();
      expect(webhook.timeout).toBeDefined();
      expect(webhook.retryAttempts).toBeDefined();
    });

    it('should create different webhook formats for testing', () => {
      const formats: Array<WebhookConfig['format']> = ['generic', 'zapier', 'make', 'n8n'];
      
      formats.forEach(format => {
        const webhook = WebhookFactory.createWebhookConfig({ format });
        expect(webhook.format).toBe(format);
      });
    });
  });
});