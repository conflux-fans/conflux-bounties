import { DatabaseWebhookConfigProvider } from '../WebhookConfigProvider';
import { DatabaseConnection } from '../../database/connection';
import { Logger } from '../../monitoring/Logger';
import { WebhookConfig } from '../../types';

// Mock the database connection
jest.mock('../../database/connection');
jest.mock('../../monitoring/Logger');

describe('DatabaseWebhookConfigProvider', () => {
  let provider: DatabaseWebhookConfigProvider;
  let mockDatabase: jest.Mocked<DatabaseConnection>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    provider = new DatabaseWebhookConfigProvider(mockDatabase, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getWebhookConfig', () => {
    const mockWebhookId = 'webhook-123';
    const mockDbRow = {
      id: 'webhook-123',
      url: 'https://example.com/webhook',
      format: 'zapier',
      headers: '{"Authorization": "Bearer token"}',
      timeout: 30000,
      retry_attempts: 3
    };

    const expectedConfig: WebhookConfig = {
      id: 'webhook-123',
      url: 'https://example.com/webhook',
      format: 'zapier',
      headers: { Authorization: 'Bearer token' },
      timeout: 30000,
      retryAttempts: 3
    };

    it('should return webhook config from database when not cached', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [mockDbRow] });

      const result = await provider.getWebhookConfig(mockWebhookId);

      expect(result).toEqual(expectedConfig);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, url, format, headers, timeout, retry_attempts'),
        [mockWebhookId]
      );
    });

    it('should return cached config when available and not expired', async () => {
      // First call to populate cache
      mockDatabase.query.mockResolvedValue({ rows: [mockDbRow] });
      await provider.getWebhookConfig(mockWebhookId);

      // Second call should use cache
      mockDatabase.query.mockClear();
      const result = await provider.getWebhookConfig(mockWebhookId);

      expect(result).toEqual(expectedConfig);
      expect(mockDatabase.query).not.toHaveBeenCalled();
    });

    it('should return null when webhook config not found', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await provider.getWebhookConfig(mockWebhookId);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Webhook config not found', { webhookId: mockWebhookId });
    });

    it('should handle database errors gracefully', async () => {
      const error = new Error('Database connection failed');
      mockDatabase.query.mockRejectedValue(error);

      const result = await provider.getWebhookConfig(mockWebhookId);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get webhook config', expect.any(Error), {
        webhookId: mockWebhookId
      });
    });

    it('should handle invalid JSON headers gracefully', async () => {
      const rowWithInvalidHeaders = {
        ...mockDbRow,
        headers: 'invalid-json'
      };
      mockDatabase.query.mockResolvedValue({ rows: [rowWithInvalidHeaders] });

      const result = await provider.getWebhookConfig(mockWebhookId);

      expect(result).toEqual({
        ...expectedConfig,
        headers: {} // Should default to empty object
      });
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to parse webhook headers', expect.any(Object));
    });

    it('should normalize invalid format to generic', async () => {
      const rowWithInvalidFormat = {
        ...mockDbRow,
        format: 'invalid-format'
      };
      mockDatabase.query.mockResolvedValue({ rows: [rowWithInvalidFormat] });

      const result = await provider.getWebhookConfig(mockWebhookId);

      expect(result).toEqual({
        ...expectedConfig,
        format: 'generic'
      });
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid webhook format, defaulting to generic', expect.any(Object));
    });

    it('should apply default values for missing timeout and retry_attempts', async () => {
      const rowWithMissingDefaults = {
        id: 'webhook-123',
        url: 'https://example.com/webhook',
        format: 'zapier',
        headers: '{}',
        timeout: null,
        retry_attempts: null
      };
      mockDatabase.query.mockResolvedValue({ rows: [rowWithMissingDefaults] });

      const result = await provider.getWebhookConfig(mockWebhookId);

      expect(result).toEqual({
        id: 'webhook-123',
        url: 'https://example.com/webhook',
        format: 'zapier',
        headers: {},
        timeout: 30000, // Default
        retryAttempts: 3 // Default
      });
    });
  });

  describe('loadWebhookConfigs', () => {
    const mockRows = [
      {
        id: 'webhook-1',
        url: 'https://example1.com/webhook',
        format: 'zapier',
        headers: '{}',
        timeout: 30000,
        retry_attempts: 3
      },
      {
        id: 'webhook-2',
        url: 'https://example2.com/webhook',
        format: 'make',
        headers: '{}',
        timeout: 45000,
        retry_attempts: 5
      }
    ];

    it('should load all webhook configs and populate cache', async () => {
      mockDatabase.query.mockResolvedValue({ rows: mockRows });

      await provider.loadWebhookConfigs();

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, url, format, headers, timeout, retry_attempts')
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Loading all webhook configurations');
      expect(mockLogger.info).toHaveBeenCalledWith('Loaded webhook configurations', { count: 2 });

      // Verify cache is populated
      const stats = provider.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.entries).toContain('webhook-1');
      expect(stats.entries).toContain('webhook-2');
    });

    it('should handle database errors during load', async () => {
      const error = new Error('Database error');
      mockDatabase.query.mockRejectedValue(error);

      await expect(provider.loadWebhookConfigs()).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to load webhook configurations', expect.any(Error));
    });

    it('should clear existing cache before loading new configs', async () => {
      // First load
      mockDatabase.query.mockResolvedValue({ rows: [mockRows[0]] });
      await provider.loadWebhookConfigs();
      expect(provider.getCacheStats().size).toBe(1);

      // Second load with different data
      mockDatabase.query.mockResolvedValue({ rows: [mockRows[1]] });
      await provider.loadWebhookConfigs();
      
      const stats = provider.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.entries).toContain('webhook-2');
      expect(stats.entries).not.toContain('webhook-1');
    });
  });

  describe('refreshConfigs', () => {
    it('should call loadWebhookConfigs', async () => {
      const loadSpy = jest.spyOn(provider, 'loadWebhookConfigs').mockResolvedValue();

      await provider.refreshConfigs();

      expect(loadSpy).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Refreshing webhook configurations');
    });

    it('should not throw error if refresh fails', async () => {
      const error = new Error('Refresh failed');
      jest.spyOn(provider, 'loadWebhookConfigs').mockRejectedValue(error);

      await expect(provider.refreshConfigs()).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to refresh webhook configurations', expect.any(Error));
    });
  });

  describe('cache management', () => {
    it('should expire cached configs after TTL', async () => {
      const mockRow = {
        id: 'webhook-123',
        url: 'https://example.com/webhook',
        format: 'zapier',
        headers: '{}',
        timeout: 30000,
        retry_attempts: 3
      };

      // Mock Date.now to control cache expiry
      const originalNow = Date.now;
      let currentTime = 1000000;
      Date.now = jest.fn(() => currentTime);

      try {
        // First call to populate cache
        mockDatabase.query.mockResolvedValue({ rows: [mockRow] });
        await provider.getWebhookConfig('webhook-123');

        // Advance time beyond TTL (5 minutes = 300000ms)
        currentTime += 300001;

        // Second call should hit database again due to expired cache
        mockDatabase.query.mockClear();
        mockDatabase.query.mockResolvedValue({ rows: [mockRow] });
        await provider.getWebhookConfig('webhook-123');

        expect(mockDatabase.query).toHaveBeenCalled();
      } finally {
        Date.now = originalNow;
      }
    });

    it('should provide cache statistics', () => {
      const stats = provider.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('entries');
      expect(Array.isArray(stats.entries)).toBe(true);
    });

    it('should clear cache when requested', async () => {
      // Populate cache
      const mockRow = {
        id: 'webhook-123',
        url: 'https://example.com/webhook',
        format: 'zapier',
        headers: '{}',
        timeout: 30000,
        retry_attempts: 3
      };
      mockDatabase.query.mockResolvedValue({ rows: [mockRow] });
      await provider.getWebhookConfig('webhook-123');

      expect(provider.getCacheStats().size).toBe(1);

      // Clear cache
      provider.clearCache();

      expect(provider.getCacheStats().size).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Webhook config cache cleared');
    });
  });

  describe('mapRowToConfig', () => {
    it('should handle object headers correctly', async () => {
      const mockRow = {
        id: 'webhook-123',
        url: 'https://example.com/webhook',
        format: 'zapier',
        headers: { Authorization: 'Bearer token' }, // Object instead of string
        timeout: 30000,
        retry_attempts: 3
      };
      mockDatabase.query.mockResolvedValue({ rows: [mockRow] });

      const result = await provider.getWebhookConfig('webhook-123');

      expect(result?.headers).toEqual({ Authorization: 'Bearer token' });
    });

    it('should handle null headers correctly', async () => {
      const mockRow = {
        id: 'webhook-123',
        url: 'https://example.com/webhook',
        format: 'zapier',
        headers: null,
        timeout: 30000,
        retry_attempts: 3
      };
      mockDatabase.query.mockResolvedValue({ rows: [mockRow] });

      const result = await provider.getWebhookConfig('webhook-123');

      expect(result?.headers).toEqual({});
    });
  });
});