// Monitoring and logging interfaces

export interface ILogger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: Error, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export interface IMetricsCollector {
  incrementCounter(name: string, labels?: Record<string, string>): void;
  recordGauge(name: string, value: number, labels?: Record<string, string>): void;
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void;
}

export interface IHealthChecker {
  checkHealth(): Promise<HealthStatus>;
  registerHealthCheck(name: string, check: () => Promise<boolean>): void;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: Record<string, boolean>;
  timestamp: Date;
}