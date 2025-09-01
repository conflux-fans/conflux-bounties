import { IMetricsCollector } from './interfaces';
import { Logger } from './Logger';

export class PerformanceMonitor {
  private logger: Logger;
  private metricsCollector: IMetricsCollector;
  private activeTimers: Map<string, number> = new Map();

  constructor(metricsCollector: IMetricsCollector) {
    this.logger = new Logger().child({ component: 'PerformanceMonitor' });
    this.metricsCollector = metricsCollector;
  }

  // Start timing an operation
  startTimer(operationId: string, operation: string, labels: Record<string, string> = {}): void {
    const startTime = Date.now();
    this.activeTimers.set(operationId, startTime);
    
    this.logger.debug('Timer started', { operationId, operation, labels });
    
    // Increment operation start counter
    this.metricsCollector.incrementCounter('operation_started_total', {
      operation,
      ...labels
    });
  }

  // End timing an operation and record metrics
  endTimer(operationId: string, operation: string, labels: Record<string, string> = {}): number {
    const startTime = this.activeTimers.get(operationId);
    if (!startTime) {
      this.logger.warn('Timer not found for operation', { operationId, operation });
      return 0;
    }

    const duration = Date.now() - startTime;
    this.activeTimers.delete(operationId);

    // Record duration histogram
    this.metricsCollector.recordHistogram('operation_duration_ms', duration, {
      operation,
      ...labels
    });

    // Increment completion counter
    this.metricsCollector.incrementCounter('operation_completed_total', {
      operation,
      ...labels
    });

    this.logger.debug('Timer ended', { operationId, operation, duration, labels });
    
    return duration;
  }

  // Record operation success
  recordSuccess(operation: string, labels: Record<string, string> = {}): void {
    this.metricsCollector.incrementCounter('operation_success_total', {
      operation,
      ...labels
    });
    
    this.logger.debug('Operation success recorded', { operation, labels });
  }

  // Record operation failure
  recordFailure(operation: string, error: Error, labels: Record<string, string> = {}): void {
    this.metricsCollector.incrementCounter('operation_failure_total', {
      operation,
      error_type: error.constructor.name,
      ...labels
    });
    
    this.logger.debug('Operation failure recorded', { 
      operation, 
      error: error.message, 
      labels 
    });
  }

  // Record event processing metrics
  recordEventProcessed(eventType: string, processingTimeMs: number, success: boolean): void {
    const labels = { event_type: eventType, status: success ? 'success' : 'failure' };
    
    this.metricsCollector.incrementCounter('events_processed_total', labels);
    this.metricsCollector.recordHistogram('event_processing_duration_ms', processingTimeMs, labels);
    
    this.logger.debug('Event processing recorded', {
      eventType,
      processingTimeMs,
      success
    });
  }

  // Record webhook delivery metrics
  recordWebhookDelivery(
    webhookId: string,
    url: string,
    statusCode: number,
    responseTimeMs: number,
    attempt: number
  ): void {
    const success = statusCode >= 200 && statusCode < 300;
    const labels = {
      webhook_id: webhookId,
      status_code: statusCode.toString(),
      status: success ? 'success' : 'failure',
      attempt: attempt.toString()
    };

    this.metricsCollector.incrementCounter('webhook_deliveries_total', labels);
    this.metricsCollector.recordHistogram('webhook_response_time_ms', responseTimeMs, labels);
    
    if (success) {
      this.metricsCollector.incrementCounter('webhook_delivery_success_total', {
        webhook_id: webhookId
      });
    } else {
      this.metricsCollector.incrementCounter('webhook_delivery_failure_total', {
        webhook_id: webhookId,
        status_code: statusCode.toString()
      });
    }

    this.logger.debug('Webhook delivery recorded', {
      webhookId,
      url,
      statusCode,
      responseTimeMs,
      attempt,
      success
    });
  }

  // Record queue metrics
  recordQueueMetrics(queueName: string, size: number, processingCount: number): void {
    this.metricsCollector.recordGauge('queue_size', size, { queue: queueName });
    this.metricsCollector.recordGauge('queue_processing_count', processingCount, { queue: queueName });
    
    this.logger.debug('Queue metrics recorded', {
      queueName,
      size,
      processingCount
    });
  }

  // Record database connection pool metrics
  recordDatabaseMetrics(
    totalConnections: number,
    idleConnections: number,
    waitingCount: number
  ): void {
    this.metricsCollector.recordGauge('db_connections_total', totalConnections);
    this.metricsCollector.recordGauge('db_connections_idle', idleConnections);
    this.metricsCollector.recordGauge('db_connections_waiting', waitingCount);
    
    this.logger.debug('Database metrics recorded', {
      totalConnections,
      idleConnections,
      waitingCount
    });
  }

  // Record system resource metrics
  recordSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Memory metrics
    this.metricsCollector.recordGauge('memory_heap_used_bytes', memUsage.heapUsed);
    this.metricsCollector.recordGauge('memory_heap_total_bytes', memUsage.heapTotal);
    this.metricsCollector.recordGauge('memory_external_bytes', memUsage.external);
    this.metricsCollector.recordGauge('memory_rss_bytes', memUsage.rss);
    
    // CPU metrics (in microseconds)
    this.metricsCollector.recordGauge('cpu_user_microseconds', cpuUsage.user);
    this.metricsCollector.recordGauge('cpu_system_microseconds', cpuUsage.system);
    
    // Process uptime
    this.metricsCollector.recordGauge('process_uptime_seconds', process.uptime());
    
    this.logger.debug('System metrics recorded', {
      memoryUsageMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      uptimeSeconds: Math.round(process.uptime())
    });
  }

  // Utility method to time async operations
  async timeOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    labels: Record<string, string> = {}
  ): Promise<T> {
    const operationId = `${operation}_${Date.now()}_${Math.random()}`;
    
    this.startTimer(operationId, operation, labels);
    
    try {
      const result = await fn();
      this.endTimer(operationId, operation, labels);
      this.recordSuccess(operation, labels);
      return result;
    } catch (error) {
      this.endTimer(operationId, operation, labels);
      this.recordFailure(operation, error as Error, labels);
      throw error;
    }
  }

  // Utility method to time sync operations
  timeOperationSync<T>(
    operation: string,
    fn: () => T,
    labels: Record<string, string> = {}
  ): T {
    const operationId = `${operation}_${Date.now()}_${Math.random()}`;
    
    this.startTimer(operationId, operation, labels);
    
    try {
      const result = fn();
      this.endTimer(operationId, operation, labels);
      this.recordSuccess(operation, labels);
      return result;
    } catch (error) {
      this.endTimer(operationId, operation, labels);
      this.recordFailure(operation, error as Error, labels);
      throw error;
    }
  }

  // Get active timer count
  getActiveTimerCount(): number {
    return this.activeTimers.size;
  }

  // Clear all active timers (useful for cleanup)
  clearActiveTimers(): void {
    const count = this.activeTimers.size;
    this.activeTimers.clear();
    
    if (count > 0) {
      this.logger.warn('Cleared active timers', { count });
    }
  }
}