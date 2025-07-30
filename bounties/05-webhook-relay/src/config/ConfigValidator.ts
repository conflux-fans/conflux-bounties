import { ValidationResult, ValidationError } from '../types';
import { IConfigValidator } from './interfaces';

export class ConfigValidator implements IConfigValidator {
  validateNetworkConfig(config: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!config) {
      errors.push({ field: 'network', message: 'Network configuration is required' });
      return { isValid: false, errors };
    }

    // Validate RPC URL
    if (!config.rpcUrl || typeof config.rpcUrl !== 'string') {
      errors.push({ field: 'network.rpcUrl', message: 'RPC URL is required and must be a string', value: config.rpcUrl });
    } else if (!this.isValidUrl(config.rpcUrl)) {
      errors.push({ field: 'network.rpcUrl', message: 'RPC URL must be a valid URL', value: config.rpcUrl });
    }

    // Validate WebSocket URL (optional)
    if (config.wsUrl && typeof config.wsUrl !== 'string') {
      errors.push({ field: 'network.wsUrl', message: 'WebSocket URL must be a string', value: config.wsUrl });
    } else if (config.wsUrl && !this.isValidUrl(config.wsUrl)) {
      errors.push({ field: 'network.wsUrl', message: 'WebSocket URL must be a valid URL', value: config.wsUrl });
    }

    // Validate chain ID
    if (typeof config.chainId !== 'number' || config.chainId <= 0) {
      errors.push({ field: 'network.chainId', message: 'Chain ID must be a positive number', value: config.chainId });
    }

    // Validate confirmations
    if (typeof config.confirmations !== 'number' || config.confirmations < 0) {
      errors.push({ field: 'network.confirmations', message: 'Confirmations must be a non-negative number', value: config.confirmations });
    }

    return { isValid: errors.length === 0, errors };
  }

  validateDatabaseConfig(config: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!config) {
      errors.push({ field: 'database', message: 'Database configuration is required' });
      return { isValid: false, errors };
    }

    // Validate database URL
    if (!config.url || typeof config.url !== 'string') {
      errors.push({ field: 'database.url', message: 'Database URL is required and must be a string', value: config.url });
    } else if (!this.isValidDatabaseUrl(config.url)) {
      errors.push({ field: 'database.url', message: 'Database URL must be a valid PostgreSQL connection string', value: config.url });
    }

    // Validate pool size
    if (typeof config.poolSize !== 'number' || config.poolSize <= 0) {
      errors.push({ field: 'database.poolSize', message: 'Pool size must be a positive number', value: config.poolSize });
    }

    // Validate connection timeout
    if (typeof config.connectionTimeout !== 'number' || config.connectionTimeout <= 0) {
      errors.push({ field: 'database.connectionTimeout', message: 'Connection timeout must be a positive number', value: config.connectionTimeout });
    }

    return { isValid: errors.length === 0, errors };
  }

  validateSubscriptions(subscriptions: any[]): ValidationResult {
    const errors: ValidationError[] = [];

    if (!Array.isArray(subscriptions)) {
      errors.push({ field: 'subscriptions', message: 'Subscriptions must be an array', value: subscriptions });
      return { isValid: false, errors };
    }

    subscriptions.forEach((subscription, index) => {
      const subscriptionErrors = this.validateSubscription(subscription, `subscriptions[${index}]`);
      errors.push(...subscriptionErrors.errors);
    });

    return { isValid: errors.length === 0, errors };
  }

  private validateSubscription(subscription: any, fieldPrefix: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (!subscription || typeof subscription !== 'object') {
      errors.push({ field: fieldPrefix, message: 'Subscription must be an object', value: subscription });
      return { isValid: false, errors };
    }

    // Validate ID
    if (!subscription.id || typeof subscription.id !== 'string') {
      errors.push({ field: `${fieldPrefix}.id`, message: 'Subscription ID is required and must be a string', value: subscription.id });
    }

    // Validate contract address
    if (!subscription.contractAddress || typeof subscription.contractAddress !== 'string') {
      errors.push({ field: `${fieldPrefix}.contractAddress`, message: 'Contract address is required and must be a string', value: subscription.contractAddress });
    } else if (!this.isValidEthereumAddress(subscription.contractAddress)) {
      errors.push({ field: `${fieldPrefix}.contractAddress`, message: 'Contract address must be a valid Ethereum address', value: subscription.contractAddress });
    }

    // Validate event signature
    if (!subscription.eventSignature || typeof subscription.eventSignature !== 'string') {
      errors.push({ field: `${fieldPrefix}.eventSignature`, message: 'Event signature is required and must be a string', value: subscription.eventSignature });
    }

    // Validate filters (optional)
    if (subscription.filters && typeof subscription.filters !== 'object') {
      errors.push({ field: `${fieldPrefix}.filters`, message: 'Filters must be an object', value: subscription.filters });
    }

    // Validate webhooks
    if (!Array.isArray(subscription.webhooks)) {
      errors.push({ field: `${fieldPrefix}.webhooks`, message: 'Webhooks must be an array', value: subscription.webhooks });
    } else {
      subscription.webhooks.forEach((webhook: any, webhookIndex: number) => {
        const webhookErrors = this.validateWebhook(webhook, `${fieldPrefix}.webhooks[${webhookIndex}]`);
        errors.push(...webhookErrors.errors);
      });
    }

    return { isValid: errors.length === 0, errors };
  }

  private validateWebhook(webhook: any, fieldPrefix: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (!webhook || typeof webhook !== 'object') {
      errors.push({ field: fieldPrefix, message: 'Webhook must be an object', value: webhook });
      return { isValid: false, errors };
    }

    // Validate ID
    if (!webhook.id || typeof webhook.id !== 'string') {
      errors.push({ field: `${fieldPrefix}.id`, message: 'Webhook ID is required and must be a string', value: webhook.id });
    }

    // Validate URL
    if (!webhook.url || typeof webhook.url !== 'string') {
      errors.push({ field: `${fieldPrefix}.url`, message: 'Webhook URL is required and must be a string', value: webhook.url });
    } else if (!this.isValidUrl(webhook.url)) {
      errors.push({ field: `${fieldPrefix}.url`, message: 'Webhook URL must be a valid URL', value: webhook.url });
    }

    // Validate format
    const validFormats = ['zapier', 'make', 'n8n', 'generic'];
    if (!webhook.format || !validFormats.includes(webhook.format)) {
      errors.push({ 
        field: `${fieldPrefix}.format`, 
        message: `Webhook format must be one of: ${validFormats.join(', ')}`, 
        value: webhook.format 
      });
    }

    // Validate headers (optional)
    if (webhook.headers && typeof webhook.headers !== 'object') {
      errors.push({ field: `${fieldPrefix}.headers`, message: 'Webhook headers must be an object', value: webhook.headers });
    }

    // Validate timeout
    if (typeof webhook.timeout !== 'number' || webhook.timeout <= 0) {
      errors.push({ field: `${fieldPrefix}.timeout`, message: 'Webhook timeout must be a positive number', value: webhook.timeout });
    }

    // Validate retry attempts
    if (typeof webhook.retryAttempts !== 'number' || webhook.retryAttempts < 0) {
      errors.push({ field: `${fieldPrefix}.retryAttempts`, message: 'Webhook retry attempts must be a non-negative number', value: webhook.retryAttempts });
    }

    return { isValid: errors.length === 0, errors };
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:', 'ws:', 'wss:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }

  private isValidDatabaseUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'postgresql:' || parsedUrl.protocol === 'postgres:';
    } catch {
      return false;
    }
  }

  private isValidEthereumAddress(address: string): boolean {
    // Basic Ethereum address validation (40 hex characters with 0x prefix)
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}