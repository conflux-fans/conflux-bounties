import { Pool } from 'pg';
import { IMetricsCollector } from './interfaces';
import { Logger } from './Logger';

export class MetricsCollector implements IMetricsCollector {
  private metrics: Map<string, MetricData> = new Map();
  private logger: Logger;
  private dbPool: Pool | undefined;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private readonly flushIntervalMs: number;

  constructor(options: MetricsCollectorOptions = {}) {
    const {
      dbPool,
      flushIntervalMs = 30000, // 30 seconds
      enablePersistence = true
    } = options;

    this.logger = new Logger().child({ component: 'MetricsCollector' });
    this.dbPool = enablePersistence ? dbPool : undefined;
    this.flushIntervalMs = flushIntervalMs;

    if (this.dbPool) {
      this.startPeriodicFlush();
    }
  }

  incrementCounter(name: string, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.metrics.get(key);

    if (existing && existing.type === 'counter') {
      existing.value += 1;
      existing.timestamp = new Date();
    } else {
      this.metrics.set(key, {
        name,
        type: 'counter',
        value: 1,
        labels,
        timestamp: new Date()
      });
    }

    this.logger.debug('Counter incremented', { name, labels, key });
  }

  recordGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels);
    
    this.metrics.set(key, {
      name,
      type: 'gauge',
      value,
      labels,
      timestamp: new Date()
    });

    this.logger.debug('Gauge recorded', { name, value, labels, key });
  }

  recordHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.metrics.get(key);

    if (existing && existing.type === 'histogram') {
      // Simple histogram implementation - store count, sum, and basic percentiles
      const histogramData = existing.histogramData!;
      histogramData.count += 1;
      histogramData.sum += value;
      histogramData.values.push(value);
      
      // Keep only last 1000 values for percentile calculation
      if (histogramData.values.length > 1000) {
        histogramData.values = histogramData.values.slice(-1000);
      }
      
      existing.value = this.calculateP95(histogramData.values);
      existing.timestamp = new Date();
    } else {
      this.metrics.set(key, {
        name,
        type: 'histogram',
        value,
        labels,
        timestamp: new Date(),
        histogramData: {
          count: 1,
          sum: value,
          values: [value]
        }
      });
    }

    this.logger.debug('Histogram recorded', { name, value, labels, key });
  }

  // Get current metrics snapshot
  getMetrics(): Record<string, MetricData> {
    const result: Record<string, MetricData> = {};
    for (const [metricKey, metric] of this.metrics.entries()) {
      result[metricKey] = { ...metric };
    }
    return result;
  }

  // Get metrics for a specific name
  getMetricsByName(name: string): MetricData[] {
    const results: MetricData[] = [];
    for (const [, metric] of this.metrics.entries()) {
      if (metric.name === name) {
        results.push({ ...metric });
      }
    }
    return results;
  }

  // Clear all metrics
  clear(): void {
    this.metrics.clear();
    this.logger.debug('All metrics cleared');
  }

  // Manually flush metrics to database
  async flush(): Promise<void> {
    if (!this.dbPool || this.metrics.size === 0) {
      return;
    }

    const metricsToFlush = Array.from(this.metrics.values());
    
    try {
      const client = await this.dbPool.connect();
      
      try {
        await client.query('BEGIN');
        
        for (const metric of metricsToFlush) {
          await client.query(
            `INSERT INTO metrics (metric_name, metric_value, labels, timestamp) 
             VALUES ($1, $2, $3, $4)`,
            [metric.name, metric.value, JSON.stringify(metric.labels), metric.timestamp]
          );
        }
        
        await client.query('COMMIT');
        this.logger.info('Metrics flushed to database', { count: metricsToFlush.length });
        
        // Clear flushed metrics (keep counters, reset gauges and histograms)
        for (const [metricKey, metric] of this.metrics.entries()) {
          if (metric.type === 'gauge' || metric.type === 'histogram') {
            this.metrics.delete(metricKey);
          }
        }
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      
    } catch (error) {
      this.logger.error('Failed to flush metrics to database', error as Error);
      throw error;
    }
  }

  // Stop the metrics collector
  async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Final flush
    if (this.dbPool) {
      await this.flush();
    }
    
    this.logger.info('MetricsCollector stopped');
  }

  private getMetricKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.keys(labels)
      .sort()
      .map(key => `${key}=${labels[key]}`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  private calculateP95(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(async () => {
      try {
        await this.flush();
      } catch (error) {
        this.logger.error('Periodic metrics flush failed', error as Error);
      }
    }, this.flushIntervalMs);
  }
}

interface MetricData {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  value: number;
  labels: Record<string, string>;
  timestamp: Date;
  histogramData?: {
    count: number;
    sum: number;
    values: number[];
  };
}

export interface MetricsCollectorOptions {
  dbPool?: Pool;
  flushIntervalMs?: number;
  enablePersistence?: boolean;
}