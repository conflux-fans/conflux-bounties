import { WebhookSender } from '../WebhookSender';
import type { IHttpClient, IDeliveryTracker } from '../interfaces';
import type { WebhookDelivery, WebhookConfig, DeliveryResult, BlockchainEvent } from '../../types';

describe('WebhookSender Formatting Integration', () => {
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

  const createSampleEvent = (): BlockchainEvent => ({
    contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
    eventName: 'Transfer',
    blockNumber: 12345678,
    transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    logIndex: 2,
    args: {
      from: '0x1111111111111111111111111111111111111111',
      to: '0x2222222222222222222222222222222222222222',
      value: '1000000000000000000',
      tokenId: 42,
      metadata: {
        name: 'Test Token',
        description: 'A test token for integration testing',
        attributes: [
          { trait_type: 'Color', value: 'Blue' },
          { trait_type: 'Rarity', value: 'Common' }
        ]
      }
    },
    timestamp: new Date('2023-12-01T10:30:00.000Z')
  });

  const createMockDelivery = (webhookId: string, event?: BlockchainEvent): WebhookDelivery => ({
    id: 'delivery-1',
    subscriptionId: 'sub-1',
    webhookId,
    event: event || createSampleEvent(),
    payload: {},
    attempts: 1,
    maxAttempts: 3,
    status: 'pending' as const,
  });

  const createMockConfig = (format: 'zapier' | 'make' | 'n8n' | 'generic', overrides: Partial<WebhookConfig> = {}): WebhookConfig => ({
    id: 'webhook-1',
    url: 'https://example.com/webhook',
    format,
    headers: { 'Content-Type': 'application/json' },
    timeout: 5000,
    retryAttempts: 3,
    ...overrides,
  });

  describe('Zapier format integration', () => {
    it('should format payload according to Zapier webhook standards (Requirement 3.1)', async () => {
      const config = createMockConfig('zapier');
      const delivery = createMockDelivery('webhook-1');
      const mockResult: DeliveryResult = { success: true, statusCode: 200, responseTime: 150 };

      webhookSender.setWebhookConfigForTesting('webhook-1', config);
      mockHttpClient.post.mockResolvedValue(mockResult);

      await webhookSender.sendWebhook(delivery);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          // Zapier format uses snake_case and flattened structure
          event_name: 'Transfer',
          contract_address: '0x1234567890abcdef1234567890abcdef12345678',
          block_number: 12345678,
          transaction_hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          log_index: 2,
          timestamp: '2023-12-01T10:30:00.000Z',
          // Flattened event arguments with arg_ prefix
          arg_from: '0x1111111111111111111111111111111111111111',
          arg_to: '0x2222222222222222222222222222222222222222',
          arg_value: '1000000000000000000',
          arg_token_id: 42,
          // Flattened nested metadata
          arg_metadata_name: 'Test Token',
          arg_metadata_description: 'A test token for integration testing',
          arg_metadata_attributes: [
            { trait_type: 'Color', value: 'Blue' },
            { trait_type: 'Rarity', value: 'Common' }
          ]
        }),
        config.headers,
        config.timeout
      );
    });

    it('should handle empty event arguments for Zapier format', async () => {
      const config = createMockConfig('zapier');
      const eventWithoutArgs = { ...createSampleEvent(), args: {} };
      const delivery = createMockDelivery('webhook-1', eventWithoutArgs);
      const mockResult: DeliveryResult = { success: true, statusCode: 200, responseTime: 150 };

      webhookSender.setWebhookConfigForTesting('webhook-1', config);
      mockHttpClient.post.mockResolvedValue(mockResult);

      await webhookSender.sendWebhook(delivery);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          event_name: 'Transfer',
          contract_address: '0x1234567890abcdef1234567890abcdef12345678',
          block_number: 12345678,
          transaction_hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          log_index: 2,
          timestamp: '2023-12-01T10:30:00.000Z',
          // No arg_ prefixed fields since args is empty
        }),
        config.headers,
        config.timeout
      );
    });
  });

  describe('Make.com format integration', () => {
    it('should format payload according to Make.com webhook standards (Requirement 3.2)', async () => {
      const config = createMockConfig('make');
      const delivery = createMockDelivery('webhook-1');
      const mockResult: DeliveryResult = { success: true, statusCode: 200, responseTime: 150 };

      webhookSender.setWebhookConfigForTesting('webhook-1', config);
      mockHttpClient.post.mockResolvedValue(mockResult);

      await webhookSender.sendWebhook(delivery);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          // Make.com format uses nested structure with metadata and data
          metadata: {
            eventName: 'Transfer',
            contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
            blockNumber: 12345678,
            transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            logIndex: 2,
            timestamp: '2023-12-01T10:30:00.000Z'
          },
          data: {
            from: '0x1111111111111111111111111111111111111111',
            to: '0x2222222222222222222222222222222222222222',
            value: '1000000000000000000',
            tokenId: 42,
            metadata: {
              name: 'Test Token',
              description: 'A test token for integration testing',
              attributes: [
                { trait_type: 'Color', value: 'Blue' },
                { trait_type: 'Rarity', value: 'Common' }
              ]
            }
          }
        }),
        config.headers,
        config.timeout
      );
    });

    it('should handle empty event arguments for Make.com format', async () => {
      const config = createMockConfig('make');
      const eventWithoutArgs = { ...createSampleEvent(), args: {} };
      const delivery = createMockDelivery('webhook-1', eventWithoutArgs);
      const mockResult: DeliveryResult = { success: true, statusCode: 200, responseTime: 150 };

      webhookSender.setWebhookConfigForTesting('webhook-1', config);
      mockHttpClient.post.mockResolvedValue(mockResult);

      await webhookSender.sendWebhook(delivery);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          metadata: expect.objectContaining({
            eventName: 'Transfer',
            contractAddress: '0x1234567890abcdef1234567890abcdef12345678'
          }),
          data: {} // Empty data object when no args
        }),
        config.headers,
        config.timeout
      );
    });
  });

  describe('n8n format integration', () => {
    it('should format payload according to n8n webhook standards (Requirement 3.3)', async () => {
      const config = createMockConfig('n8n');
      const delivery = createMockDelivery('webhook-1');
      const mockResult: DeliveryResult = { success: true, statusCode: 200, responseTime: 150 };

      webhookSender.setWebhookConfigForTesting('webhook-1', config);
      mockHttpClient.post.mockResolvedValue(mockResult);

      await webhookSender.sendWebhook(delivery);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          // n8n format uses camelCase with nested eventData structure
          eventData: {
            name: 'Transfer',
            contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
            blockNumber: 12345678,
            transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            logIndex: 2,
            timestamp: '2023-12-01T10:30:00.000Z',
            parameters: {
              from: '0x1111111111111111111111111111111111111111',
              to: '0x2222222222222222222222222222222222222222',
              value: '1000000000000000000',
              tokenId: 42,
              metadata: {
                name: 'Test Token',
                description: 'A test token for integration testing',
                attributes: [
                  { trait_type: 'Color', value: 'Blue' },
                  { trait_type: 'Rarity', value: 'Common' }
                ]
              }
            }
          }
        }),
        config.headers,
        config.timeout
      );
    });

    it('should handle empty event arguments for n8n format', async () => {
      const config = createMockConfig('n8n');
      const eventWithoutArgs = { ...createSampleEvent(), args: {} };
      const delivery = createMockDelivery('webhook-1', eventWithoutArgs);
      const mockResult: DeliveryResult = { success: true, statusCode: 200, responseTime: 150 };

      webhookSender.setWebhookConfigForTesting('webhook-1', config);
      mockHttpClient.post.mockResolvedValue(mockResult);

      await webhookSender.sendWebhook(delivery);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          eventData: expect.objectContaining({
            name: 'Transfer',
            contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
            parameters: {} // Empty parameters object when no args
          })
        }),
        config.headers,
        config.timeout
      );
    });
  });

  describe('Generic format integration', () => {
    it('should format payload according to generic JSON standards (Requirement 3.4)', async () => {
      const config = createMockConfig('generic');
      const delivery = createMockDelivery('webhook-1');
      const mockResult: DeliveryResult = { success: true, statusCode: 200, responseTime: 150 };

      webhookSender.setWebhookConfigForTesting('webhook-1', config);
      mockHttpClient.post.mockResolvedValue(mockResult);

      await webhookSender.sendWebhook(delivery);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          // Generic format maintains original structure
          contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
          eventName: 'Transfer',
          blockNumber: 12345678,
          transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          logIndex: 2,
          timestamp: '2023-12-01T10:30:00.000Z',
          args: {
            from: '0x1111111111111111111111111111111111111111',
            to: '0x2222222222222222222222222222222222222222',
            value: '1000000000000000000',
            tokenId: 42,
            metadata: {
              name: 'Test Token',
              description: 'A test token for integration testing',
              attributes: [
                { trait_type: 'Color', value: 'Blue' },
                { trait_type: 'Rarity', value: 'Common' }
              ]
            }
          }
        }),
        config.headers,
        config.timeout
      );
    });

    it('should handle empty event arguments for generic format', async () => {
      const config = createMockConfig('generic');
      const eventWithoutArgs = { ...createSampleEvent(), args: {} };
      const delivery = createMockDelivery('webhook-1', eventWithoutArgs);
      const mockResult: DeliveryResult = { success: true, statusCode: 200, responseTime: 150 };

      webhookSender.setWebhookConfigForTesting('webhook-1', config);
      mockHttpClient.post.mockResolvedValue(mockResult);

      await webhookSender.sendWebhook(delivery);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
          eventName: 'Transfer',
          blockNumber: 12345678,
          transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          logIndex: 2,
          timestamp: '2023-12-01T10:30:00.000Z',
          args: {} // Empty args object
        }),
        config.headers,
        config.timeout
      );
    });
  });

  describe('Format validation and error handling', () => {
    it('should return configuration error for unsupported format (Requirement 3.5)', async () => {
      const config = createMockConfig('generic');
      config.format = 'unsupported' as any;
      const delivery = createMockDelivery('webhook-1');

      webhookSender.setWebhookConfigForTesting('webhook-1', config);

      const result = await webhookSender.sendWebhook(delivery);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid webhook configuration');
      expect(result.error).toContain('Format must be one of: zapier, make, n8n, generic');
      expect(mockHttpClient.post).not.toHaveBeenCalled();
    });

    it('should handle formatting errors gracefully', async () => {
      // Test with an unsupported format to trigger formatting error
      const config = createMockConfig('generic');
      config.format = 'unsupported' as any;
      const delivery = createMockDelivery('webhook-1');

      webhookSender.setWebhookConfigForTesting('webhook-1', config);

      const result = await webhookSender.sendWebhook(delivery);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid webhook configuration');
      expect(mockHttpClient.post).not.toHaveBeenCalled();
      expect(mockDeliveryTracker.trackDelivery).toHaveBeenCalledWith(delivery, result);
    });

    it('should validate format during webhook config validation', () => {
      const validConfig = createMockConfig('zapier');
      const invalidConfig = createMockConfig('generic');
      invalidConfig.format = 'invalid' as any;

      const validResult = webhookSender.validateWebhookConfig(validConfig);
      const invalidResult = webhookSender.validateWebhookConfig(invalidConfig);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContainEqual({
        field: 'format',
        message: 'Format must be one of: zapier, make, n8n, generic',
        value: 'invalid'
      });
    });
  });

  describe('Cross-format consistency', () => {
    it('should maintain consistent event data across all formats', async () => {
      const formats: Array<'zapier' | 'make' | 'n8n' | 'generic'> = ['zapier', 'make', 'n8n', 'generic'];
      const event = createSampleEvent();
      const mockResult: DeliveryResult = { success: true, statusCode: 200, responseTime: 150 };

      mockHttpClient.post.mockResolvedValue(mockResult);

      for (const format of formats) {
        const config = createMockConfig(format);
        const delivery = createMockDelivery(`webhook-${format}`, event);

        webhookSender.setWebhookConfigForTesting(`webhook-${format}`, config);

        await webhookSender.sendWebhook(delivery);

        // Verify that the HTTP client was called
        expect(mockHttpClient.post).toHaveBeenCalled();

        // Get the payload that was sent
        const lastCall = mockHttpClient.post.mock.calls[mockHttpClient.post.mock.calls.length - 1];
        expect(lastCall).toBeDefined();
        const payload = lastCall![1];

        // Verify that essential event data is present in some form
        const payloadStr = JSON.stringify(payload);
        expect(payloadStr).toContain('Transfer'); // Event name
        expect(payloadStr).toContain('0x1234567890abcdef1234567890abcdef12345678'); // Contract address
        expect(payloadStr).toContain('12345678'); // Block number
        expect(payloadStr).toContain('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'); // Transaction hash
        expect(payloadStr).toContain('0x1111111111111111111111111111111111111111'); // From address
        expect(payloadStr).toContain('0x2222222222222222222222222222222222222222'); // To address
        expect(payloadStr).toContain('1000000000000000000'); // Value
      }

      // Verify all formats were called
      expect(mockHttpClient.post).toHaveBeenCalledTimes(4);
    });

    it('should handle complex nested data consistently across formats', async () => {
      const complexEvent = createSampleEvent();
      complexEvent.args = {
        ...complexEvent.args,
        complexData: {
          level1: {
            level2: {
              level3: 'deep value',
              array: [1, 2, 3, { nested: 'array object' }]
            }
          },
          nullValue: null,
          undefinedValue: undefined,
          booleanValue: true,
          numberValue: 42.5
        }
      };

      const formats: Array<'zapier' | 'make' | 'n8n' | 'generic'> = ['zapier', 'make', 'n8n', 'generic'];
      const mockResult: DeliveryResult = { success: true, statusCode: 200, responseTime: 150 };

      mockHttpClient.post.mockResolvedValue(mockResult);

      for (const format of formats) {
        const config = createMockConfig(format);
        const delivery = createMockDelivery(`webhook-${format}`, complexEvent);

        webhookSender.setWebhookConfigForTesting(`webhook-${format}`, config);

        const result = await webhookSender.sendWebhook(delivery);

        expect(result.success).toBe(true);
        expect(mockHttpClient.post).toHaveBeenCalled();

        // Verify that complex data is handled without errors
        const lastCall = mockHttpClient.post.mock.calls[mockHttpClient.post.mock.calls.length - 1];
        expect(lastCall).toBeDefined();
        const payload = lastCall![1];
        const payloadStr = JSON.stringify(payload);

        // Verify complex data is present in some form
        expect(payloadStr).toContain('deep value');
        expect(payloadStr).toContain('array object');
        expect(payloadStr).toContain('42.5');
      }
    });
  });

  describe('Performance and reliability', () => {
    it('should handle large payloads efficiently', async () => {
      const largeEvent = createSampleEvent();
      // Create a large args object
      largeEvent.args = {
        ...largeEvent.args,
        largeArray: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          data: `Large data item ${i}`,
          metadata: { index: i, processed: true }
        }))
      };

      const config = createMockConfig('generic');
      const delivery = createMockDelivery('webhook-1', largeEvent);
      const mockResult: DeliveryResult = { success: true, statusCode: 200, responseTime: 150 };

      webhookSender.setWebhookConfigForTesting('webhook-1', config);
      mockHttpClient.post.mockResolvedValue(mockResult);

      const startTime = Date.now();
      const result = await webhookSender.sendWebhook(delivery);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(mockHttpClient.post).toHaveBeenCalled();
    });

    it('should track delivery results correctly for all formats', async () => {
      const formats: Array<'zapier' | 'make' | 'n8n' | 'generic'> = ['zapier', 'make', 'n8n', 'generic'];
      const mockResult: DeliveryResult = { success: true, statusCode: 200, responseTime: 150 };

      mockHttpClient.post.mockResolvedValue(mockResult);

      for (const format of formats) {
        const config = createMockConfig(format);
        const delivery = createMockDelivery(`webhook-${format}`);

        webhookSender.setWebhookConfigForTesting(`webhook-${format}`, config);

        await webhookSender.sendWebhook(delivery);

        // Verify delivery tracking was called with correct parameters
        expect(mockDeliveryTracker.trackDelivery).toHaveBeenCalledWith(delivery, mockResult);
      }

      expect(mockDeliveryTracker.trackDelivery).toHaveBeenCalledTimes(4);
    });
  });
});