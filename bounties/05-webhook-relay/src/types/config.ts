// Configuration-related type definitions
import type { EventSubscription } from './events';

export interface SystemConfig {
  network: NetworkConfig;
  subscriptions: EventSubscription[];
  database?: DatabaseConfig;
  redis?: RedisConfig;
  monitoring: MonitoringConfig;
  options: SystemOptions;
}

export interface NetworkConfig {
  rpcUrl: string;
  wsUrl?: string;
  chainId: number;
  confirmations: number;
}

export interface DatabaseConfig {
  url: string;
  poolSize?: number;
  connectionTimeout?: number;
}

export interface RedisConfig {
  url: string;
  keyPrefix?: string;
  ttl?: number;
}

export interface MonitoringConfig {
  logLevel: string;
  metricsEnabled: boolean;
  healthCheckPort: number;
  loadHistoricalData?: boolean;
  loadFromDeliveries?: boolean;
  historicalDataHours?: number;
}

export interface SystemOptions {
  maxConcurrentWebhooks: number;
  defaultRetryAttempts: number;
  defaultRetryDelay: number;
  webhookTimeout: number;
  queueProcessingInterval: number;
}