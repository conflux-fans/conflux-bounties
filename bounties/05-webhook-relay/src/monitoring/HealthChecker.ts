import { IHealthChecker, HealthStatus } from './interfaces';
import { Logger } from './Logger';
import { Pool } from 'pg';
import * as os from 'os';

export class HealthChecker implements IHealthChecker {
  private healthChecks: Map<string, HealthCheck> = new Map();
  private logger: Logger;

  constructor() {
    this.logger = new Logger().child({ component: 'HealthChecker' });
    
    // Register default health checks
    this.registerDefaultHealthChecks();
  }

  async checkHealth(): Promise<HealthStatus> {
    const checks: Record<string, boolean> = {};
    let overallHealthy = true;
    let hasUnhealthy = false;

    this.logger.debug('Starting health check', { checkCount: this.healthChecks.size });

    for (const [name, healthCheck] of this.healthChecks.entries()) {
      try {
        const startTime = Date.now();
        const isHealthy = await Promise.race([
          healthCheck.check(),
          this.timeoutPromise(healthCheck.timeout)
        ]);
        
        const duration = Date.now() - startTime;
        checks[name] = isHealthy;
        
        if (!isHealthy) {
          hasUnhealthy = true;
          if (healthCheck.critical) {
            overallHealthy = false;
          }
        }

        this.logger.debug('Health check completed', {
          name,
          healthy: isHealthy,
          duration,
          critical: healthCheck.critical
        });

      } catch (error) {
        checks[name] = false;
        hasUnhealthy = true;
        
        if (healthCheck.critical) {
          overallHealthy = false;
        }

        this.logger.warn('Health check failed', {
          name,
          error: (error as Error).message,
          critical: healthCheck.critical
        });
      }
    }

    const status: HealthStatus['status'] = overallHealthy 
      ? (hasUnhealthy ? 'degraded' : 'healthy')
      : 'unhealthy';

    const healthStatus: HealthStatus = {
      status,
      checks,
      timestamp: new Date(),
      system: await this.getSystemInfo()
    };

    this.logger.info('Health check completed', {
      status,
      totalChecks: Object.keys(checks).length,
      healthyChecks: Object.values(checks).filter(Boolean).length
    });

    return healthStatus;
  }

  registerHealthCheck(
    name: string, 
    check: () => Promise<boolean>, 
    options: HealthCheckOptions = {}
  ): void {
    const {
      timeout = 5000,
      critical = false,
      description = ''
    } = options;

    this.healthChecks.set(name, {
      check,
      timeout,
      critical,
      description
    });

    this.logger.info('Health check registered', {
      name,
      timeout,
      critical,
      description
    });
  }

  unregisterHealthCheck(name: string): void {
    const removed = this.healthChecks.delete(name);
    if (removed) {
      this.logger.info('Health check unregistered', { name });
    }
  }

  getRegisteredChecks(): string[] {
    return Array.from(this.healthChecks.keys());
  }

  // Register database health check
  registerDatabaseHealthCheck(dbPool: Pool): void {
    this.registerHealthCheck(
      'database',
      async () => {
        try {
          const client = await dbPool.connect();
          try {
            await client.query('SELECT 1');
            return true;
          } finally {
            client.release();
          }
        } catch (error) {
          return false;
        }
      },
      {
        timeout: 3000,
        critical: true,
        description: 'PostgreSQL database connectivity'
      }
    );
  }

  // Register memory health check
  registerMemoryHealthCheck(maxMemoryMB: number = 1024): void {
    this.registerHealthCheck(
      'memory',
      async () => {
        const memUsage = process.memoryUsage();
        const memUsageMB = memUsage.heapUsed / 1024 / 1024;
        return memUsageMB < maxMemoryMB;
      },
      {
        timeout: 1000,
        critical: false,
        description: `Memory usage below ${maxMemoryMB}MB`
      }
    );
  }

  // Register disk space health check
  registerDiskSpaceHealthCheck(minFreeSpaceGB: number = 1): void {
    this.registerHealthCheck(
      'disk_space',
      async () => {
        try {
          const fs = await import('fs/promises');
          const stats = await fs.statfs('.');
          const freeSpaceGB = (stats.bavail * stats.bsize) / 1024 / 1024 / 1024;
          return freeSpaceGB > minFreeSpaceGB;
        } catch (error) {
          return false;
        }
      },
      {
        timeout: 2000,
        critical: false,
        description: `Free disk space above ${minFreeSpaceGB}GB`
      }
    );
  }

  private registerDefaultHealthChecks(): void {
    // Basic process health check
    this.registerHealthCheck(
      'process',
      async () => {
        return process.uptime() > 0;
      },
      {
        timeout: 1000,
        critical: true,
        description: 'Process is running'
      }
    );

    // Memory health check with default limit
    this.registerMemoryHealthCheck();
  }

  async getDetailedStatus(): Promise<import('./interfaces').DetailedHealthStatus> {
    const healthStatus = await this.checkHealth();
    
    return {
      ...healthStatus,
      uptime: process.uptime(),
      version: process.env['npm_package_version'] || '1.0.0',
      environment: process.env['NODE_ENV'] || 'development',
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
        rss: process.memoryUsage().rss
      },
      cpu: {
        usage: process.cpuUsage(),
        loadAverage: process.platform !== 'win32' ? os.loadavg() : [0, 0, 0]
      }
    };
  }

  private async getSystemInfo(): Promise<import('./interfaces').SystemInfo> {
    const memUsage = process.memoryUsage();
    
    return {
      uptime: process.uptime(),
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        usage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      cpu: {
        usage: process.cpuUsage(),
        loadAverage: process.platform !== 'win32' ? os.loadavg() : [0, 0, 0]
      },
      platform: process.platform,
      nodeVersion: process.version
    };
  }

  private async timeoutPromise(timeoutMs: number): Promise<boolean> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }
}

interface HealthCheck {
  check: () => Promise<boolean>;
  timeout: number;
  critical: boolean;
  description: string;
}

export interface HealthCheckOptions {
  timeout?: number;
  critical?: boolean;
  description?: string;
}