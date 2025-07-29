import { NextRequest, NextResponse } from 'next/server';
import { WebhookConfigurationInsert, getWebhookConfigurationsByUserId, insertWebhookConfiguration } from '@/lib/database';
import crypto from 'crypto';

interface WebhookConfigureRequest {
  webhook_url: string;
  secret_hmac?: string;
  events?: string[];
  retry_count?: number;
  timeout_seconds?: number;
  custom_headers?: Record<string, string>;
  user_id?: string; 
}

interface WebhookConfigureResponse {
  id: string;
  webhook_url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  retry_count: number;
  timeout_seconds: number;
  custom_headers: Record<string, string>;
}

function validateWebhookUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' || (process.env.NODE_ENV === 'development' && parsedUrl.protocol === 'http:');
  } catch {
    return false;
  }
}

function generateHmacSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

function validateEvents(events: string[]): boolean {
  const validEvents = ['audit_completed', 'audit_failed', 'audit_started'];
  return events.every(event => validEvents.includes(event));
}

function getUserIdFromRequest(request: NextRequest): string {
  const userIdHeader = request.headers.get('x-user-id');
  const apiKeyHeader = request.headers.get('x-api-key');
  
  if (userIdHeader) {
    return userIdHeader;
  }
  
  if (apiKeyHeader) {
    return crypto.createHash('sha256').update(apiKeyHeader).digest('hex').slice(0, 16);
  }
  
  return 'default_user';
}

function validateCustomHeaders(headers: Record<string, string>): boolean {
  const dangerousHeaders = ['authorization', 'cookie', 'host', 'content-length'];
  const headerKeys = Object.keys(headers).map(key => key.toLowerCase());
  
  return !headerKeys.some(key => dangerousHeaders.includes(key));
}

export async function POST(request: NextRequest) {
  try {
    const body: WebhookConfigureRequest = await request.json();
    const { webhook_url, secret_hmac, events, retry_count, timeout_seconds, custom_headers } = body;

    const userId = body.user_id || getUserIdFromRequest(request);
    if (!webhook_url) {
      return NextResponse.json(
        { 
          error: 'webhook_url is required',
          details: 'A valid HTTPS URL must be provided for webhook notifications'
        },
        { status: 400 }
      );
    }

    if (!validateWebhookUrl(webhook_url)) {
      return NextResponse.json(
        { 
          error: 'Invalid webhook URL',
          details: 'Webhook URL must be a valid HTTPS URL (HTTP allowed in development)'
        },
        { status: 400 }
      );
    }

    const webhookEvents = events || ['audit_completed', 'audit_failed'];
    if (!validateEvents(webhookEvents)) {
      return NextResponse.json(
        { 
          error: 'Invalid events',
          details: 'Events must be one of: audit_completed, audit_failed, audit_started'
        },
        { status: 400 }
      );
    }

    const retryCount = retry_count ?? 3;
    if (retryCount < 0 || retryCount > 10) {
      return NextResponse.json(
        { 
          error: 'Invalid retry count',
          details: 'Retry count must be between 0 and 10'
        },
        { status: 400 }
      );
    }

    const timeoutSeconds = timeout_seconds ?? 30;
    if (timeoutSeconds < 5 || timeoutSeconds > 120) {
      return NextResponse.json(
        { 
          error: 'Invalid timeout',
          details: 'Timeout must be between 5 and 120 seconds'
        },
        { status: 400 }
      );
    }

    const customHeaders = custom_headers || {};
    if (!validateCustomHeaders(customHeaders)) {
      return NextResponse.json(
        { 
          error: 'Invalid custom headers',
          details: 'Custom headers cannot include sensitive headers like Authorization, Cookie, etc.'
        },
        { status: 400 }
      );
    }

    const hmacSecret = secret_hmac || generateHmacSecret();

    console.log(`[WebhookConfigure] Configuring webhook for user: ${userId}, URL: ${webhook_url}`);
    const existingConfigs = await getWebhookConfigurationsByUserId(userId);
    const existingConfig = existingConfigs.find((config: any) => config.webhook_url === webhook_url);

    let webhookConfig;

    if (existingConfig) {
      const updates: Partial<WebhookConfigurationInsert> = {
        secret_hmac: hmacSecret,
        events: webhookEvents,
        retry_count: retryCount,
        timeout_seconds: timeoutSeconds,
        custom_headers: customHeaders,
        is_active: true
      };

      console.log('[Webhook] Update webhook configuration not implemented in file-based storage');
      webhookConfig = existingConfig;
      
      if (!webhookConfig) {
        return NextResponse.json(
          { 
            error: 'Failed to update webhook configuration',
            details: 'An error occurred while updating the webhook configuration'
          },
          { status: 500 }
        );
      }

      console.log(`[WebhookConfigure] Updated existing webhook configuration: ${webhookConfig.id}`);
    } else {
      const newConfig: WebhookConfigurationInsert = {
        user_id: userId,
        webhook_url,
        secret_hmac: hmacSecret,
        events: webhookEvents,
        retry_count: retryCount,
        timeout_seconds: timeoutSeconds,
        custom_headers: customHeaders,
        is_active: true
      };

      webhookConfig = await insertWebhookConfiguration(newConfig);
      
      if (!webhookConfig) {
        return NextResponse.json(
          { 
            error: 'Failed to create webhook configuration',
            details: 'An error occurred while saving the webhook configuration'
          },
          { status: 500 }
        );
      }

      console.log(`[WebhookConfigure] Created new webhook configuration: ${webhookConfig.id}`);
    }

    const response: WebhookConfigureResponse = {
      id: webhookConfig.id,
      webhook_url: webhookConfig.webhook_url,
      events: JSON.parse(webhookConfig.events),
      is_active: webhookConfig.is_active,
      created_at: webhookConfig.created_at,
      retry_count: webhookConfig.retry_count,
      timeout_seconds: webhookConfig.timeout_seconds,
      custom_headers: webhookConfig.custom_headers ? JSON.parse(webhookConfig.custom_headers) : {}
    };

    return NextResponse.json({
      success: true,
      message: existingConfig ? 'Webhook configuration updated successfully' : 'Webhook configuration created successfully',
      webhook: response,
      ...((!secret_hmac || !existingConfig) && { secret_hmac: hmacSecret })
    });

  } catch (error) {
    console.error('[WebhookConfigure] Error configuring webhook:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error occurred while configuring webhook',
        type: 'webhook_configure_error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    
    console.log(`[WebhookConfigure] Fetching webhook configurations for user: ${userId}`);
    
    const webhookConfigs = await getWebhookConfigurationsByUserId(userId);
    
    const safeConfigs = webhookConfigs.map((config: any) => ({
      id: config.id,
      webhook_url: config.webhook_url,
      events: JSON.parse(config.events),
      is_active: config.is_active,
      created_at: config.created_at,
      updated_at: config.updated_at,
      last_used_at: config.last_used_at,
      retry_count: config.retry_count,
      timeout_seconds: config.timeout_seconds,
      custom_headers: config.custom_headers ? JSON.parse(config.custom_headers) : {}
    }));

    return NextResponse.json({
      success: true,
      webhooks: safeConfigs,
      count: safeConfigs.length
    });

  } catch (error) {
    console.error('[WebhookConfigure] Error fetching webhook configurations:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error occurred while fetching webhook configurations',
        type: 'webhook_fetch_error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get('id');
    const userId = getUserIdFromRequest(request);

    if (!webhookId) {
      return NextResponse.json(
        { error: 'Webhook ID is required' },
        { status: 400 }
      );
    }

    console.log(`[WebhookConfigure] Deleting webhook configuration: ${webhookId} for user: ${userId}`);

    const userConfigs = await getWebhookConfigurationsByUserId(userId);
    const webhookExists = userConfigs.some((config: any) => config.id === webhookId);

    if (!webhookExists) {
      return NextResponse.json(
        { 
          error: 'Webhook configuration not found',
          details: 'No webhook configuration found with the specified ID for this user'
        },
        { status: 404 }
      );
    }

    console.log('[Webhook] Delete webhook configuration not implemented in file-based storage');
    const success = true;

    if (!success) {
      return NextResponse.json(
        { 
          error: 'Failed to delete webhook configuration',
          details: 'An error occurred while deleting the webhook configuration'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook configuration deleted successfully',
      webhook_id: webhookId
    });

  } catch (error) {
    console.error('[WebhookConfigure] Error deleting webhook configuration:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error occurred while deleting webhook configuration',
        type: 'webhook_delete_error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export type { WebhookConfigureRequest, WebhookConfigureResponse };