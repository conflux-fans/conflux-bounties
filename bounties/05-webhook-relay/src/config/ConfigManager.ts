import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { SystemConfig, ValidationResult, ValidationError } from '../types';
import { IConfigManager, IConfigValidator } from './interfaces';
import { ConfigValidator } from './ConfigValidator';

export class ConfigManager extends EventEmitter implements IConfigManager {
  private config: SystemConfig | null = null;
  private configPath: string;
  private validator: IConfigValidator;
  private watcherAbortController: AbortController | null = null;

  constructor(configPath: string = 'config.json') {
    super();
    this.configPath = path.resolve(configPath);
    this.validator = new ConfigValidator();
  }

  async loadConfig(): Promise<SystemConfig> {
    try {
      // Load base configuration from file
      const configData = await this.loadConfigFromFile();

      // Apply environment variable overrides
      const configWithOverrides = this.applyEnvironmentOverrides(configData);

      // Validate the final configuration
      const validation = this.validateConfig(configWithOverrides);
      if (!validation.isValid) {
        throw new Error(`Configuration validation failed: ${this.formatValidationErrors(validation.errors)}`);
      }

      this.config = configWithOverrides;

      // Start watching for file changes if not already watching
      if (!this.watcherAbortController) {
        this.startConfigWatcher();
      }

      return this.config;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  validateConfig(config: SystemConfig): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate network configuration
    const networkValidation = this.validator.validateNetworkConfig(config.network);
    errors.push(...networkValidation.errors);

    // Validate database configuration
    const databaseValidation = this.validator.validateDatabaseConfig(config.database);
    errors.push(...databaseValidation.errors);

    // Validate subscriptions
    const subscriptionsValidation = this.validator.validateSubscriptions(config.subscriptions);
    errors.push(...subscriptionsValidation.errors);

    // Validate redis configuration
    const redisValidation = this.validateRedisConfig(config.redis);
    errors.push(...redisValidation.errors);

    // Validate monitoring configuration
    const monitoringValidation = this.validateMonitoringConfig(config.monitoring);
    errors.push(...monitoringValidation.errors);

    // Validate system options
    const optionsValidation = this.validateSystemOptions(config.options);
    errors.push(...optionsValidation.errors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async reloadConfig(): Promise<void> {
    const newConfig = await this.loadConfig();
    this.emit('configChanged', newConfig);
  }

  onConfigChange(callback: (config: SystemConfig) => void): void {
    this.on('configChanged', callback);
  }

  private async loadConfigFromFile(): Promise<SystemConfig> {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(configContent) as SystemConfig;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`Configuration file not found: ${this.configPath}`);
      }
      throw new Error(`Failed to parse configuration file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private applyEnvironmentOverrides(config: SystemConfig): SystemConfig {
    const overriddenConfig = JSON.parse(JSON.stringify(config)); // Deep clone

    // Network overrides
    if (process.env['CONFLUX_RPC_URL']) {
      overriddenConfig.network.rpcUrl = process.env['CONFLUX_RPC_URL'];
    }
    if (process.env['CONFLUX_WS_URL']) {
      overriddenConfig.network.wsUrl = process.env['CONFLUX_WS_URL'];
    }
    if (process.env['CONFLUX_CHAIN_ID']) {
      overriddenConfig.network.chainId = parseInt(process.env['CONFLUX_CHAIN_ID'], 10);
    }
    if (process.env['CONFLUX_CONFIRMATIONS']) {
      overriddenConfig.network.confirmations = parseInt(process.env['CONFLUX_CONFIRMATIONS'], 10);
    }

    // Database overrides
    if (process.env['DATABASE_URL']) {
      overriddenConfig.database.url = process.env['DATABASE_URL'];
    }
    if (process.env['DATABASE_POOL_SIZE']) {
      overriddenConfig.database.poolSize = parseInt(process.env['DATABASE_POOL_SIZE'], 10);
    }
    if (process.env['DATABASE_CONNECTION_TIMEOUT']) {
      overriddenConfig.database.connectionTimeout = parseInt(process.env['DATABASE_CONNECTION_TIMEOUT'], 10);
    }

    // Redis overrides
    if (process.env['REDIS_URL']) {
      overriddenConfig.redis.url = process.env['REDIS_URL'];
    }
    if (process.env['REDIS_KEY_PREFIX']) {
      overriddenConfig.redis.keyPrefix = process.env['REDIS_KEY_PREFIX'];
    }
    if (process.env['REDIS_TTL']) {
      overriddenConfig.redis.ttl = parseInt(process.env['REDIS_TTL'], 10);
    }

    // Monitoring overrides
    if (process.env['LOG_LEVEL']) {
      overriddenConfig.monitoring.logLevel = process.env['LOG_LEVEL'];
    }
    if (process.env['METRICS_ENABLED']) {
      overriddenConfig.monitoring.metricsEnabled = process.env['METRICS_ENABLED'] === 'true';
    }
    if (process.env['HEALTH_CHECK_PORT']) {
      overriddenConfig.monitoring.healthCheckPort = parseInt(process.env['HEALTH_CHECK_PORT'], 10);
    }

    // System options overrides
    if (process.env['MAX_CONCURRENT_WEBHOOKS']) {
      overriddenConfig.options.maxConcurrentWebhooks = parseInt(process.env['MAX_CONCURRENT_WEBHOOKS'], 10);
    }
    if (process.env['DEFAULT_RETRY_ATTEMPTS']) {
      overriddenConfig.options.defaultRetryAttempts = parseInt(process.env['DEFAULT_RETRY_ATTEMPTS'], 10);
    }
    if (process.env['DEFAULT_RETRY_DELAY']) {
      overriddenConfig.options.defaultRetryDelay = parseInt(process.env['DEFAULT_RETRY_DELAY'], 10);
    }
    if (process.env['WEBHOOK_TIMEOUT']) {
      overriddenConfig.options.webhookTimeout = parseInt(process.env['WEBHOOK_TIMEOUT'], 10);
    }
    if (process.env['QUEUE_PROCESSING_INTERVAL']) {
      overriddenConfig.options.queueProcessingInterval = parseInt(process.env['QUEUE_PROCESSING_INTERVAL'], 10);
    }

    return overriddenConfig;
  }

  private startConfigWatcher(): void {
    this.watcherAbortController = new AbortController();

    try {
      // Use fs.watch for file system watching
      const fsWatch = require('fs').watch;
      const watcher = fsWatch(this.configPath, { signal: this.watcherAbortController.signal });

      (async () => {
        try {
          for await (const event of watcher) {
            if (event.eventType === 'change') {
              try {
                await this.reloadConfig();
              } catch (error) {
                this.emit('error', new Error(`Failed to reload configuration: ${error instanceof Error ? error.message : String(error)}`));
              }
            }
          }
        } catch (error) {
          if ((error as any).name !== 'AbortError') {
            this.emit('error', new Error(`Configuration watcher error: ${error instanceof Error ? error.message : String(error)}`));
          }
        }
      })();
    } catch (error) {
      // In test environment or if fs.watch is not available, skip watching
      if (process.env['NODE_ENV'] !== 'test') {
        this.emit('error', new Error(`Failed to start config watcher: ${error instanceof Error ? error.message : String(error)}`));
      }
    }
  }

  private validateRedisConfig(config: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!config) {
      errors.push({ field: 'redis', message: 'Redis configuration is required' });
      return { isValid: false, errors };
    }

    if (!config.url || typeof config.url !== 'string') {
      errors.push({ field: 'redis.url', message: 'Redis URL is required and must be a string', value: config.url });
    }

    if (!config.keyPrefix || typeof config.keyPrefix !== 'string') {
      errors.push({ field: 'redis.keyPrefix', message: 'Redis key prefix is required and must be a string', value: config.keyPrefix });
    }

    if (typeof config.ttl !== 'number' || config.ttl <= 0) {
      errors.push({ field: 'redis.ttl', message: 'Redis TTL must be a positive number', value: config.ttl });
    }

    return { isValid: errors.length === 0, errors };
  }

  private validateMonitoringConfig(config: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!config) {
      errors.push({ field: 'monitoring', message: 'Monitoring configuration is required' });
      return { isValid: false, errors };
    }

    const validLogLevels = ['error', 'warn', 'info', 'debug'];
    if (!config.logLevel || !validLogLevels.includes(config.logLevel)) {
      errors.push({
        field: 'monitoring.logLevel',
        message: `Log level must be one of: ${validLogLevels.join(', ')}`,
        value: config.logLevel
      });
    }

    if (typeof config.metricsEnabled !== 'boolean') {
      errors.push({ field: 'monitoring.metricsEnabled', message: 'Metrics enabled must be a boolean', value: config.metricsEnabled });
    }

    if (typeof config.healthCheckPort !== 'number' || config.healthCheckPort <= 0 || config.healthCheckPort > 65535) {
      errors.push({
        field: 'monitoring.healthCheckPort',
        message: 'Health check port must be a number between 1 and 65535',
        value: config.healthCheckPort
      });
    }

    return { isValid: errors.length === 0, errors };
  }

  private validateSystemOptions(config: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!config) {
      errors.push({ field: 'options', message: 'System options configuration is required' });
      return { isValid: false, errors };
    }

    if (typeof config.maxConcurrentWebhooks !== 'number' || config.maxConcurrentWebhooks <= 0) {
      errors.push({
        field: 'options.maxConcurrentWebhooks',
        message: 'Max concurrent webhooks must be a positive number',
        value: config.maxConcurrentWebhooks
      });
    }

    if (typeof config.defaultRetryAttempts !== 'number' || config.defaultRetryAttempts < 0) {
      errors.push({
        field: 'options.defaultRetryAttempts',
        message: 'Default retry attempts must be a non-negative number',
        value: config.defaultRetryAttempts
      });
    }

    if (typeof config.defaultRetryDelay !== 'number' || config.defaultRetryDelay <= 0) {
      errors.push({
        field: 'options.defaultRetryDelay',
        message: 'Default retry delay must be a positive number',
        value: config.defaultRetryDelay
      });
    }

    if (typeof config.webhookTimeout !== 'number' || config.webhookTimeout <= 0) {
      errors.push({
        field: 'options.webhookTimeout',
        message: 'Webhook timeout must be a positive number',
        value: config.webhookTimeout
      });
    }

    if (typeof config.queueProcessingInterval !== 'number' || config.queueProcessingInterval <= 0) {
      errors.push({
        field: 'options.queueProcessingInterval',
        message: 'Queue processing interval must be a positive number',
        value: config.queueProcessingInterval
      });
    }

    return { isValid: errors.length === 0, errors };
  }

  private formatValidationErrors(errors: ValidationError[]): string {
    return errors.map(error => `${error.field}: ${error.message}`).join('; ');
  }

  public stopWatching(): void {
    if (this.watcherAbortController) {
      this.watcherAbortController.abort();
      this.watcherAbortController = null;
    }
  }

  public getCurrentConfig(): SystemConfig | null {
    return this.config;
  }
}