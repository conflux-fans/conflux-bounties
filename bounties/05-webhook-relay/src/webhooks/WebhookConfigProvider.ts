import { IWebhookConfigProvider } from './interfaces';
import { WebhookConfig, WebhookFormat } from '../types';
import { DatabaseConnection } from '../database/connection';
import { Logger } from '../monitoring/Logger';

export class DatabaseWebhookConfigProvider implements IWebhookConfigProvider {
  private cache: Map<string, WebhookConfig> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly cacheTtlMs: number = 5 * 60 * 1000; // 5 minutes
  private logger: Logger;

  constructor(
    private database: DatabaseConnection,
    logger?: Logger
  ) {
    this.logger = logger || new Logger();
  }

  async getWebhookConfig(webhookId: string): Promise<WebhookConfig | null> {
    try {
      // Check cache first
      const cached = this.getCachedConfig(webhookId);
      if (cached) {
        return cached;
      }

      // Load from database
      const config = await this.loadConfigFromDatabase(webhookId);
      if (config) {
        this.setCachedConfig(webhookId, config);
      }

      return config;
    } catch (error) {
      this.logger.error('Failed to get webhook config', error instanceof Error ? error : new Error(String(error)), {
        webhookId
      });
      return null;
    }
  }

  async loadWebhookConfigs(): Promise<void> {
    try {
      this.logger.info('Loading all webhook configurations');
      
      const query = `
        SELECT id, url, format, headers, timeout, retry_attempts
        FROM webhooks 
        WHERE active = true
      `;
      
      const result = await this.database.query(query);
      
      // Clear existing cache
      this.cache.clear();
      this.cacheExpiry.clear();
      
      // Load all configs into cache
      for (const row of result.rows) {
        const config = this.mapRowToConfig(row);
        this.setCachedConfig(config.id, config);
      }
      
      this.logger.info('Loaded webhook configurations', { count: result.rows.length });
    } catch (error) {
      this.logger.error('Failed to load webhook configurations', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async refreshConfigs(): Promise<void> {
    try {
      this.logger.info('Refreshing webhook configurations');
      await this.loadWebhookConfigs();
    } catch (error) {
      this.logger.error('Failed to refresh webhook configurations', error instanceof Error ? error : new Error(String(error)));
      // Don't throw - keep existing cache if refresh fails
    }
  }

  private getCachedConfig(webhookId: string): WebhookConfig | null {
    const config = this.cache.get(webhookId);
    const expiry = this.cacheExpiry.get(webhookId);
    
    if (config && expiry && Date.now() < expiry) {
      return config;
    }
    
    // Remove expired entry
    if (config) {
      this.cache.delete(webhookId);
      this.cacheExpiry.delete(webhookId);
    }
    
    return null;
  }

  private setCachedConfig(webhookId: string, config: WebhookConfig): void {
    this.cache.set(webhookId, config);
    this.cacheExpiry.set(webhookId, Date.now() + this.cacheTtlMs);
  }

  private async loadConfigFromDatabase(webhookId: string): Promise<WebhookConfig | null> {
    try {
      const query = `
        SELECT id, url, format, headers, timeout, retry_attempts
        FROM webhooks 
        WHERE id = $1 AND active = true
      `;
      
      const result = await this.database.query(query, [webhookId]);
      
      if (result.rows.length === 0) {
        this.logger.warn('Webhook config not found', { webhookId });
        return null;
      }
      
      return this.mapRowToConfig(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to load webhook config from database', error instanceof Error ? error : new Error(String(error)), {
        webhookId
      });
      throw error;
    }
  }

  private mapRowToConfig(row: any): WebhookConfig {
    // Parse headers JSON if it's a string
    let headers: Record<string, string> = {};
    if (row.headers) {
      try {
        headers = typeof row.headers === 'string' 
          ? JSON.parse(row.headers) 
          : row.headers;
      } catch (error) {
        this.logger.warn('Failed to parse webhook headers', {
          webhookId: row.id,
          headers: row.headers,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Validate and normalize format
    const validFormats: WebhookFormat[] = ['zapier', 'make', 'n8n', 'generic'];
    const format: WebhookFormat = validFormats.includes(row.format) 
      ? row.format 
      : 'generic';

    if (row.format && !validFormats.includes(row.format)) {
      this.logger.warn('Invalid webhook format, defaulting to generic', {
        webhookId: row.id,
        format: row.format
      });
    }

    return {
      id: row.id,
      url: row.url,
      format,
      headers,
      timeout: row.timeout || 30000, // Default 30 seconds
      retryAttempts: row.retry_attempts || 3 // Default 3 attempts
    };
  }

  // Utility methods for cache management
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
    this.logger.info('Webhook config cache cleared');
  }
}