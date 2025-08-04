import { WebhookSender } from '../WebhookSender';
import type { IHttpClient, IDeliveryTracker } from '../interfaces';
import type { WebhookDelivery, WebhookConfig } from '../../types';

describe('WebhookSender', () => {
  let webhookSender: WebhookSender;
  let mockHttpClient: jest.Mocked<IHttpClient>;
  let mockDeliveryTracker: jest.Mocked<IDeliveryTracker>;

  beforeEach(() => {
    mockHttpClient = {
      post: jest.fn(),
    };

    mockDeliveryTracker = {
      trackDelivery: jest.fn(),
      getDeliveryStats: jest.fn(),
    };

    webhookSender = new WebhookSender(mockHttpClient, mockDeliveryTracker);
  });

  const createMockDelivery = (overrides: Partial<WebhookDelivery> = {}): WebhookDelivery => ({
    id: 'delivery-1',
    subscriptionId: 'sub-1',
    webhookId: 'webhook-1',
    event: {
      contractAddress: '0x123',
      eventName: 'Transfer',
      blockNumber: 12345,
      transactionHash: '0xabc',
      logIndex: 0,
      args: { from: '0x456', to: '0x789', value: '1000' },
      timestamp: new Date(),
    },
    payload: { test: 'data' },
    attempts: 1,
    maxAttempts: 3,
    status: 'pending' as const,
    ...overrides,
  });

  const createMockConfig = (overrides: Partial<WebhookConfig> = {}): WebhookConfig => ({
    id: 'webhook-1',
    url: 'https://example.com/webhook',
    format: 'generic' as const,
    headers: { 'Authorization': 'Bearer token' },
    timeout: 5000,
    retryAttempts: 3,
    ...overrides,
  });

  describe('sendWebhook', () => {
    it('should return error when webhook config not found', async () => {
      const delivery = createMockDelivery();

      const result = await webhookSender.sendWebhook(delivery);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Webhook configuration not found for ID: webhook-1');
      expect(mockDeliveryTracker.trackDelivery).toHaveBeenCalledWith(delivery, result);
    });

    it('should return error when webhook config is invalid', async () => {
      const delivery = createMockDelivery();
      const invalidConfig = createMockConfig({
        url: 'invalid-url',
        timeout: -1000,
      });

      webhookSender.setWebhookConfigForTesting('webhook-1', invalidConfig);

      const result = await webhookSender.sendWebhook(delivery);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid webhook configuration:');
      expect(result.error).toContain('Invalid URL format');
      expect(result.error).toContain('Timeout must be a positive number');
      expect(mockDeliveryTracker.trackDelivery).toHaveBeenCalledWith(delivery, result);
    });

    it('should successfully send webhook when config is valid', async () => {
      const delivery = createMockDelivery();
      const validConfig = createMockConfig();
      const mockResult = {
        success: true,
        statusCode: 200,
        responseTime: 150,
      };

      webhookSender.setWebhookConfigForTesting('webhook-1', validConfig);
      mockHttpClient.post.mockResolvedValue(mockResult);

      const result = await webhookSender.sendWebhook(delivery);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        validConfig.url,
        expect.objectContaining({
          contractAddress: delivery.event.contractAddress,
          eventName: delivery.event.eventName,
          blockNumber: delivery.event.blockNumber,
          transactionHash: delivery.event.transactionHash,
          logIndex: delivery.event.logIndex,
          args: delivery.event.args,
          timestamp: expect.any(String),
        }),
        validConfig.headers,
        validConfig.timeout
      );
      expect(mockDeliveryTracker.trackDelivery).toHaveBeenCalledWith(delivery, mockResult);
      expect(result).toEqual(mockResult);
    });

    it('should handle HTTP client errors gracefully', async () => {
      const delivery = createMockDelivery();
      const validConfig = createMockConfig();
      const httpError = new Error('Network connection failed');

      webhookSender.setWebhookConfigForTesting('webhook-1', validConfig);
      mockHttpClient.post.mockRejectedValue(httpError);

      const result = await webhookSender.sendWebhook(delivery);

      expect(result.success).toBe(false);
      expect(result.responseTime).toBe(0);
      expect(result.error).toBe('Network connection failed');
      expect(mockDeliveryTracker.trackDelivery).toHaveBeenCalledWith(delivery, result);
    });

    it('should handle non-Error exceptions from HTTP client', async () => {
      const delivery = createMockDelivery();
      const validConfig = createMockConfig();
      const nonErrorException = 'String error';

      webhookSender.setWebhookConfigForTesting('webhook-1', validConfig);
      mockHttpClient.post.mockRejectedValue(nonErrorException);

      const result = await webhookSender.sendWebhook(delivery);

      expect(result.success).toBe(false);
      expect(result.responseTime).toBe(0);
      expect(result.error).toBe('Unknown error during webhook delivery');
      expect(mockDeliveryTracker.trackDelivery).toHaveBeenCalledWith(delivery, result);
    });

    it('should handle failed webhook delivery with proper tracking', async () => {
      const delivery = createMockDelivery();
      const validConfig = createMockConfig();
      const mockResult = {
        success: false,
        statusCode: 500,
        responseTime: 200,
        error: 'Internal Server Error',
      };

      webhookSender.setWebhookConfigForTesting('webhook-1', validConfig);
      mockHttpClient.post.mockResolvedValue(mockResult);

      const result = await webhookSender.sendWebhook(delivery);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        validConfig.url,
        expect.objectContaining({
          contractAddress: delivery.event.contractAddress,
          eventName: delivery.event.eventName,
          blockNumber: delivery.event.blockNumber,
          transactionHash: delivery.event.transactionHash,
          logIndex: delivery.event.logIndex,
          args: delivery.event.args,
          timestamp: expect.any(String),
        }),
        validConfig.headers,
        validConfig.timeout
      );
      expect(mockDeliveryTracker.trackDelivery).toHaveBeenCalledWith(delivery, mockResult);
      expect(result).toEqual(mockResult);
    });
  });

  describe('validateWebhookConfig', () => {
    it('should validate a correct webhook configuration', () => {
      const config = createMockConfig();

      const result = webhookSender.validateWebhookConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    describe('URL validation', () => {
      it('should reject missing URL', () => {
        const config = createMockConfig({ url: '' });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'url',
          message: 'URL is required',
          value: '',
        });
      });

      it('should reject invalid URL format', () => {
        const config = createMockConfig({ url: 'not-a-url' });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'url',
          message: 'Invalid URL format',
          value: 'not-a-url',
        });
      });

      it('should reject non-HTTP/HTTPS protocols', () => {
        const config = createMockConfig({ url: 'ftp://example.com' });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'url',
          message: 'URL must use HTTP or HTTPS protocol',
          value: 'ftp://example.com',
        });
      });

      it('should accept valid HTTP URL', () => {
        const config = createMockConfig({ url: 'http://example.com/webhook' });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(true);
      });

      it('should accept valid HTTPS URL', () => {
        const config = createMockConfig({ url: 'https://example.com/webhook' });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(true);
      });
    });

    describe('format validation', () => {
      it('should accept valid formats', () => {
        const validFormats: Array<'zapier' | 'make' | 'n8n' | 'generic'> = ['zapier', 'make', 'n8n', 'generic'];

        validFormats.forEach(format => {
          const config = createMockConfig({ format });
          const result = webhookSender.validateWebhookConfig(config);
          expect(result.isValid).toBe(true);
        });
      });

      it('should reject invalid format', () => {
        const config = createMockConfig({ format: 'invalid' as any });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'format',
          message: 'Format must be one of: zapier, make, n8n, generic',
          value: 'invalid',
        });
      });
    });

    describe('timeout validation', () => {
      it('should reject non-number timeout', () => {
        const config = createMockConfig({ timeout: 'invalid' as any });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'timeout',
          message: 'Timeout must be a positive number',
          value: 'invalid',
        });
      });

      it('should reject zero timeout', () => {
        const config = createMockConfig({ timeout: 0 });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'timeout',
          message: 'Timeout must be a positive number',
          value: 0,
        });
      });

      it('should reject negative timeout', () => {
        const config = createMockConfig({ timeout: -1000 });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'timeout',
          message: 'Timeout must be a positive number',
          value: -1000,
        });
      });

      it('should reject timeout exceeding 5 minutes', () => {
        const config = createMockConfig({ timeout: 400000 }); // 6.67 minutes

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'timeout',
          message: 'Timeout cannot exceed 300000ms (5 minutes)',
          value: 400000,
        });
      });

      it('should accept valid timeout', () => {
        const config = createMockConfig({ timeout: 30000 });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(true);
      });
    });

    describe('retry attempts validation', () => {
      it('should reject non-number retry attempts', () => {
        const config = createMockConfig({ retryAttempts: 'invalid' as any });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'retryAttempts',
          message: 'Retry attempts must be a non-negative number',
          value: 'invalid',
        });
      });

      it('should reject negative retry attempts', () => {
        const config = createMockConfig({ retryAttempts: -1 });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'retryAttempts',
          message: 'Retry attempts must be a non-negative number',
          value: -1,
        });
      });

      it('should reject retry attempts exceeding 10', () => {
        const config = createMockConfig({ retryAttempts: 15 });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'retryAttempts',
          message: 'Retry attempts cannot exceed 10',
          value: 15,
        });
      });

      it('should accept zero retry attempts', () => {
        const config = createMockConfig({ retryAttempts: 0 });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(true);
      });

      it('should accept valid retry attempts', () => {
        const config = createMockConfig({ retryAttempts: 5 });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(true);
      });
    });

    describe('headers validation', () => {
      it('should reject non-object headers', () => {
        const config = createMockConfig({ headers: 'invalid' as any });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'headers',
          message: 'Headers must be an object',
          value: 'invalid',
        });
      });

      it('should reject empty header names', () => {
        const config = createMockConfig({ headers: { '': 'value' } });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'headers',
          message: 'Header names must be non-empty strings',
          value: '',
        });
      });

      it('should reject whitespace-only header names', () => {
        const config = createMockConfig({ headers: { '   ': 'value' } });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'headers',
          message: 'Header names must be non-empty strings',
          value: '   ',
        });
      });

      it('should reject non-string header values', () => {
        const config = createMockConfig({ headers: { 'Authorization': 123 } as any });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'headers',
          message: 'Header values must be strings',
          value: 123,
        });
      });

      it('should accept valid headers', () => {
        const config = createMockConfig({
          headers: {
            'Authorization': 'Bearer token',
            'X-Custom-Header': 'custom-value',
          },
        });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(true);
      });

      it('should accept empty headers object', () => {
        const config = createMockConfig({ headers: {} });

        const result = webhookSender.validateWebhookConfig(config);

        expect(result.isValid).toBe(true);
      });
    });

    it('should collect multiple validation errors', () => {
      const config = createMockConfig({
        url: 'invalid-url',
        format: 'invalid' as any,
        timeout: -1000,
        retryAttempts: 15,
        headers: 'invalid' as any,
      });

      const result = webhookSender.validateWebhookConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(5);
    });
  });

  describe('getDeliveryStats', () => {
    it('should delegate to delivery tracker', async () => {
      const mockStats = {
        totalDeliveries: 10,
        successfulDeliveries: 8,
        failedDeliveries: 2,
        averageResponseTime: 150,
      };

      mockDeliveryTracker.getDeliveryStats.mockResolvedValue(mockStats);

      const result = await webhookSender.getDeliveryStats('webhook-1');

      expect(mockDeliveryTracker.getDeliveryStats).toHaveBeenCalledWith('webhook-1');
      expect(result).toEqual(mockStats);
    });
  });

  describe('setWebhookConfigForTesting', () => {
    it('should set and remove webhook configs for testing', async () => {
      const config = createMockConfig();
      const delivery = createMockDelivery();
      const mockResult = {
        success: true,
        statusCode: 200,
        responseTime: 150,
      };

      // Set config
      webhookSender.setWebhookConfigForTesting('webhook-1', config);
      mockHttpClient.post.mockResolvedValue(mockResult);

      let result = await webhookSender.sendWebhook(delivery);
      expect(result.success).toBe(true);

      // Remove config by setting to null
      webhookSender.setWebhookConfigForTesting('webhook-1', null);

      result = await webhookSender.sendWebhook(delivery);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Webhook configuration not found for ID: webhook-1');
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should use circuit breaker to prevent delivery when open', async () => {
      const delivery = createMockDelivery();
      const validConfig = createMockConfig();

      webhookSender.setWebhookConfigForTesting('webhook-1', validConfig);

      // Get the circuit breaker and force it to open state
      const circuitBreaker = (webhookSender as any).getCircuitBreaker('webhook-1');
      
      // Mock circuit breaker to be in open state
      circuitBreaker.canExecute = jest.fn().mockReturnValue(false);
      circuitBreaker.getStats = jest.fn().mockReturnValue({
        state: 'open',
        nextAttemptTime: new Date(Date.now() + 60000).toISOString()
      });

      const result = await webhookSender.sendWebhook(delivery);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Circuit breaker is open for webhook webhook-1');
      expect(mockHttpClient.post).not.toHaveBeenCalled();
      expect(mockDeliveryTracker.trackDelivery).toHaveBeenCalledWith(delivery, result);
    });

    it('should record success in circuit breaker on successful delivery', async () => {
      const delivery = createMockDelivery();
      const validConfig = createMockConfig();
      const mockResult = {
        success: true,
        statusCode: 200,
        responseTime: 150,
      };

      webhookSender.setWebhookConfigForTesting('webhook-1', validConfig);
      mockHttpClient.post.mockResolvedValue(mockResult);

      // Get the circuit breaker and spy on its methods
      const circuitBreaker = (webhookSender as any).getCircuitBreaker('webhook-1');
      circuitBreaker.canExecute = jest.fn().mockReturnValue(true);
      circuitBreaker.recordSuccess = jest.fn();
      circuitBreaker.recordFailure = jest.fn();

      const result = await webhookSender.sendWebhook(delivery);

      expect(result.success).toBe(true);
      expect(circuitBreaker.recordSuccess).toHaveBeenCalled();
      expect(circuitBreaker.recordFailure).not.toHaveBeenCalled();
    });

    it('should record failure in circuit breaker on failed delivery', async () => {
      const delivery = createMockDelivery();
      const validConfig = createMockConfig();
      const mockResult = {
        success: false,
        statusCode: 500,
        responseTime: 200,
        error: 'Internal Server Error',
      };

      webhookSender.setWebhookConfigForTesting('webhook-1', validConfig);
      mockHttpClient.post.mockResolvedValue(mockResult);

      // Get the circuit breaker and spy on its methods
      const circuitBreaker = (webhookSender as any).getCircuitBreaker('webhook-1');
      circuitBreaker.canExecute = jest.fn().mockReturnValue(true);
      circuitBreaker.recordSuccess = jest.fn();
      circuitBreaker.recordFailure = jest.fn();

      const result = await webhookSender.sendWebhook(delivery);

      expect(result.success).toBe(false);
      expect(circuitBreaker.recordFailure).toHaveBeenCalled();
      expect(circuitBreaker.recordSuccess).not.toHaveBeenCalled();
    });

    it('should record failure in circuit breaker on HTTP client exception', async () => {
      const delivery = createMockDelivery();
      const validConfig = createMockConfig();
      const httpError = new Error('Network connection failed');

      webhookSender.setWebhookConfigForTesting('webhook-1', validConfig);
      mockHttpClient.post.mockRejectedValue(httpError);

      // Get the circuit breaker and spy on its methods
      const circuitBreaker = (webhookSender as any).getCircuitBreaker('webhook-1');
      circuitBreaker.canExecute = jest.fn().mockReturnValue(true);
      circuitBreaker.recordSuccess = jest.fn();
      circuitBreaker.recordFailure = jest.fn();

      const result = await webhookSender.sendWebhook(delivery);

      expect(result.success).toBe(false);
      expect(circuitBreaker.recordFailure).toHaveBeenCalled();
      expect(circuitBreaker.recordSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Payload Formatting', () => {
    it('should format payload according to webhook format', async () => {
      const delivery = createMockDelivery();
      const zapierConfig = createMockConfig({ format: 'zapier' });
      const mockResult = {
        success: true,
        statusCode: 200,
        responseTime: 150,
      };

      webhookSender.setWebhookConfigForTesting('webhook-1', zapierConfig);
      mockHttpClient.post.mockResolvedValue(mockResult);

      // Mock the formatPayload method
      const formatPayloadSpy = jest.spyOn(webhookSender as any, 'formatPayload');
      formatPayloadSpy.mockReturnValue({ formatted: 'zapier-payload' });

      await webhookSender.sendWebhook(delivery);

      expect(formatPayloadSpy).toHaveBeenCalledWith(delivery.event, 'zapier');
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        zapierConfig.url,
        { formatted: 'zapier-payload' },
        zapierConfig.headers,
        zapierConfig.timeout
      );

      formatPayloadSpy.mockRestore();
    });
  });

  describe('Private Methods Coverage', () => {
    it('should test getCircuitBreaker method creates and reuses circuit breakers', () => {
      const webhookId1 = 'webhook-1';
      const webhookId2 = 'webhook-2';

      // Get circuit breaker for first webhook
      const cb1a = (webhookSender as any).getCircuitBreaker(webhookId1);
      const cb1b = (webhookSender as any).getCircuitBreaker(webhookId1);

      // Get circuit breaker for second webhook
      const cb2 = (webhookSender as any).getCircuitBreaker(webhookId2);

      // Should reuse the same circuit breaker for same webhook ID
      expect(cb1a).toBe(cb1b);
      
      // Should create different circuit breakers for different webhook IDs
      expect(cb1a).not.toBe(cb2);
    });

    it('should test formatPayload method with different formats', () => {
      const event = {
        contractAddress: '0x123',
        eventName: 'Transfer',
        blockNumber: 12345,
        transactionHash: '0xabc',
        logIndex: 0,
        args: { from: '0x456', to: '0x789', value: '1000' },
        timestamp: new Date(),
      };

      // Test generic format
      const genericPayload = (webhookSender as any).formatPayload(event, 'generic');
      expect(genericPayload).toEqual({
        contractAddress: event.contractAddress,
        eventName: event.eventName,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
        args: event.args,
        timestamp: event.timestamp.toISOString(),
      });

      // Test other formats (they should use the formatter system)
      const zapierPayload = (webhookSender as any).formatPayload(event, 'zapier');
      expect(zapierPayload).toBeDefined();

      const makePayload = (webhookSender as any).formatPayload(event, 'make');
      expect(makePayload).toBeDefined();

      const n8nPayload = (webhookSender as any).formatPayload(event, 'n8n');
      expect(n8nPayload).toBeDefined();
    });

    it('should test getWebhookConfig method returns null for unknown webhook', () => {
      const config = (webhookSender as any).getWebhookConfig('unknown-webhook');
      expect(config).toBeNull();
    });
  });
});