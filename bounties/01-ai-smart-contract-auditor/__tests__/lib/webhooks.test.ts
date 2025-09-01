import crypto from 'crypto';
import {
  sendWebhookNotifications,
  sendAuditCompletedWebhook,
  sendAuditFailedWebhook,
  sendAuditStartedWebhook,
  verifyWebhookSignature,
  WebhookPayload
} from '../../lib/webhooks';
import * as database from '../../lib/database';

// Mock the database module
jest.mock('../../lib/database');
const mockedDatabase = database as jest.Mocked<typeof database>;

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock console methods to reduce test noise
jest.spyOn(console, 'log').mockImplementation();
jest.spyOn(console, 'error').mockImplementation();

describe('webhooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    // Mock environment variables
    process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com';
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    delete process.env.NEXT_PUBLIC_BASE_URL;
  });

  describe('verifyWebhookSignature', () => {
    const payload = '{"test": "data"}';
    const secret = 'test-secret';

    it('should return true for valid signatures', () => {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload, 'utf8');
      const validSignature = `sha256=${hmac.digest('hex')}`;

      const result = verifyWebhookSignature(payload, validSignature, secret);
      expect(result).toBe(true);
    });

    it('should return false for invalid signatures', () => {
      const invalidSignature = 'sha256=invalid-signature';

      const result = verifyWebhookSignature(payload, invalidSignature, secret);
      expect(result).toBe(false);
    });

    it('should return false for malformed signatures', () => {
      const malformedSignature = 'invalid-format';

      const result = verifyWebhookSignature(payload, malformedSignature, secret);
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      // Test with empty signature
      const result = verifyWebhookSignature(payload, '', secret);
      expect(result).toBe(false);
    });
  });

  describe('sendWebhookNotifications', () => {
    const mockWebhookConfigs = [
      {
        id: 'webhook-1',
        webhook_url: 'https://example.com/webhook1',
        events: '["audit_completed"]',
        secret_hmac: 'secret1',
        timeout_seconds: 30,
        custom_headers: '{"Authorization": "Bearer token1"}'
      },
      {
        id: 'webhook-2',
        webhook_url: 'https://example.com/webhook2',
        events: '["audit_completed", "audit_failed"]',
        secret_hmac: 'secret2',
        timeout_seconds: 30,
        custom_headers: null
      }
    ];

    beforeEach(() => {
      mockedDatabase.getActiveWebhookConfigurations.mockResolvedValue(mockWebhookConfigs as any);
      mockedDatabase.insertWebhookDelivery.mockResolvedValue({ id: 'delivery-1' } as any);
    });

    it('should send webhooks to subscribed endpoints for audit_completed', async () => {
      mockFetch
        .mockResolvedValueOnce({
          status: 200,
          text: () => Promise.resolve('OK')
        })
        .mockResolvedValueOnce({
          status: 200,
          text: () => Promise.resolve('OK')
        });

      await sendWebhookNotifications('audit_completed', 'audit-123', 'cfx:123', {
        status: 'completed',
        findings_count: 5,
        severity_breakdown: { critical: 1, high: 2, medium: 1, low: 1 },
        processing_time_ms: 5000
      });

      // Both webhooks should be called since both are subscribed to audit_completed
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      // Check first webhook call
      const [url1, options1] = mockFetch.mock.calls[0];
      expect(url1).toBe('https://example.com/webhook1');
      expect(options1.method).toBe('POST');
      expect(options1.headers['Content-Type']).toBe('application/json');
      expect(options1.headers['Authorization']).toBe('Bearer token1');
      expect(options1.headers['X-Webhook-Event']).toBe('audit_completed');

      // Check payload includes report URL
      const payload1 = JSON.parse(options1.body);
      expect(payload1.data.report_url).toBe('https://example.com/audit/report/audit-123');
    });

    it('should only send to webhooks subscribed to the specific event', async () => {
      // Create a config that's not subscribed to audit_failed
      const limitedConfigs = [
        {
          id: 'webhook-1',
          webhook_url: 'https://example.com/webhook1',
          events: '["audit_completed"]', // Not subscribed to audit_failed
          secret_hmac: 'secret1',
          timeout_seconds: 30,
          custom_headers: null
        }
      ];

      mockedDatabase.getActiveWebhookConfigurations.mockResolvedValue(limitedConfigs as any);

      await sendWebhookNotifications('audit_failed', 'audit-123', 'cfx:123', {
        status: 'failed',
        error_message: 'Test error'
      });

      // Should not call any webhooks since webhook-1 is not subscribed to audit_failed
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle webhook delivery failures', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          status: 200,
          text: () => Promise.resolve('OK')
        });

      await sendWebhookNotifications('audit_completed', 'audit-123', 'cfx:123', {
        status: 'completed'
      });

      expect(mockFetch).toHaveBeenCalled();
      // Should have been called twice - once for each webhook
      expect(mockedDatabase.insertWebhookDelivery).toHaveBeenCalledTimes(2);
      
      // Check that at least one call had delivered_at undefined (failed delivery)
      const calls = mockedDatabase.insertWebhookDelivery.mock.calls;
      const hasFailedDelivery = calls.some(call => call[0].delivered_at === undefined);
      expect(hasFailedDelivery).toBe(true);
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 500,
        text: () => Promise.resolve('Internal Server Error')
      });

      await sendWebhookNotifications('audit_completed', 'audit-123', 'cfx:123', {
        status: 'completed'
      });

      expect(mockedDatabase.insertWebhookDelivery).toHaveBeenCalledWith(
        expect.objectContaining({
          response_status: 500,
          response_body: 'Internal Server Error',
          delivered_at: undefined // Failed delivery (status >= 300)
        })
      );
    });

    it('should handle no active webhook configurations', async () => {
      mockedDatabase.getActiveWebhookConfigurations.mockResolvedValue([]);

      await sendWebhookNotifications('audit_completed', 'audit-123', 'cfx:123', {
        status: 'completed'
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle malformed event configurations', async () => {
      const malformedConfigs = [
        {
          id: 'webhook-1',
          webhook_url: 'https://example.com/webhook1',
          events: 'invalid-json', // Malformed JSON
          secret_hmac: 'secret1',
          timeout_seconds: 30,
          custom_headers: null
        }
      ];

      mockedDatabase.getActiveWebhookConfigurations.mockResolvedValue(malformedConfigs as any);

      // Should not throw, but should handle gracefully
      await expect(sendWebhookNotifications('audit_completed', 'audit-123', 'cfx:123', {
        status: 'completed'
      })).resolves.not.toThrow();
    });

    it('should include custom headers', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        text: () => Promise.resolve('OK')
      });

      await sendWebhookNotifications('audit_completed', 'audit-123', 'cfx:123', {
        status: 'completed'
      });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer token1');
    });

    it('should handle webhook timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      
      mockFetch
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce({
          status: 200,
          text: () => Promise.resolve('OK')
        });

      await sendWebhookNotifications('audit_completed', 'audit-123', 'cfx:123', {
        status: 'completed'
      });

      jest.advanceTimersByTime(30000); // Advance by timeout duration

      expect(mockedDatabase.insertWebhookDelivery).toHaveBeenCalledTimes(2);
      
      // Check that at least one call had delivered_at undefined (failed delivery)
      const calls = mockedDatabase.insertWebhookDelivery.mock.calls;
      const hasFailedDelivery = calls.some(call => call[0].delivered_at === undefined);
      expect(hasFailedDelivery).toBe(true);
    });
  });

  describe('sendAuditCompletedWebhook', () => {
    beforeEach(() => {
      mockedDatabase.getActiveWebhookConfigurations.mockResolvedValue([]);
    });

    it('should call sendWebhookNotifications with correct parameters', async () => {
      const severityBreakdown = { critical: 1, high: 2, medium: 1, low: 1 };

      await sendAuditCompletedWebhook(
        'audit-123',
        'cfx:123',
        5,
        severityBreakdown,
        5000
      );

      expect(mockedDatabase.getActiveWebhookConfigurations).toHaveBeenCalled();
    });
  });

  describe('sendAuditFailedWebhook', () => {
    beforeEach(() => {
      mockedDatabase.getActiveWebhookConfigurations.mockResolvedValue([]);
    });

    it('should call sendWebhookNotifications with correct parameters', async () => {
      await sendAuditFailedWebhook(
        'audit-123',
        'cfx:123',
        'Analysis failed',
        3000
      );

      expect(mockedDatabase.getActiveWebhookConfigurations).toHaveBeenCalled();
    });
  });

  describe('sendAuditStartedWebhook', () => {
    beforeEach(() => {
      mockedDatabase.getActiveWebhookConfigurations.mockResolvedValue([]);
    });

    it('should call sendWebhookNotifications with correct parameters', async () => {
      await sendAuditStartedWebhook('audit-123', 'cfx:123');

      expect(mockedDatabase.getActiveWebhookConfigurations).toHaveBeenCalled();
    });
  });

  describe('webhook payload structure', () => {
    beforeEach(() => {
      mockedDatabase.getActiveWebhookConfigurations.mockResolvedValue([
        {
          id: 'webhook-1',
          webhook_url: 'https://example.com/webhook',
          events: '["audit_completed"]',
          secret_hmac: 'secret',
          timeout_seconds: 30,
          custom_headers: null
        }
      ] as any);

      mockFetch.mockResolvedValue({
        status: 200,
        text: () => Promise.resolve('OK')
      });
    });

    it('should include all required fields in payload', async () => {
      await sendWebhookNotifications('audit_completed', 'audit-123', 'cfx:123', {
        status: 'completed',
        findings_count: 5,
        severity_breakdown: { critical: 1, high: 2, medium: 1, low: 1 },
        processing_time_ms: 5000
      });

      const [, options] = mockFetch.mock.calls[0];
      const payload: WebhookPayload = JSON.parse(options.body);

      expect(payload).toMatchObject({
        event: 'audit_completed',
        audit_id: 'audit-123',
        contract_address: 'cfx:123',
        timestamp: expect.any(String),
        data: {
          status: 'completed',
          findings_count: 5,
          severity_breakdown: { critical: 1, high: 2, medium: 1, low: 1 },
          processing_time_ms: 5000,
          report_url: 'https://example.com/audit/report/audit-123'
        }
      });
    });

    it('should generate valid HMAC signature', async () => {
      await sendWebhookNotifications('audit_completed', 'audit-123', 'cfx:123', {
        status: 'completed'
      });

      const [, options] = mockFetch.mock.calls[0];
      const signature = options.headers['X-Webhook-Signature'];
      const payload = options.body;

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
      expect(verifyWebhookSignature(payload, signature, 'secret')).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockedDatabase.getActiveWebhookConfigurations.mockRejectedValue(new Error('Database error'));

      await expect(sendWebhookNotifications('audit_completed', 'audit-123', 'cfx:123', {
        status: 'completed'
      })).resolves.not.toThrow();
    });

    it('should handle webhook delivery logging errors', async () => {
      mockedDatabase.getActiveWebhookConfigurations.mockResolvedValue([
        {
          id: 'webhook-1',
          webhook_url: 'https://example.com/webhook',
          events: '["audit_completed"]',
          secret_hmac: 'secret',
          timeout_seconds: 30,
          custom_headers: null
        }
      ] as any);

      mockFetch.mockResolvedValue({
        status: 200,
        text: () => Promise.resolve('OK')
      });

      mockedDatabase.insertWebhookDelivery.mockRejectedValue(new Error('Database error'));

      await expect(sendWebhookNotifications('audit_completed', 'audit-123', 'cfx:123', {
        status: 'completed'
      })).resolves.not.toThrow();
    });
  });
});