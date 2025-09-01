// Configuration management interfaces
import type { SystemConfig, ValidationResult } from '../types';

export interface IConfigManager {
  loadConfig(): Promise<SystemConfig>;
  validateConfig(config: SystemConfig): ValidationResult;
  reloadConfig(): Promise<void>;
  onConfigChange(callback: (config: SystemConfig) => void): void;
}

export interface IConfigValidator {
  validateNetworkConfig(config: any): ValidationResult;
  validateDatabaseConfig(config: any): ValidationResult;
  validateSubscriptions(subscriptions: any[]): ValidationResult;
  validateRedisConfig(config: any): ValidationResult;
}