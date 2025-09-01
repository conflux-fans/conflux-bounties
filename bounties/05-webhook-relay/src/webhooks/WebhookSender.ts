import type { IWebhookSender, IHttpClient, IDeliveryTracker } from './interfaces';
import type { WebhookDelivery, WebhookConfig, DeliveryResult, ValidationResult } from '../types';
import { HttpClient } from './HttpClient';
import { DeliveryTracker } from './DeliveryTracker';
import { CircuitBreaker } from './CircuitBreaker';
import { createFormatter, getSupportedFormats } from '../formatting';

export class WebhookSender implements IWebhookSender {
  private httpClient: IHttpClient;
  private deliveryTracker: IDeliveryTracker;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor(
    httpClient?: IHttpClient,
    deliveryTracker?: IDeliveryTracker
  ) {
    this.httpClient = httpClient || new HttpClient();
    this.deliveryTracker = deliveryTracker || new DeliveryTracker();
  }

  async sendWebhook(delivery: WebhookDelivery, webhookConfig?: WebhookConfig): Promise<DeliveryResult> {
    // Use provided config or try to get it from internal storage
    const config = webhookConfig || this.getWebhookConfig(delivery.webhookId);

    if (!config) {
      const result: DeliveryResult = {
        success: false,
        responseTime: 0,
        error: `Webhook configuration not found for ID: ${delivery.webhookId}`,
      };

      await this.deliveryTracker.trackDelivery(delivery, result);
      return result;
    }

    // Validate webhook config before sending
    const validation = this.validateWebhookConfig(config);
    if (!validation.isValid) {
      const result: DeliveryResult = {
        success: false,
        responseTime: 0,
        error: `Invalid webhook configuration: ${validation.errors.map(e => e.message).join(', ')}`,
      };

      await this.deliveryTracker.trackDelivery(delivery, result);
      return result;
    }

    // Check circuit breaker before attempting delivery
    const circuitBreaker = this.getCircuitBreaker(delivery.webhookId);
    if (!circuitBreaker.canExecute()) {
      const stats = circuitBreaker.getStats();
      const result: DeliveryResult = {
        success: false,
        responseTime: 0,
        error: `Circuit breaker is ${stats.state} for webhook ${delivery.webhookId}. Next attempt: ${stats.nextAttemptTime}`,
      };

      await this.deliveryTracker.trackDelivery(delivery, result);
      return result;
    }

    try {
      // Always format the event data according to the webhook format
      // The delivery.payload is for internal tracking, not for webhook delivery
      const payloadToSend = this.formatPayload(delivery.event, config.format);

      // Apply per-webhook headers and authentication from webhook configuration
      // Ensure Content-Type is set if not provided by webhook config
      const headers = {
        'Content-Type': 'application/json',
        ...config.headers // Per-webhook headers override defaults
      };

      const result = await this.httpClient.post(
        config.url,
        payloadToSend,
        headers,
        config.timeout
      );

      // Record success in circuit breaker
      if (result.success) {
        circuitBreaker.recordSuccess();
      } else {
        circuitBreaker.recordFailure();
      }

      // Track the delivery result
      await this.deliveryTracker.trackDelivery(delivery, result);

      return result;
    } catch (error) {
      // Record failure in circuit breaker
      circuitBreaker.recordFailure();

      const result: DeliveryResult = {
        success: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error during webhook delivery',
      };

      await this.deliveryTracker.trackDelivery(delivery, result);
      return result;
    }
  }

  // Method to format payload based on webhook format
  private formatPayload(event: any, format: string): any {
    try {
      // Validate format is supported
      const supportedFormats = getSupportedFormats();
      if (!supportedFormats.includes(format as any)) {
        throw new Error(`Unsupported webhook format: ${format}. Supported formats: ${supportedFormats.join(', ')}`);
      }

      // Create formatter and format the payload
      const formatter = createFormatter(format as any);
      
      // Validate the formatter before using it
      if (!formatter.validateFormat()) {
        throw new Error(`Formatter validation failed for format: ${format}`);
      }

      return formatter.formatPayload(event);
    } catch (error) {
      throw new Error(`Failed to format payload for format '${format}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  validateWebhookConfig(config: WebhookConfig): ValidationResult {
    const errors: Array<{ field: string; message: string; value?: any }> = [];

    // Validate URL
    if (!config.url) {
      errors.push({
        field: 'url',
        message: 'URL is required',
        value: config.url,
      });
    } else {
      try {
        const url = new URL(config.url);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push({
            field: 'url',
            message: 'URL must use HTTP or HTTPS protocol',
            value: config.url,
          });
        }
      } catch {
        errors.push({
          field: 'url',
          message: 'Invalid URL format',
          value: config.url,
        });
      }
    }

    // Validate format
    const validFormats = getSupportedFormats();
    if (!validFormats.includes(config.format)) {
      errors.push({
        field: 'format',
        message: `Format must be one of: ${validFormats.join(', ')}`,
        value: config.format,
      });
    }

    // Validate timeout
    if (typeof config.timeout !== 'number' || config.timeout <= 0) {
      errors.push({
        field: 'timeout',
        message: 'Timeout must be a positive number',
        value: config.timeout,
      });
    } else if (config.timeout > 300000) { // 5 minutes max
      errors.push({
        field: 'timeout',
        message: 'Timeout cannot exceed 300000ms (5 minutes)',
        value: config.timeout,
      });
    }

    // Validate retry attempts
    if (typeof config.retryAttempts !== 'number' || config.retryAttempts < 0) {
      errors.push({
        field: 'retryAttempts',
        message: 'Retry attempts must be a non-negative number',
        value: config.retryAttempts,
      });
    } else if (config.retryAttempts > 10) {
      errors.push({
        field: 'retryAttempts',
        message: 'Retry attempts cannot exceed 10',
        value: config.retryAttempts,
      });
    }

    // Validate headers
    if (config.headers && typeof config.headers !== 'object') {
      errors.push({
        field: 'headers',
        message: 'Headers must be an object',
        value: config.headers,
      });
    } else if (config.headers) {
      // Check for invalid header names/values
      for (const [key, value] of Object.entries(config.headers)) {
        if (typeof key !== 'string' || key.trim() === '') {
          errors.push({
            field: 'headers',
            message: 'Header names must be non-empty strings',
            value: key,
          });
        }
        if (typeof value !== 'string') {
          errors.push({
            field: 'headers',
            message: 'Header values must be strings',
            value: value,
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Helper method to get webhook config - in a real implementation, this would
  // fetch from a database or configuration store
  private getWebhookConfig(webhookId: string): WebhookConfig | null {
    // Check test configs first (for testing purposes)
    if (this.testWebhookConfigs && this.testWebhookConfigs.has(webhookId)) {
      return this.testWebhookConfigs.get(webhookId) || null;
    }

    // This is a placeholder - in a real implementation, you would fetch
    // the webhook configuration from your data store
    // For now, return null to indicate config not found
    return null;
  }

  // Method to set webhook config for testing purposes
  public setWebhookConfigForTesting(webhookId: string, config: WebhookConfig | null): void {
    // Store the config in a map for testing
    if (!this.testWebhookConfigs) {
      this.testWebhookConfigs = new Map();
    }
    if (config === null) {
      this.testWebhookConfigs.delete(webhookId);
    } else {
      this.testWebhookConfigs.set(webhookId, config);
    }
  }

  private testWebhookConfigs?: Map<string, WebhookConfig>;

  // Method to get delivery statistics
  async getDeliveryStats(webhookId: string) {
    return this.deliveryTracker.getDeliveryStats(webhookId);
  }

  // Get or create circuit breaker for webhook
  private getCircuitBreaker(webhookId: string): CircuitBreaker {
    if (!this.circuitBreakers.has(webhookId)) {
      this.circuitBreakers.set(webhookId, new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        monitoringWindow: 300000 // 5 minutes
      }));
    }
    return this.circuitBreakers.get(webhookId)!;
  }

  // Get circuit breaker stats for monitoring
  getCircuitBreakerStats(webhookId: string) {
    const circuitBreaker = this.circuitBreakers.get(webhookId);
    return circuitBreaker ? circuitBreaker.getStats() : null;
  }

  // Reset circuit breaker for webhook
  resetCircuitBreaker(webhookId: string): void {
    const circuitBreaker = this.circuitBreakers.get(webhookId);
    if (circuitBreaker) {
      circuitBreaker.reset();
    }
  }

  // Force circuit breaker to open state
  forceCircuitBreakerOpen(webhookId: string): void {
    const circuitBreaker = this.getCircuitBreaker(webhookId);
    circuitBreaker.forceOpen();
  }
}
