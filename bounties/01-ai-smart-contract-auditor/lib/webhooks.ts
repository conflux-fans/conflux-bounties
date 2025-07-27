import crypto from 'crypto';
import { getActiveWebhookConfigurations, insertWebhookDelivery, WebhookConfiguration, WebhookDeliveryInsert } from './database';

export interface WebhookPayload {
  event: 'audit_completed' | 'audit_failed' | 'audit_started';
  audit_id: string;
  contract_address: string;
  timestamp: string;
  data: {
    status: 'completed' | 'failed' | 'processing';
    findings_count?: number;
    severity_breakdown?: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    processing_time_ms?: number;
    error_message?: string;
    report_url?: string;
  };
}

/**
 * Generate HMAC signature for webhook payload
 */
function generateHmacSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Send webhook to a specific configuration
 */
async function sendWebhook(
  config: WebhookConfiguration,
  payload: WebhookPayload,
  auditReportId: string
): Promise<{ success: boolean; httpStatus?: number; error?: string; responseBody?: string }> {
  const payloadJson = JSON.stringify(payload);
  const signature = generateHmacSignature(payloadJson, config.secret_hmac);

  // Prepare headers
  const customHeaders = config.custom_headers ? JSON.parse(config.custom_headers) : {};
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'AI-Smart-Contract-Auditor/1.0',
    'X-Webhook-Signature': signature,
    'X-Webhook-Event': payload.event,
    'X-Webhook-Delivery': crypto.randomUUID(),
    'X-Webhook-Timestamp': payload.timestamp,
    ...customHeaders
  };

  try {
    console.log(`[Webhook] Sending ${payload.event} webhook to ${config.webhook_url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout_seconds * 1000);

    const response = await fetch(config.webhook_url, {
      method: 'POST',
      headers,
      body: payloadJson,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseBody = await response.text();
    const success = response.status >= 200 && response.status < 300;

    console.log(`[Webhook] Response ${response.status} from ${config.webhook_url}: ${success ? 'success' : 'failed'}`);

    // Record webhook delivery
    const deliveryRecord: WebhookDeliveryInsert = {
      webhook_id: config.id,
      audit_id: auditReportId,
      event_type: payload.event,
      payload: payload as any,
      response_status: response.status,
      response_body: responseBody.slice(0, 1000), // Truncate long responses
      delivery_attempts: 1,
      delivered_at: success ? new Date().toISOString() : undefined
    };

    await insertWebhookDelivery(deliveryRecord);

    return {
      success,
      httpStatus: response.status,
      responseBody: responseBody.slice(0, 500) // Return truncated response
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Webhook] Failed to send webhook to ${config.webhook_url}:`, errorMessage);

    // Record failed delivery
    const deliveryRecord: WebhookDeliveryInsert = {
      webhook_config_id: config.id,
      audit_report_id: auditReportId,
      event_type: payload.event,
      payload: payload as any,
      webhook_url: config.webhook_url,
      attempt_number: 1,
      failed_at: new Date().toISOString(),
      error_message: errorMessage
    };

    await insertWebhookDelivery(deliveryRecord);

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Send webhooks to all configured endpoints for a specific event
 */
export async function sendWebhookNotifications(
  event: WebhookPayload['event'],
  auditReportId: string,
  contractAddress: string,
  data: WebhookPayload['data']
): Promise<void> {
  try {
    console.log(`[Webhook] Sending ${event} notifications for audit ${auditReportId}`);

    // Get all active webhook configurations
    const webhookConfigs = getActiveWebhookConfigurations();
    
    if (webhookConfigs.length === 0) {
      console.log('[Webhook] No active webhook configurations found');
      return;
    }

    // Filter configurations that are subscribed to this event
    const relevantConfigs = webhookConfigs.filter(config => {
      const events = JSON.parse(config.events || '[]');
      return events.includes(event);
    });

    if (relevantConfigs.length === 0) {
      console.log(`[Webhook] No webhook configurations subscribed to ${event} event`);
      return;
    }

    // Prepare webhook payload
    const payload: WebhookPayload = {
      event,
      audit_id: auditReportId,
      contract_address: contractAddress,
      timestamp: new Date().toISOString(),
      data: {
        ...data,
        // Add report URL if audit completed successfully
        ...(event === 'audit_completed' && data.status === 'completed' && {
          report_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/audit/report/${auditReportId}`
        })
      }
    };

    console.log(`[Webhook] Sending to ${relevantConfigs.length} webhook(s)`);

    // Send webhooks concurrently
    const webhookPromises = relevantConfigs.map(config => 
      sendWebhook(config, payload, auditReportId)
    );

    const results = await Promise.allSettled(webhookPromises);

    // Log results
    let successCount = 0;
    let failureCount = 0;

    results.forEach((result, index) => {
      const config = relevantConfigs[index];
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successCount++;
          console.log(`[Webhook] Successfully sent to ${config.webhook_url}`);
        } else {
          failureCount++;
          console.error(`[Webhook] Failed to send to ${config.webhook_url}: ${result.value.error}`);
        }
      } else {
        failureCount++;
        console.error(`[Webhook] Error sending to ${config.webhook_url}: ${result.reason}`);
      }
    });

    console.log(`[Webhook] Webhook notifications completed: ${successCount} success, ${failureCount} failed`);

  } catch (error) {
    console.error('[Webhook] Error sending webhook notifications:', error);
  }
}

/**
 * Send audit completed notification
 */
export async function sendAuditCompletedWebhook(
  auditReportId: string,
  contractAddress: string,
  findingsCount: number,
  severityBreakdown: { critical: number; high: number; medium: number; low: number },
  processingTimeMs: number
): Promise<void> {
  await sendWebhookNotifications('audit_completed', auditReportId, contractAddress, {
    status: 'completed',
    findings_count: findingsCount,
    severity_breakdown: severityBreakdown,
    processing_time_ms: processingTimeMs
  });
}

/**
 * Send audit failed notification
 */
export async function sendAuditFailedWebhook(
  auditReportId: string,
  contractAddress: string,
  errorMessage: string,
  processingTimeMs: number
): Promise<void> {
  await sendWebhookNotifications('audit_failed', auditReportId, contractAddress, {
    status: 'failed',
    error_message: errorMessage,
    processing_time_ms: processingTimeMs
  });
}

/**
 * Send audit started notification
 */
export async function sendAuditStartedWebhook(
  auditReportId: string,
  contractAddress: string
): Promise<void> {
  await sendWebhookNotifications('audit_started', auditReportId, contractAddress, {
    status: 'processing'
  });
}

/**
 * Verify webhook signature (for incoming webhook verification)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = generateHmacSignature(payload, secret);
    
    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}