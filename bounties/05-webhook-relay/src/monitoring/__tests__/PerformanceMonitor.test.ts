import { PerformanceMonitor } from '../PerformanceMonitor';
import { IMetricsCollector } from '../interfaces';

// Mock dependencies
jest.mock('../Logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis()
  }))
}));

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;
  let mockMetricsCollector: jest.Mocked<IMetricsCollector>;

  beforeEach(() => {
    mockMetricsCollector = {
      incrementCounter: jest.fn(),
      recordGauge: jest.fn(),
      recordHistogram: jest.fn()
    };

    performanceMonitor = new PerformanceMonitor(mockMetricsCollector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('timer operations', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start and end timer correctly', () => {
      const operationId = 'test-op-1';
      const operation = 'test_operation';
      const labels = { component: 'test' };

      performanceMonitor.startTimer(operationId, operation, labels);

      expect(mockMetricsCollector.incrementCounter).toHaveBeenCalledWith(
        'operation_started_total',
        { operation, ...labels }
      );

      // Advance time by 100ms
      jest.advanceTimersByTime(100);

      const duration = performanceMonitor.endTimer(operationId, operation, labels);

      expect(duration).toBe(100);
      expect(mockMetricsCollector.recordHistogram).toHaveBeenCalledWith(
        'operation_duration_ms',
        100,
        { operation, ...labels }
      );
      expect(mockMetricsCollector.incrementCounter).toHaveBeenCalledWith(
        'operation_completed_total',
        { operation, ...labels }
      );
    });

    it('should handle ending timer for non-existent operation', () => {
      const duration = performanceMonitor.endTimer('non-existent', 'test_op');

      expect(duration).toBe(0);
      expect(mockMetricsCollector.recordHistogram).not.toHaveBeenCalled();
    });

    it('should track active timer count', () => {
      expect(performanceMonitor.getActiveTimerCount()).toBe(0);

      performanceMonitor.startTimer('op1', 'test');
      performanceMonitor.startTimer('op2', 'test');

      expect(performanceMonitor.getActiveTimerCount()).toBe(2);

      performanceMonitor.endTimer('op1', 'test');

      expect(performanceMonitor.getActiveTimerCount()).toBe(1);
    });

    it('should clear all active timers', () => {
      performanceMonitor.startTimer('op1', 'test');
      performanceMonitor.startTimer('op2', 'test');

      expect(performanceMonitor.getActiveTimerCount()).toBe(2);

      performanceMonitor.clearActiveTimers();

      expect(performanceMonitor.getActiveTimerCount()).toBe(0);
    });
  });

  describe('recordSuccess', () => {
    it('should record operation success', () => {
      const operation = 'webhook_delivery';
      const labels = { webhook_id: '123' };

      performanceMonitor.recordSuccess(operation, labels);

      expect(mockMetricsCollector.incrementCounter).toHaveBeenCalledWith(
        'operation_success_total',
        { operation, ...labels }
      );
    });
  });

  describe('recordFailure', () => {
    it('should record operation failure', () => {
      const operation = 'webhook_delivery';
      const error = new Error('Network timeout');
      const labels = { webhook_id: '123' };

      performanceMonitor.recordFailure(operation, error, labels);

      expect(mockMetricsCollector.incrementCounter).toHaveBeenCalledWith(
        'operation_failure_total',
        {
          operation,
          error_type: 'Error',
          ...labels
        }
      );
    });

    it('should handle custom error types', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const operation = 'test_operation';
      const error = new CustomError('Custom error message');

      performanceMonitor.recordFailure(operation, error);

      expect(mockMetricsCollector.incrementCounter).toHaveBeenCalledWith(
        'operation_failure_total',
        {
          operation,
          error_type: 'CustomError'
        }
      );
    });
  });

  describe('recordEventProcessed', () => {
    it('should record successful event processing', () => {
      const eventType = 'Transfer';
      const processingTime = 150;

      performanceMonitor.recordEventProcessed(eventType, processingTime, true);

      expect(mockMetricsCollector.incrementCounter).toHaveBeenCalledWith(
        'events_processed_total',
        { event_type: eventType, status: 'success' }
      );
      expect(mockMetricsCollector.recordHistogram).toHaveBeenCalledWith(
        'event_processing_duration_ms',
        processingTime,
        { event_type: eventType, status: 'success' }
      );
    });

    it('should record failed event processing', () => {
      const eventType = 'Transfer';
      const processingTime = 75;

      performanceMonitor.recordEventProcessed(eventType, processingTime, false);

      expect(mockMetricsCollector.incrementCounter).toHaveBeenCalledWith(
        'events_processed_total',
        { event_type: eventType, status: 'failure' }
      );
      expect(mockMetricsCollector.recordHistogram).toHaveBeenCalledWith(
        'event_processing_duration_ms',
        processingTime,
        { event_type: eventType, status: 'failure' }
      );
    });
  });

  describe('recordWebhookDelivery', () => {
    it('should record successful webhook delivery', () => {
      const webhookId = 'webhook-123';
      const url = 'https://example.com/webhook';
      const statusCode = 200;
      const responseTime = 250;
      const attempt = 1;

      performanceMonitor.recordWebhookDelivery(
        webhookId,
        url,
        statusCode,
        responseTime,
        attempt
      );

      expect(mockMetricsCollector.incrementCounter).toHaveBeenCalledWith(
        'webhook_deliveries_total',
        {
          webhook_id: webhookId,
          status_code: '200',
          status: 'success',
          attempt: '1'
        }
      );
      expect(mockMetricsCollector.recordHistogram).toHaveBeenCalledWith(
        'webhook_response_time_ms',
        responseTime,
        {
          webhook_id: webhookId,
          status_code: '200',
          status: 'success',
          attempt: '1'
        }
      );
      expect(mockMetricsCollector.incrementCounter).toHaveBeenCalledWith(
        'webhook_delivery_success_total',
        { webhook_id: webhookId }
      );
    });

    it('should record failed webhook delivery', () => {
      const webhookId = 'webhook-123';
      const url = 'https://example.com/webhook';
      const statusCode = 500;
      const responseTime = 100;
      const attempt = 2;

      performanceMonitor.recordWebhookDelivery(
        webhookId,
        url,
        statusCode,
        responseTime,
        attempt
      );

      expect(mockMetricsCollector.incrementCounter).toHaveBeenCalledWith(
        'webhook_deliveries_total',
        {
          webhook_id: webhookId,
          status_code: '500',
          status: 'failure',
          attempt: '2'
        }
      );
      expect(mockMetricsCollector.incrementCounter).toHaveBeenCalledWith(
        'webhook_delivery_failure_total',
        {
          webhook_id: webhookId,
          status_code: '500'
        }
      );
    });
  });

  describe('recordQueueMetrics', () => {
    it('should record queue metrics', () => {
      const queueName = 'webhook_delivery';
      const size = 25;
      const processingCount = 5;

      performanceMonitor.recordQueueMetrics(queueName, size, processingCount);

      expect(mockMetricsCollector.recordGauge).toHaveBeenCalledWith(
        'queue_size',
        size,
        { queue: queueName }
      );
      expect(mockMetricsCollector.recordGauge).toHaveBeenCalledWith(
        'queue_processing_count',
        processingCount,
        { queue: queueName }
      );
    });
  });

  describe('recordDatabaseMetrics', () => {
    it('should record database connection metrics', () => {
      const totalConnections = 10;
      const idleConnections = 7;
      const waitingCount = 2;

      performanceMonitor.recordDatabaseMetrics(
        totalConnections,
        idleConnections,
        waitingCount
      );

      expect(mockMetricsCollector.recordGauge).toHaveBeenCalledWith(
        'db_connections_total',
        totalConnections
      );
      expect(mockMetricsCollector.recordGauge).toHaveBeenCalledWith(
        'db_connections_idle',
        idleConnections
      );
      expect(mockMetricsCollector.recordGauge).toHaveBeenCalledWith(
        'db_connections_waiting',
        waitingCount
      );
    });
  });

  describe('recordSystemMetrics', () => {
    it('should record system resource metrics', () => {
      // Mock process methods
      const originalMemoryUsage = process.memoryUsage;
      const originalCpuUsage = process.cpuUsage;
      const originalUptime = process.uptime;

      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 1024 * 1024,
        heapTotal: 2048 * 1024,
        external: 512 * 1024,
        rss: 4096 * 1024
      });

      process.cpuUsage = jest.fn().mockReturnValue({
        user: 1000000,
        system: 500000
      });

      process.uptime = jest.fn().mockReturnValue(3600);

      performanceMonitor.recordSystemMetrics();

      expect(mockMetricsCollector.recordGauge).toHaveBeenCalledWith(
        'memory_heap_used_bytes',
        1024 * 1024
      );
      expect(mockMetricsCollector.recordGauge).toHaveBeenCalledWith(
        'memory_heap_total_bytes',
        2048 * 1024
      );
      expect(mockMetricsCollector.recordGauge).toHaveBeenCalledWith(
        'cpu_user_microseconds',
        1000000
      );
      expect(mockMetricsCollector.recordGauge).toHaveBeenCalledWith(
        'process_uptime_seconds',
        3600
      );

      // Restore original methods
      process.memoryUsage = originalMemoryUsage;
      process.cpuUsage = originalCpuUsage;
      process.uptime = originalUptime;
    });
  });

  describe('timeOperation', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should time async operation successfully', async () => {
      const operation = 'async_test';
      const labels = { component: 'test' };
      const expectedResult = 'success';

      const asyncFn = jest.fn().mockImplementation(async () => {
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 100));
        return expectedResult;
      });

      const resultPromise = performanceMonitor.timeOperation(operation, asyncFn, labels);

      // Advance timers to complete the async operation
      jest.advanceTimersByTime(100);

      const result = await resultPromise;

      expect(result).toBe(expectedResult);
      expect(mockMetricsCollector.incrementCounter).toHaveBeenCalledWith(
        'operation_started_total',
        { operation, ...labels }
      );
      expect(mockMetricsCollector.incrementCounter).toHaveBeenCalledWith(
        'operation_success_total',
        { operation, ...labels }
      );
    });

    it('should handle async operation failure', async () => {
      const operation = 'async_test';
      const error = new Error('Async operation failed');

      const asyncFn = jest.fn().mockRejectedValue(error);

      await expect(
        performanceMonitor.timeOperation(operation, asyncFn)
      ).rejects.toThrow('Async operation failed');

      expect(mockMetricsCollector.incrementCounter).toHaveBeenCalledWith(
        'operation_failure_total',
        { operation, error_type: 'Error' }
      );
    });
  });

  describe('timeOperationSync', () => {
    it('should time sync operation successfully', () => {
      const operation = 'sync_test';
      const labels = { component: 'test' };
      const expectedResult = 42;

      const syncFn = jest.fn().mockReturnValue(expectedResult);

      const result = performanceMonitor.timeOperationSync(operation, syncFn, labels);

      expect(result).toBe(expectedResult);
      expect(mockMetricsCollector.incrementCounter).toHaveBeenCalledWith(
        'operation_success_total',
        { operation, ...labels }
      );
    });

    it('should handle sync operation failure', () => {
      const operation = 'sync_test';
      const error = new Error('Sync operation failed');

      const syncFn = jest.fn().mockImplementation(() => {
        throw error;
      });

      expect(() => {
        performanceMonitor.timeOperationSync(operation, syncFn);
      }).toThrow('Sync operation failed');

      expect(mockMetricsCollector.incrementCounter).toHaveBeenCalledWith(
        'operation_failure_total',
        { operation, error_type: 'Error' }
      );
    });
  });
});