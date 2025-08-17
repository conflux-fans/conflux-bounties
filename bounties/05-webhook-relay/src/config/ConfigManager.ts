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
    // At this point, applyEnvironmentOverrides should have already created the database config
    // from environment variables if needed, so we just validate what's present
    if (config.database) {
      const databaseValidation = this.validator.validateDatabaseConfig(config.database);
      errors.push(...databaseValidation.errors);
    } else {
      errors.push({ 
        field: 'database', 
        message: 'Database configuration is required. Provide either a database section in config.json or set DATABASE_URL environment variable.' 
      });
    }

    // Validate subscriptions
    const subscriptionsValidation = this.validator.validateSubscriptions(config.subscriptions);
    errors.push(...subscriptionsValidation.errors);

    // Validate redis configuration (optional)
    // Redis is optional - only validate if configuration is provided
    if (config.redis) {
      const redisValidation = this.validator.validateRedisConfig(config.redis);
      errors.push(...redisValidation.errors);
    }

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

  /**
   * Apply environment variable overrides to configuration
   * 
   * This method applies environment variable overrides and creates default configurations
   * when environment variables are provided but config.json sections are missing.
   * Environment variables take precedence over config.json values.
   * 
   * Supported environment variables:
   * - DATABASE_URL: Database connection URL
   * - DATABASE_POOL_SIZE: Database connection pool size (default: 10)
   * - DATABASE_CONNECTION_TIMEOUT: Database connection timeout in ms (default: 5000)
   * - REDIS_URL: Redis connection URL
   * - REDIS_KEY_PREFIX: Redis key prefix (default: 'webhook-relay:')
   * - REDIS_TTL: Redis TTL in seconds (default: 3600)
   * - CONFLUX_*: For switching between blockchain networks (testnet/mainnet)
   * - LOG_LEVEL: For debugging purposes
   */
  private applyEnvironmentOverrides(config: SystemConfig): SystemConfig {
    const overriddenConfig = JSON.parse(JSON.stringify(config)); // Deep clone

    // Database configuration - environment-first approach
    // All database configuration is now read from environment variables
    if (process.env['DATABASE_URL']) {
      overriddenConfig.database = {
        url: process.env['DATABASE_URL'],
        poolSize: process.env['DATABASE_POOL_SIZE'] ? parseInt(process.env['DATABASE_POOL_SIZE'], 10) : 10,
        connectionTimeout: process.env['DATABASE_CONNECTION_TIMEOUT'] ? parseInt(process.env['DATABASE_CONNECTION_TIMEOUT'], 10) : 5000
      };
    } else if (overriddenConfig.database) {
      // If config.json has database section but no DATABASE_URL env var, apply defaults for missing optional parameters
      if (overriddenConfig.database.poolSize === undefined) {
        overriddenConfig.database.poolSize = 10;
      }
      if (overriddenConfig.database.connectionTimeout === undefined) {
        overriddenConfig.database.connectionTimeout = 5000;
      }
    }

    // Redis configuration - environment-first approach
    // All redis configuration is now read from environment variables
    if (process.env['REDIS_URL']) {
      overriddenConfig.redis = {
        url: process.env['REDIS_URL'],
        keyPrefix: process.env['REDIS_KEY_PREFIX'] || 'webhook-relay:',
        ttl: process.env['REDIS_TTL'] ? parseInt(process.env['REDIS_TTL'], 10) : 3600
      };
    } else if (overriddenConfig.redis) {
      // If config.json has redis section but no REDIS_URL env var, apply defaults for missing optional parameters
      if (overriddenConfig.redis.keyPrefix === undefined) {
        overriddenConfig.redis.keyPrefix = 'webhook-relay:';
      }
      if (overriddenConfig.redis.ttl === undefined) {
        overriddenConfig.redis.ttl = 3600;
      }
    }

    // Network overrides (for switching between testnet/mainnet)
    if (process.env['CONFLUX_RPC_URL'] && overriddenConfig.network) {
      overriddenConfig.network.rpcUrl = process.env['CONFLUX_RPC_URL'];
    }
    if (process.env['CONFLUX_WS_URL'] && overriddenConfig.network) {
      overriddenConfig.network.wsUrl = process.env['CONFLUX_WS_URL'];
    }
    if (process.env['CONFLUX_CHAIN_ID'] && overriddenConfig.network) {
      overriddenConfig.network.chainId = parseInt(process.env['CONFLUX_CHAIN_ID'], 10);
    }
    if (process.env['CONFLUX_CONFIRMATIONS'] && overriddenConfig.network) {
      overriddenConfig.network.confirmations = parseInt(process.env['CONFLUX_CONFIRMATIONS'], 10);
    }

    // Log level override (for debugging)
    if (process.env['LOG_LEVEL']) {
      overriddenConfig.monitoring.logLevel = process.env['LOG_LEVEL'];
    }

    return overriddenConfig;
  }

  private startConfigWatcher(): void {
    this.watcherAbortController = new AbortController();

    try {
      // Use fs.watch for file system watching
      const fsWatch = require('fs').watch;
      const watcher = fsWatch(this.configPath, { signal: this.watcherAbortController.signal });

      // Handle watcher events using EventEmitter pattern
      watcher.on('change', async (eventType: string) => {
        if (eventType === 'change') {
          try {
            await this.reloadConfig();
          } catch (error) {
            this.emit('error', new Error(`Failed to reload configuration: ${error instanceof Error ? error.message : String(error)}`));
          }
        }
      });

      watcher.on('error', (error: Error) => {
        if ((error as any).name !== 'AbortError') {
          this.emit('error', new Error(`Configuration watcher error: ${error instanceof Error ? error.message : String(error)}`));
        }
      });

      // Handle abort signal
      this.watcherAbortController.signal.addEventListener('abort', () => {
        watcher.close();
      });
    } catch (error) {
      // In test environment or if fs.watch is not available, skip watching
      if (process.env['NODE_ENV'] !== 'test') {
        this.emit('error', new Error(`Failed to start config watcher: ${error instanceof Error ? error.message : String(error)}`));
      }
    }
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