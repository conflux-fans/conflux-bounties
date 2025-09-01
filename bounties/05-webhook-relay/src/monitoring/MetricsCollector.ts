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
      enablePersistence = true,
      loadHistoricalData = false,
      historicalDataHours = 24,
      loadFromDeliveries = false
    } = options;

    this.logger = new Logger().child({ component: 'MetricsCollector' });
    this.dbPool = enablePersistence ? dbPool : undefined;
    this.flushIntervalMs = flushIntervalMs;

    if (this.dbPool) {
      this.startPeriodicFlush();

      if (loadHistoricalData) {
        if (loadFromDeliveries) {
          this.loadMetricsFromDeliveries(historicalDataHours).catch(error => {
            this.logger.error('Failed to load metrics from deliveries', error as Error);
          });
        } else {
          this.loadHistoricalMetrics(historicalDataHours).catch(error => {
            this.logger.error('Failed to load historical metrics', error as Error);
          });
        }
      }
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

    this.logger.debug('Gauge recorded', {
      name,
      value,
      labels,
      key,
      totalMetrics: this.metrics.size
    });
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

  // Get metrics in Prometheus format
  getPrometheusMetrics(): string {
    this.logger.debug('Getting Prometheus metrics', {
      metricsCount: this.metrics.size,
      metricNames: Array.from(this.metrics.keys())
    });

    if (this.metrics.size === 0) {
      this.logger.warn('No metrics available for Prometheus export');
      return '# No metrics available\n';
    }

    const lines: string[] = [];
    const metricGroups = new Map<string, MetricData[]>();

    // Group metrics by name
    for (const metric of this.metrics.values()) {
      if (!metricGroups.has(metric.name)) {
        metricGroups.set(metric.name, []);
      }
      metricGroups.get(metric.name)!.push(metric);
    }

    // Generate Prometheus format for each metric group
    for (const [metricName, metrics] of metricGroups.entries()) {
      if (metrics.length === 0) continue;

      const firstMetric = metrics[0]!; // We know it exists due to the check above

      // Add HELP comment
      lines.push(`# HELP ${metricName} ${this.getMetricHelp(metricName)}`);

      // Add TYPE comment
      lines.push(`# TYPE ${metricName} ${this.getPrometheusType(firstMetric.type)}`);

      // Add metric lines
      for (const metric of metrics) {
        const labelStr = this.formatPrometheusLabels(metric.labels);
        const metricLine = labelStr
          ? `${metricName}{${labelStr}} ${metric.value}`
          : `${metricName} ${metric.value}`;
        lines.push(metricLine);

        // Add histogram buckets if it's a histogram
        if (metric.type === 'histogram' && metric.histogramData) {
          const histData = metric.histogramData;
          const baseName = metricName.replace(/_duration_ms$/, '').replace(/_time_ms$/, '');

          // Add count and sum
          const countLine = labelStr
            ? `${baseName}_count{${labelStr}} ${histData.count}`
            : `${baseName}_count ${histData.count}`;
          const sumLine = labelStr
            ? `${baseName}_sum{${labelStr}} ${histData.sum}`
            : `${baseName}_sum ${histData.sum}`;

          lines.push(countLine);
          lines.push(sumLine);
        }
      }

      lines.push(''); // Empty line between metric groups
    }

    return lines.join('\n');
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
          // Generate a unique ID for the metric record
          const metricId = `${metric.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          await client.query(
            `INSERT INTO metrics (id, metric_name, metric_value, labels, timestamp) 
             VALUES ($1, $2, $3, $4, $5)`,
            [metricId, metric.name, metric.value, JSON.stringify(metric.labels), metric.timestamp]
          );
        }

        await client.query('COMMIT');
        this.logger.info('Metrics flushed to database', { count: metricsToFlush.length });

        // Clear gauges and histograms after successful flush, but keep counters
        // Counters are cumulative and should persist across flushes
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

  // Load historical metrics from database
  async loadHistoricalMetrics(hours: number = 24): Promise<void> {
    if (!this.dbPool) {
      this.logger.warn('Cannot load historical metrics: no database pool configured');
      return;
    }

    try {
      const client = await this.dbPool.connect();

      try {
        const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);

        const result = await client.query(
          `SELECT metric_name, metric_value, labels, timestamp 
           FROM metrics 
           WHERE timestamp >= $1 
           ORDER BY timestamp DESC`,
          [hoursAgo]
        );

        let loadedCount = 0;
        for (const row of result.rows) {
          const labels = row.labels || {};
          const key = this.getMetricKey(row.metric_name, labels);

          // Only load if we don't already have this metric (don't overwrite current data)
          if (!this.metrics.has(key)) {
            // Determine metric type based on name patterns
            let type: 'counter' | 'gauge' | 'histogram' = 'gauge';
            if (row.metric_name.endsWith('_total')) {
              type = 'counter';
            } else if (row.metric_name.includes('_duration_') || row.metric_name.includes('_time_')) {
              type = 'histogram';
            }

            this.metrics.set(key, {
              name: row.metric_name,
              type,
              value: parseFloat(row.metric_value),
              labels,
              timestamp: new Date(row.timestamp)
            });
            loadedCount++;
          }
        }

        this.logger.info('Historical metrics loaded from database', {
          loadedCount,
          totalRows: result.rows.length,
          hoursBack: hours,
          currentMetricsCount: this.metrics.size
        });

      } finally {
        client.release();
      }

    } catch (error) {
      this.logger.error('Failed to load historical metrics from database', error as Error);
      throw error;
    }
  }

  // Load metrics from deliveries table
  async loadMetricsFromDeliveries(hours: number = 24): Promise<void> {
    if (!this.dbPool) {
      this.logger.warn('Cannot load metrics from deliveries: no database pool configured');
      return;
    }

    try {
      const client = await this.dbPool.connect();

      try {
        const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);

        const result = await client.query(
          `SELECT id, webhook_id, status, payload, created_at, completed_at, 
                  response_status, response_time, attempts, error_message,
                  subscription_id
           FROM deliveries 
           WHERE created_at >= $1 
           ORDER BY created_at ASC`,
          [hoursAgo]
        );

        this.logger.info('Loading metrics from deliveries', {
          deliveryCount: result.rows.length,
          hoursBack: hours
        });

        // Process deliveries and generate metrics
        await this.processDeliveriesIntoMetrics(result.rows);

        this.logger.info('Metrics loaded from deliveries', {
          deliveryCount: result.rows.length,
          generatedMetrics: this.metrics.size,
          hoursBack: hours
        });

      } finally {
        client.release();
      }

    } catch (error) {
      this.logger.error('Failed to load metrics from deliveries', error as Error);
      throw error;
    }
  }

  // Process delivery records into metrics
  private async processDeliveriesIntoMetrics(deliveries: any[]): Promise<void> {
    const statusCounts = new Map<string, Map<string, number>>();
    const responseTimes: number[] = [];
    const webhookStats = new Map<string, { total: number; success: number; failure: number; avgResponseTime: number; responseTimes: number[] }>();
    const subscriptionStats = new Map<string, { total: number; success: number; failure: number }>();
    const hourlyStats = new Map<string, { total: number; success: number; failure: number }>();

    for (const delivery of deliveries) {
      const webhookId = delivery.webhook_id || 'unknown';
      const subscriptionId = delivery.subscription_id || 'unknown';
      const status = delivery.status;
      const responseTime = delivery.response_time;
      const createdAt = new Date(delivery.created_at);
      const hour = createdAt.toISOString().substring(0, 13); // YYYY-MM-DDTHH

      // Count by status
      if (!statusCounts.has(status)) {
        statusCounts.set(status, new Map());
      }
      const statusMap = statusCounts.get(status)!;
      statusMap.set('total', (statusMap.get('total') || 0) + 1);

      // Webhook statistics
      if (!webhookStats.has(webhookId)) {
        webhookStats.set(webhookId, { total: 0, success: 0, failure: 0, avgResponseTime: 0, responseTimes: [] });
      }
      const webhookStat = webhookStats.get(webhookId)!;
      webhookStat.total++;

      if (status === 'completed') {
        webhookStat.success++;
      } else if (status === 'failed') {
        webhookStat.failure++;
      }

      if (responseTime && responseTime > 0) {
        webhookStat.responseTimes.push(responseTime);
        responseTimes.push(responseTime);
      }

      // Subscription statistics
      if (!subscriptionStats.has(subscriptionId)) {
        subscriptionStats.set(subscriptionId, { total: 0, success: 0, failure: 0 });
      }
      const subStat = subscriptionStats.get(subscriptionId)!;
      subStat.total++;

      if (status === 'completed') {
        subStat.success++;
      } else if (status === 'failed') {
        subStat.failure++;
      }

      // Hourly statistics
      if (!hourlyStats.has(hour)) {
        hourlyStats.set(hour, { total: 0, success: 0, failure: 0 });
      }
      const hourlyStat = hourlyStats.get(hour)!;
      hourlyStat.total++;

      if (status === 'completed') {
        hourlyStat.success++;
      } else if (status === 'failed') {
        hourlyStat.failure++;
      }
    }

    // Generate counter metrics for delivery status
    for (const [status, statusMap] of statusCounts.entries()) {
      for (const [type, count] of statusMap.entries()) {
        const metricName = `webhook_deliveries_${status}_total`;
        const key = this.getMetricKey(metricName, { type });

        this.metrics.set(key, {
          name: metricName,
          type: 'counter',
          value: count,
          labels: { type },
          timestamp: new Date()
        });
      }
    }

    // Generate webhook-specific metrics
    for (const [webhookId, stats] of webhookStats.entries()) {
      // Total deliveries per webhook
      this.metrics.set(this.getMetricKey('webhook_deliveries_total', { webhook_id: webhookId }), {
        name: 'webhook_deliveries_total',
        type: 'counter',
        value: stats.total,
        labels: { webhook_id: webhookId },
        timestamp: new Date()
      });

      // Success deliveries per webhook
      this.metrics.set(this.getMetricKey('webhook_delivery_success_total', { webhook_id: webhookId }), {
        name: 'webhook_delivery_success_total',
        type: 'counter',
        value: stats.success,
        labels: { webhook_id: webhookId },
        timestamp: new Date()
      });

      // Failed deliveries per webhook
      this.metrics.set(this.getMetricKey('webhook_delivery_failure_total', { webhook_id: webhookId }), {
        name: 'webhook_delivery_failure_total',
        type: 'counter',
        value: stats.failure,
        labels: { webhook_id: webhookId },
        timestamp: new Date()
      });

      // Success rate per webhook
      const successRate = stats.total > 0 ? (stats.success / stats.total) * 100 : 0;
      this.metrics.set(this.getMetricKey('webhook_success_rate_percent', { webhook_id: webhookId }), {
        name: 'webhook_success_rate_percent',
        type: 'gauge',
        value: Math.round(successRate * 100) / 100, // Round to 2 decimal places
        labels: { webhook_id: webhookId },
        timestamp: new Date()
      });

      // Average response time per webhook
      if (stats.responseTimes.length > 0) {
        const avgResponseTime = stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length;
        this.metrics.set(this.getMetricKey('webhook_response_time_ms', { webhook_id: webhookId }), {
          name: 'webhook_response_time_ms',
          type: 'histogram',
          value: Math.round(avgResponseTime * 100) / 100,
          labels: { webhook_id: webhookId },
          timestamp: new Date(),
          histogramData: {
            count: stats.responseTimes.length,
            sum: stats.responseTimes.reduce((a, b) => a + b, 0),
            values: stats.responseTimes.slice(-1000) // Keep last 1000 values
          }
        });
      }
    }

    // Generate subscription-specific metrics
    for (const [subscriptionId, stats] of subscriptionStats.entries()) {
      this.metrics.set(this.getMetricKey('subscription_deliveries_total', { subscription_id: subscriptionId }), {
        name: 'subscription_deliveries_total',
        type: 'counter',
        value: stats.total,
        labels: { subscription_id: subscriptionId },
        timestamp: new Date()
      });

      this.metrics.set(this.getMetricKey('subscription_success_total', { subscription_id: subscriptionId }), {
        name: 'subscription_success_total',
        type: 'counter',
        value: stats.success,
        labels: { subscription_id: subscriptionId },
        timestamp: new Date()
      });

      this.metrics.set(this.getMetricKey('subscription_failure_total', { subscription_id: subscriptionId }), {
        name: 'subscription_failure_total',
        type: 'counter',
        value: stats.failure,
        labels: { subscription_id: subscriptionId },
        timestamp: new Date()
      });
    }

    // Generate hourly metrics
    for (const [hour, stats] of hourlyStats.entries()) {
      this.metrics.set(this.getMetricKey('hourly_deliveries_total', { hour }), {
        name: 'hourly_deliveries_total',
        type: 'gauge',
        value: stats.total,
        labels: { hour },
        timestamp: new Date()
      });

      this.metrics.set(this.getMetricKey('hourly_success_total', { hour }), {
        name: 'hourly_success_total',
        type: 'gauge',
        value: stats.success,
        labels: { hour },
        timestamp: new Date()
      });

      this.metrics.set(this.getMetricKey('hourly_failure_total', { hour }), {
        name: 'hourly_failure_total',
        type: 'gauge',
        value: stats.failure,
        labels: { hour },
        timestamp: new Date()
      });
    }

    // Overall response time statistics
    if (responseTimes.length > 0) {
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const sortedTimes = responseTimes.sort((a, b) => a - b);
      const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
      const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

      this.metrics.set(this.getMetricKey('overall_response_time_avg_ms', {}), {
        name: 'overall_response_time_avg_ms',
        type: 'gauge',
        value: Math.round(avgResponseTime * 100) / 100,
        labels: {},
        timestamp: new Date()
      });

      this.metrics.set(this.getMetricKey('overall_response_time_p50_ms', {}), {
        name: 'overall_response_time_p50_ms',
        type: 'gauge',
        value: p50 || 0,
        labels: {},
        timestamp: new Date()
      });

      this.metrics.set(this.getMetricKey('overall_response_time_p95_ms', {}), {
        name: 'overall_response_time_p95_ms',
        type: 'gauge',
        value: p95 || 0,
        labels: {},
        timestamp: new Date()
      });

      this.metrics.set(this.getMetricKey('overall_response_time_p99_ms', {}), {
        name: 'overall_response_time_p99_ms',
        type: 'gauge',
        value: p99 || 0,
        labels: {},
        timestamp: new Date()
      });
    }

    this.logger.debug('Processed deliveries into metrics', {
      totalDeliveries: deliveries.length,
      uniqueWebhooks: webhookStats.size,
      uniqueSubscriptions: subscriptionStats.size,
      generatedMetrics: this.metrics.size
    });
  }

  // Reload metrics from database (useful for testing)
  async reloadFromDatabase(hours: number = 24, fromDeliveries: boolean = false): Promise<void> {
    this.metrics.clear();
    if (fromDeliveries) {
      await this.loadMetricsFromDeliveries(hours);
    } else {
      await this.loadHistoricalMetrics(hours);
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

  private getMetricHelp(metricName: string): string {
    const helpTexts: Record<string, string> = {
      'operation_started_total': 'Total number of operations started',
      'operation_completed_total': 'Total number of operations completed',
      'operation_success_total': 'Total number of successful operations',
      'operation_failure_total': 'Total number of failed operations',
      'operation_duration_ms': 'Duration of operations in milliseconds',
      'events_processed_total': 'Total number of events processed',
      'event_processing_duration_ms': 'Event processing duration in milliseconds',
      'webhook_deliveries_total': 'Total number of webhook deliveries attempted',
      'webhook_delivery_success_total': 'Total number of successful webhook deliveries',
      'webhook_delivery_failure_total': 'Total number of failed webhook deliveries',
      'webhook_response_time_ms': 'Webhook response time in milliseconds',
      'queue_size': 'Current queue size',
      'queue_processing_count': 'Number of items currently being processed',
      'db_connections_total': 'Total database connections',
      'db_connections_idle': 'Idle database connections',
      'db_connections_waiting': 'Database connections waiting',
      'memory_heap_used_bytes': 'Memory heap used in bytes',
      'memory_heap_total_bytes': 'Memory heap total in bytes',
      'memory_external_bytes': 'External memory in bytes',
      'memory_rss_bytes': 'Resident set size in bytes',
      'cpu_user_microseconds': 'CPU user time in microseconds',
      'process_uptime_seconds': 'Process uptime in seconds'
    };

    return helpTexts[metricName] || `Metric ${metricName}`;
  }

  private getPrometheusType(metricType: 'counter' | 'gauge' | 'histogram'): string {
    switch (metricType) {
      case 'counter':
        return 'counter';
      case 'gauge':
        return 'gauge';
      case 'histogram':
        return 'histogram';
      default:
        return 'gauge';
    }
  }

  private formatPrometheusLabels(labels: Record<string, string>): string {
    const labelPairs = Object.entries(labels)
      .map(([key, value]) => `${key}="${value.replace(/"/g, '\\"')}"`)
      .sort();
    return labelPairs.join(',');
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
  loadHistoricalData?: boolean;
  historicalDataHours?: number;
  loadFromDeliveries?: boolean;
}