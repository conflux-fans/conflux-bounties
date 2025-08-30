import { POST, GET, DELETE } from '../../app/api/webhook/configure/route';
import { getWebhookConfigurationsByUserId, insertWebhookConfiguration } from '../../lib/database';
import crypto from 'crypto';

// Mock dependencies
jest.mock('../../lib/database');
jest.mock('crypto');

const mockGetWebhookConfigurationsByUserId = getWebhookConfigurationsByUserId as jest.MockedFunction<typeof getWebhookConfigurationsByUserId>;
const mockInsertWebhookConfiguration = insertWebhookConfiguration as jest.MockedFunction<typeof insertWebhookConfiguration>;
const mockCrypto = crypto as jest.Mocked<typeof crypto>;

// Helper to create mock NextRequest with proper json() method
function createRequest(body: any, headers: Record<string, string> = {}) {
  return {
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: jest.fn((key: string) => headers[key] || null)
    }
  } as any;
}

// Helper to create mock NextRequest for GET/DELETE requests
function createGetRequest(url: string, headers: Record<string, string> = {}) {
  return {
    url,
    nextUrl: new URL(url),
    headers: {
      get: jest.fn((key: string) => headers[key] || null)
    }
  } as any;
}

describe('/api/webhook/configure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    
    // Mock crypto functions
    mockCrypto.randomBytes = jest.fn().mockReturnValue({
      toString: jest.fn().mockReturnValue('mocked-secret-key-123')
    });
    mockCrypto.createHash = jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue({
        slice: jest.fn().mockReturnValue('hashed-api-key')
      })
    });
  });

  describe('POST - Create/Update Webhook Configuration', () => {
    it('should create a new webhook configuration successfully', async () => {
      const mockWebhookConfig = {
        id: 'webhook-123',
        user_id: 'user-456',
        webhook_url: 'https://example.com/webhook',
        events: '["audit_completed", "audit_failed"]',
        is_active: true,
        created_at: '2023-01-01T00:00:00Z',
        retry_count: 3,
        timeout_seconds: 30,
        custom_headers: '{"X-Custom": "value"}'
      };

      mockGetWebhookConfigurationsByUserId.mockResolvedValue([]);
      mockInsertWebhookConfiguration.mockResolvedValue(mockWebhookConfig);

      const request = createRequest({
        webhook_url: 'https://example.com/webhook',
        events: ['audit_completed', 'audit_failed'],
        retry_count: 3,
        timeout_seconds: 30,
        custom_headers: { 'X-Custom': 'value' }
      }, { 'x-user-id': 'user-456' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Webhook configuration created successfully');
      expect(data.webhook.id).toBe('webhook-123');
      expect(data.webhook.webhook_url).toBe('https://example.com/webhook');
      expect(data.webhook.events).toEqual(['audit_completed', 'audit_failed']);
      expect(data.secret_hmac).toBe('mocked-secret-key-123');
      expect(mockInsertWebhookConfiguration).toHaveBeenCalledTimes(1);
    });

    it('should update existing webhook configuration', async () => {
      const existingConfig = {
        id: 'existing-webhook-123',
        user_id: 'user-456',
        webhook_url: 'https://example.com/webhook',
        events: '["audit_completed"]',
        is_active: true,
        created_at: '2023-01-01T00:00:00Z',
        retry_count: 2,
        timeout_seconds: 20,
        custom_headers: '{}'
      };

      mockGetWebhookConfigurationsByUserId.mockResolvedValue([existingConfig]);

      const request = createRequest({
        webhook_url: 'https://example.com/webhook',
        events: ['audit_completed', 'audit_failed'],
        retry_count: 5,
        timeout_seconds: 60
      }, { 'x-user-id': 'user-456' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Webhook configuration updated successfully');
      expect(data.webhook.id).toBe('existing-webhook-123');
      expect(console.log).toHaveBeenCalledWith('[Webhook] Update webhook configuration not implemented in file-based storage');
    });

    it('should return 400 for missing webhook_url', async () => {
      const request = createRequest({
        events: ['audit_completed']
      }, { 'x-user-id': 'user-456' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('webhook_url is required');
      expect(data.details).toBe('A valid HTTPS URL must be provided for webhook notifications');
    });

    it('should return 400 for invalid webhook URL', async () => {
      const request = createRequest({
        webhook_url: 'invalid-url'
      }, { 'x-user-id': 'user-456' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid webhook URL');
      expect(data.details).toBe('Webhook URL must be a valid HTTPS URL (HTTP allowed in development)');
    });

    it('should accept HTTP URLs in development mode', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockWebhookConfig = {
        id: 'webhook-123',
        user_id: 'user-456',
        webhook_url: 'http://localhost:3001/webhook',
        events: '["audit_completed"]',
        is_active: true,
        created_at: '2023-01-01T00:00:00Z',
        retry_count: 3,
        timeout_seconds: 30,
        custom_headers: '{}'
      };

      mockGetWebhookConfigurationsByUserId.mockResolvedValue([]);
      mockInsertWebhookConfiguration.mockResolvedValue(mockWebhookConfig);

      const request = createRequest({
        webhook_url: 'http://localhost:3001/webhook'
      }, { 'x-user-id': 'user-456' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should return 400 for invalid events', async () => {
      const request = createRequest({
        webhook_url: 'https://example.com/webhook',
        events: ['invalid_event', 'audit_completed']
      }, { 'x-user-id': 'user-456' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid events');
      expect(data.details).toBe('Events must be one of: audit_completed, audit_failed, audit_started');
    });

    it('should return 400 for invalid retry count', async () => {
      const request = createRequest({
        webhook_url: 'https://example.com/webhook',
        retry_count: 15
      }, { 'x-user-id': 'user-456' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid retry count');
      expect(data.details).toBe('Retry count must be between 0 and 10');
    });

    it('should return 400 for invalid timeout', async () => {
      const request = createRequest({
        webhook_url: 'https://example.com/webhook',
        timeout_seconds: 200
      }, { 'x-user-id': 'user-456' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid timeout');
      expect(data.details).toBe('Timeout must be between 5 and 120 seconds');
    });

    it('should return 400 for dangerous custom headers', async () => {
      const request = createRequest({
        webhook_url: 'https://example.com/webhook',
        custom_headers: { 'Authorization': 'Bearer token' }
      }, { 'x-user-id': 'user-456' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid custom headers');
      expect(data.details).toBe('Custom headers cannot include sensitive headers like Authorization, Cookie, etc.');
    });

    it('should use API key for user identification when x-user-id not provided', async () => {
      const mockWebhookConfig = {
        id: 'webhook-123',
        user_id: 'hashed-api-key',
        webhook_url: 'https://example.com/webhook',
        events: '["audit_completed"]',
        is_active: true,
        created_at: '2023-01-01T00:00:00Z',
        retry_count: 3,
        timeout_seconds: 30,
        custom_headers: '{}'
      };

      mockGetWebhookConfigurationsByUserId.mockResolvedValue([]);
      mockInsertWebhookConfiguration.mockResolvedValue(mockWebhookConfig);

      const request = createRequest({
        webhook_url: 'https://example.com/webhook'
      }, { 'x-api-key': 'api-key-123' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockCrypto.createHash).toHaveBeenCalledWith('sha256');
    });

    it('should use default user when no identification provided', async () => {
      const mockWebhookConfig = {
        id: 'webhook-123',
        user_id: 'default_user',
        webhook_url: 'https://example.com/webhook',
        events: '["audit_completed"]',
        is_active: true,
        created_at: '2023-01-01T00:00:00Z',
        retry_count: 3,
        timeout_seconds: 30,
        custom_headers: '{}'
      };

      mockGetWebhookConfigurationsByUserId.mockResolvedValue([]);
      mockInsertWebhookConfiguration.mockResolvedValue(mockWebhookConfig);

      const request = createRequest({
        webhook_url: 'https://example.com/webhook'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.webhook.id).toBe('webhook-123');
    });

    it('should return 500 when database insertion fails', async () => {
      mockGetWebhookConfigurationsByUserId.mockResolvedValue([]);
      mockInsertWebhookConfiguration.mockResolvedValue(null);

      const request = createRequest({
        webhook_url: 'https://example.com/webhook'
      }, { 'x-user-id': 'user-456' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create webhook configuration');
      expect(data.details).toBe('An error occurred while saving the webhook configuration');
    });

    it('should handle JSON parsing errors', async () => {
      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
        headers: {
          get: jest.fn().mockReturnValue('user-456')
        }
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error occurred while configuring webhook');
      expect(data.type).toBe('webhook_configure_error');
      expect(console.error).toHaveBeenCalledWith('[WebhookConfigure] Error configuring webhook:', expect.any(Error));
    });
  });

  describe('GET - Fetch Webhook Configurations', () => {
    it('should fetch webhook configurations successfully', async () => {
      const mockConfigs = [
        {
          id: 'webhook-1',
          webhook_url: 'https://example.com/webhook1',
          events: '["audit_completed"]',
          is_active: true,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-02T00:00:00Z',
          last_used_at: '2023-01-03T00:00:00Z',
          retry_count: 3,
          timeout_seconds: 30,
          custom_headers: '{"X-Custom": "value"}'
        },
        {
          id: 'webhook-2',
          webhook_url: 'https://example.com/webhook2',
          events: '["audit_failed"]',
          is_active: false,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: null,
          last_used_at: null,
          retry_count: 5,
          timeout_seconds: 60,
          custom_headers: null
        }
      ];

      mockGetWebhookConfigurationsByUserId.mockResolvedValue(mockConfigs);

      const request = createGetRequest('http://localhost:3000/api/webhook/configure', {
        'x-user-id': 'user-456'
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
      expect(data.webhooks).toHaveLength(2);
      expect(data.webhooks[0]).toEqual({
        id: 'webhook-1',
        webhook_url: 'https://example.com/webhook1',
        events: ['audit_completed'],
        is_active: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
        last_used_at: '2023-01-03T00:00:00Z',
        retry_count: 3,
        timeout_seconds: 30,
        custom_headers: { 'X-Custom': 'value' }
      });
      expect(data.webhooks[1].custom_headers).toEqual({});
    });

    it('should return empty array when no configurations exist', async () => {
      mockGetWebhookConfigurationsByUserId.mockResolvedValue([]);

      const request = createGetRequest('http://localhost:3000/api/webhook/configure', {
        'x-user-id': 'user-456'
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.count).toBe(0);
      expect(data.webhooks).toEqual([]);
    });

    it('should handle database fetch errors', async () => {
      mockGetWebhookConfigurationsByUserId.mockRejectedValue(new Error('Database error'));

      const request = createGetRequest('http://localhost:3000/api/webhook/configure', {
        'x-user-id': 'user-456'
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error occurred while fetching webhook configurations');
      expect(data.type).toBe('webhook_fetch_error');
      expect(console.error).toHaveBeenCalledWith('[WebhookConfigure] Error fetching webhook configurations:', expect.any(Error));
    });
  });

  describe('DELETE - Delete Webhook Configuration', () => {
    it('should delete webhook configuration successfully', async () => {
      const mockConfigs = [
        {
          id: 'webhook-123',
          user_id: 'user-456',
          webhook_url: 'https://example.com/webhook',
          is_active: true
        }
      ];

      mockGetWebhookConfigurationsByUserId.mockResolvedValue(mockConfigs);

      const request = createGetRequest('http://localhost:3000/api/webhook/configure?id=webhook-123', {
        'x-user-id': 'user-456'
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Webhook configuration deleted successfully');
      expect(data.webhook_id).toBe('webhook-123');
      expect(console.log).toHaveBeenCalledWith('[Webhook] Delete webhook configuration not implemented in file-based storage');
    });

    it('should return 400 when webhook ID is missing', async () => {
      const request = createGetRequest('http://localhost:3000/api/webhook/configure', {
        'x-user-id': 'user-456'
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Webhook ID is required');
    });

    it('should return 404 when webhook configuration not found', async () => {
      mockGetWebhookConfigurationsByUserId.mockResolvedValue([]);

      const request = createGetRequest('http://localhost:3000/api/webhook/configure?id=nonexistent-webhook', {
        'x-user-id': 'user-456'
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Webhook configuration not found');
      expect(data.details).toBe('No webhook configuration found with the specified ID for this user');
    });

    it('should handle database deletion errors', async () => {
      mockGetWebhookConfigurationsByUserId.mockRejectedValue(new Error('Database error'));

      const request = createGetRequest('http://localhost:3000/api/webhook/configure?id=webhook-123', {
        'x-user-id': 'user-456'
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error occurred while deleting webhook configuration');
      expect(data.type).toBe('webhook_delete_error');
      expect(console.error).toHaveBeenCalledWith('[WebhookConfigure] Error deleting webhook configuration:', expect.any(Error));
    });
  });

  describe('Validation Functions', () => {
    it('should validate webhook URLs correctly', async () => {
      const mockConfig = {
        id: 'webhook-123', user_id: 'user-456', webhook_url: 'https://secure.example.com/webhook',
        events: '["audit_completed"]', is_active: true, created_at: '2023-01-01T00:00:00Z',
        retry_count: 3, timeout_seconds: 30, custom_headers: '{}'
      };

      mockGetWebhookConfigurationsByUserId.mockResolvedValue([]);
      mockInsertWebhookConfiguration.mockResolvedValue(mockConfig);

      const request = createRequest({ webhook_url: 'https://secure.example.com/webhook' }, 
        { 'x-user-id': 'user-456' });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should use default values for optional parameters', async () => {
      const mockConfig = {
        id: 'webhook-123', user_id: 'user-456', webhook_url: 'https://example.com/webhook',
        events: '["audit_completed", "audit_failed"]', is_active: true, created_at: '2023-01-01T00:00:00Z',
        retry_count: 3, timeout_seconds: 30, custom_headers: '{}'
      };

      mockGetWebhookConfigurationsByUserId.mockResolvedValue([]);
      mockInsertWebhookConfiguration.mockResolvedValue(mockConfig);

      const request = createRequest({ webhook_url: 'https://example.com/webhook' }, 
        { 'x-user-id': 'user-456' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.webhook.events).toEqual(['audit_completed', 'audit_failed']);
      expect(data.webhook.retry_count).toBe(3);
      expect(data.webhook.timeout_seconds).toBe(30);
    });
  });
});