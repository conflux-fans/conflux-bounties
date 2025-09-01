// Monitoring and logging interfaces

type CpuUsage = {
  user: number;
  system: number;
};

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
  system?: SystemInfo;
}

export interface DetailedHealthStatus extends HealthStatus {
  uptime: number;
  version: string;
  environment: string;
  memory: {
    used: number;
    total: number;
    external: number;
    rss: number;
  };
  cpu: {
    usage: CpuUsage;
    loadAverage: number[];
  };
}

export interface SystemInfo {
  uptime: number;
  memory: {
    used: number;
    total: number;
    usage: number;
  };
  cpu: {
    usage: CpuUsage;
    loadAverage: number[];
  };
  platform: string;
  nodeVersion: string;
}