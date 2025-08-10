import { Pool } from 'pg';
import { MetricsCollector } from '../MetricsCollector';

// Mock Logger to avoid actual logging during tests
jest.mock('../Logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    child: jest.fn().mockReturnThis(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

describe('MetricsCollector Database Integration', () => {
  let mockPool: jest.Mocked<Pool>;
  let mockClient: any;
  let metricsCollector: MetricsCollector;

  beforeEach(() => {
    // Mock database client
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    // Mock database pool
    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
    } as any;

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (metricsCollector) {
      await metricsCollector.stop();
    }
  });

  describe('loadHistoricalMetrics', () => {
    it('should load historical metrics from database successfully', async () => {
      // Arrange
      const mockRows = [
        {
          metric_name: 'operation_started_total',
          metric_value: '100',
          labels: { service: 'webhook', operation: 'send' },
          timestamp: new Date('2024-01-01T10:00:00Z')
        },
        {
          metric_name: 'operation_duration_ms',
          metric_value: '250.5',
          labels: { service: 'webhook' },
          timestamp: new Date('2024-01-01T10:01:00Z')
        },
        {
          metric_name: 'queue_size',
          metric_value: '5',
          labels: {},
          timestamp: new Date('2024-01-01T10:02:00Z')
        }
      ];

      mockClient.query.mockResolvedValue({ rows: mockRows });

      metricsCollector = new MetricsCollector({
        dbPool: mockPool,
        enablePersistence: true,
        loadHistoricalData: false // We'll call manually for testing
      });

      // Act
      await metricsCollector.loadHistoricalMetrics(24);

      // Assert
      expect(mockPool.connect).toHaveBeenCalledTimes(1);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT metric_name, metric_value, labels, timestamp'),
        expect.arrayContaining([expect.any(Date)])
      );
      expect(mockClient.release).toHaveBeenCalledTimes(1);

      // Verify metrics were loaded
      const metrics = metricsCollector.getMetrics();
      expect(Object.keys(metrics)).toHaveLength(3);

      // Check specific metrics
      const counterKey = 'operation_started_total{operation=send,service=webhook}';
      const histogramKey = 'operation_duration_ms{service=webhook}';
      const gaugeKey = 'queue_size';

      expect(metrics[counterKey]).toEqual({
        name: 'operation_started_total',
        type: 'counter',
        value: 100,
        labels: { service: 'webhook', operation: 'send' },
        timestamp: new Date('2024-01-01T10:00:00Z')
      });

      expect(metrics[histogramKey]).toEqual({
        name: 'operation_duration_ms',
        type: 'histogram',
        value: 250.5,
        labels: { service: 'webhook' },
        timestamp: new Date('2024-01-01T10:01:00Z')
      });

      expect(metrics[gaugeKey]).toEqual({
        name: 'queue_size',
        type: 'gauge',
        value: 5,
        labels: {},
        timestamp: new Date('2024-01-01T10:02:00Z')
      });
    });

    it('should handle empty database results', async () => {
      // Arrange
      mockClient.query.mockResolvedValue({ rows: [] });

      metricsCollector = new MetricsCollector({
        dbPool: mockPool,
        enablePersistence: true,
        loadHistoricalData: false
      });

      // Act
      await metricsCollector.loadHistoricalMetrics(24);

      // Assert
      const metrics = metricsCollector.getMetrics();
      expect(Object.keys(metrics)).toHaveLength(0);
    });

    it('should not overwrite existing metrics when loading historical data', async () => {
      // Arrange
      const mockRows = [
        {
          metric_name: 'test_counter',
          metric_value: '50',
          labels: { service: 'test' },
          timestamp: new Date('2024-01-01T10:00:00Z')
        }
      ];

      mockClient.query.mockResolvedValue({ rows: mockRows });

      metricsCollector = new MetricsCollector({
        dbPool: mockPool,
        enablePersistence: true,
        loadHistoricalData: false
      });

      // Add a current metric first
      metricsCollector.incrementCounter('test_counter', { service: 'test' });
      const currentMetrics = metricsCollector.getMetrics();
      const currentValue = Object.values(currentMetrics)[0]?.value;

      // Act
      await metricsCollector.loadHistoricalMetrics(24);

      // Assert
      const metricsAfterLoad = metricsCollector.getMetrics();
      expect(Object.keys(metricsAfterLoad)).toHaveLength(1);
      
      // Should keep the current value, not overwrite with historical
      const finalValue = Object.values(metricsAfterLoad)[0]?.value;
      expect(finalValue).toBe(currentValue);
      expect(finalValue).not.toBe(50);
    });

    it('should handle database connection errors gracefully', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      (mockPool.connect as jest.Mock).mockRejectedValue(dbError);

      metricsCollector = new MetricsCollector({
        dbPool: mockPool,
        enablePersistence: true,
        loadHistoricalData: false
      });

      // Act & Assert
      await expect(metricsCollector.loadHistoricalMetrics(24))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle database query errors gracefully', async () => {
      // Arrange
      const queryError = new Error('Query execution failed');
      mockClient.query.mockRejectedValue(queryError);

      metricsCollector = new MetricsCollector({
        dbPool: mockPool,
        enablePersistence: true,
        loadHistoricalData: false
      });

      // Act & Assert
      await expect(metricsCollector.loadHistoricalMetrics(24))
        .rejects.toThrow('Query execution failed');
      
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('should warn when no database pool is configured', async () => {
      // Arrange
      metricsCollector = new MetricsCollector({
        enablePersistence: false
      });

      // Act
      await metricsCollector.loadHistoricalMetrics(24);

      // Assert
      expect(mockPool.connect).not.toHaveBeenCalled();
    });
  });

  describe('reloadFromDatabase', () => {
    it('should clear existing metrics and reload from database', async () => {
      // Arrange
      const mockRows = [
        {
          metric_name: 'reloaded_metric',
          metric_value: '123',
          labels: { type: 'test' },
          timestamp: new Date()
        }
      ];

      mockClient.query.mockResolvedValue({ rows: mockRows });

      metricsCollector = new MetricsCollector({
        dbPool: mockPool,
        enablePersistence: true,
        loadHistoricalData: false
      });

      // Add some existing metrics
      metricsCollector.incrementCounter('existing_counter');
      metricsCollector.recordGauge('existing_gauge', 42);

      expect(Object.keys(metricsCollector.getMetrics())).toHaveLength(2);

      // Act
      await metricsCollector.reloadFromDatabase(24);

      // Assert
      const metrics = metricsCollector.getMetrics();
      expect(Object.keys(metrics)).toHaveLength(1);
      
      const reloadedMetric = Object.values(metrics)[0];
      expect(reloadedMetric?.name).toBe('reloaded_metric');
      expect(reloadedMetric?.value).toBe(123);
    });
  });

  describe('constructor with loadHistoricalData option', () => {
    it('should automatically load historical data when option is enabled', async () => {
      // Arrange
      const mockRows = [
        {
          metric_name: 'auto_loaded_metric',
          metric_value: '999',
          labels: {},
          timestamp: new Date()
        }
      ];

      mockClient.query.mockResolvedValue({ rows: mockRows });

      // Act
      metricsCollector = new MetricsCollector({
        dbPool: mockPool,
        enablePersistence: true,
        loadHistoricalData: true,
        historicalDataHours: 12
      });

      // Wait a bit for async loading to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT metric_name, metric_value, labels, timestamp'),
        expect.arrayContaining([expect.any(Date)])
      );
    });

    it('should handle errors during automatic loading gracefully', async () => {
      // Arrange
      (mockPool.connect as jest.Mock).mockRejectedValue(new Error('Auto-load failed'));

      // Act - should not throw
      metricsCollector = new MetricsCollector({
        dbPool: mockPool,
        enablePersistence: true,
        loadHistoricalData: true
      });

      // Wait a bit for async loading to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - constructor should complete successfully even if loading fails
      expect(metricsCollector).toBeDefined();
    });
  });

  describe('loadMetricsFromDeliveries', () => {
    it('should load and process delivery data into metrics', async () => {
      // Arrange
      const mockDeliveries = [
        {
          id: 'delivery-1',
          webhook_id: 'webhook-1',
          subscription_id: 'sub-1',
          status: 'completed',
          response_time: 150,
          created_at: new Date('2024-01-01T10:00:00Z'),
          completed_at: new Date('2024-01-01T10:00:01Z')
        },
        {
          id: 'delivery-2',
          webhook_id: 'webhook-1',
          subscription_id: 'sub-1',
          status: 'failed',
          response_time: 5000,
          created_at: new Date('2024-01-01T10:01:00Z'),
          error_message: 'Timeout'
        },
        {
          id: 'delivery-3',
          webhook_id: 'webhook-2',
          subscription_id: 'sub-2',
          status: 'completed',
          response_time: 200,
          created_at: new Date('2024-01-01T10:02:00Z'),
          completed_at: new Date('2024-01-01T10:02:01Z')
        }
      ];

      mockClient.query.mockResolvedValue({ rows: mockDeliveries });

      metricsCollector = new MetricsCollector({
        dbPool: mockPool,
        enablePersistence: true,
        loadHistoricalData: false
      });

      // Act
      await metricsCollector.loadMetricsFromDeliveries(24);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, webhook_id, status, payload'),
        expect.arrayContaining([expect.any(Date)])
      );

      const metrics = metricsCollector.getMetrics();
      
      // Should have various metrics generated from deliveries
      expect(Object.keys(metrics).length).toBeGreaterThan(0);

      // Check for specific metrics
      expect(metrics['webhook_deliveries_total{webhook_id=webhook-1}']).toMatchObject({
        name: 'webhook_deliveries_total',
        type: 'counter',
        value: 2,
        labels: { webhook_id: 'webhook-1' }
      });

      expect(metrics['webhook_delivery_success_total{webhook_id=webhook-1}']).toMatchObject({
        name: 'webhook_delivery_success_total',
        type: 'counter',
        value: 1,
        labels: { webhook_id: 'webhook-1' }
      });

      expect(metrics['webhook_delivery_failure_total{webhook_id=webhook-1}']).toMatchObject({
        name: 'webhook_delivery_failure_total',
        type: 'counter',
        value: 1,
        labels: { webhook_id: 'webhook-1' }
      });

      // Check success rate
      expect(metrics['webhook_success_rate_percent{webhook_id=webhook-1}']).toMatchObject({
        name: 'webhook_success_rate_percent',
        type: 'gauge',
        value: 50, // 1 success out of 2 total = 50%
        labels: { webhook_id: 'webhook-1' }
      });
    });

    it('should generate response time metrics from deliveries', async () => {
      // Arrange
      const mockDeliveries = [
        {
          id: 'delivery-1',
          webhook_id: 'webhook-1',
          status: 'completed',
          response_time: 100,
          created_at: new Date()
        },
        {
          id: 'delivery-2',
          webhook_id: 'webhook-1',
          status: 'completed',
          response_time: 200,
          created_at: new Date()
        },
        {
          id: 'delivery-3',
          webhook_id: 'webhook-1',
          status: 'completed',
          response_time: 300,
          created_at: new Date()
        }
      ];

      mockClient.query.mockResolvedValue({ rows: mockDeliveries });

      metricsCollector = new MetricsCollector({
        dbPool: mockPool,
        enablePersistence: true,
        loadHistoricalData: false
      });

      // Act
      await metricsCollector.loadMetricsFromDeliveries(24);

      // Assert
      const metrics = metricsCollector.getMetrics();
      
      // Check webhook response time metric
      const responseTimeMetric = metrics['webhook_response_time_ms{webhook_id=webhook-1}'];
      expect(responseTimeMetric).toMatchObject({
        name: 'webhook_response_time_ms',
        type: 'histogram',
        value: 200, // Average of 100, 200, 300
        labels: { webhook_id: 'webhook-1' }
      });

      expect(responseTimeMetric?.histogramData).toMatchObject({
        count: 3,
        sum: 600,
        values: [100, 200, 300]
      });

      // Check overall response time metrics
      expect(metrics['overall_response_time_avg_ms']).toMatchObject({
        name: 'overall_response_time_avg_ms',
        type: 'gauge',
        value: 200
      });

      expect(metrics['overall_response_time_p95_ms']).toMatchObject({
        name: 'overall_response_time_p95_ms',
        type: 'gauge',
        value: 300
      });
    });

    it('should generate hourly statistics from deliveries', async () => {
      // Arrange
      const mockDeliveries = [
        {
          id: 'delivery-1',
          webhook_id: 'webhook-1',
          status: 'completed',
          created_at: new Date('2024-01-01T10:00:00Z')
        },
        {
          id: 'delivery-2',
          webhook_id: 'webhook-1',
          status: 'failed',
          created_at: new Date('2024-01-01T10:30:00Z')
        },
        {
          id: 'delivery-3',
          webhook_id: 'webhook-1',
          status: 'completed',
          created_at: new Date('2024-01-01T11:00:00Z')
        }
      ];

      mockClient.query.mockResolvedValue({ rows: mockDeliveries });

      metricsCollector = new MetricsCollector({
        dbPool: mockPool,
        enablePersistence: true,
        loadHistoricalData: false
      });

      // Act
      await metricsCollector.loadMetricsFromDeliveries(24);

      // Assert
      const metrics = metricsCollector.getMetrics();
      
      // Check hourly metrics for 10:00 hour
      expect(metrics['hourly_deliveries_total{hour=2024-01-01T10}']).toMatchObject({
        name: 'hourly_deliveries_total',
        type: 'gauge',
        value: 2,
        labels: { hour: '2024-01-01T10' }
      });

      expect(metrics['hourly_success_total{hour=2024-01-01T10}']).toMatchObject({
        name: 'hourly_success_total',
        type: 'gauge',
        value: 1,
        labels: { hour: '2024-01-01T10' }
      });

      expect(metrics['hourly_failure_total{hour=2024-01-01T10}']).toMatchObject({
        name: 'hourly_failure_total',
        type: 'gauge',
        value: 1,
        labels: { hour: '2024-01-01T10' }
      });

      // Check hourly metrics for 11:00 hour
      expect(metrics['hourly_deliveries_total{hour=2024-01-01T11}']).toMatchObject({
        name: 'hourly_deliveries_total',
        type: 'gauge',
        value: 1,
        labels: { hour: '2024-01-01T11' }
      });
    });

    it('should handle empty deliveries result', async () => {
      // Arrange
      mockClient.query.mockResolvedValue({ rows: [] });

      metricsCollector = new MetricsCollector({
        dbPool: mockPool,
        enablePersistence: true,
        loadHistoricalData: false
      });

      // Act
      await metricsCollector.loadMetricsFromDeliveries(24);

      // Assert
      const metrics = metricsCollector.getMetrics();
      expect(Object.keys(metrics)).toHaveLength(0);
    });

    it('should work with auto-loading from deliveries', async () => {
      // Arrange
      const mockDeliveries = [
        {
          id: 'delivery-auto',
          webhook_id: 'webhook-auto',
          status: 'completed',
          created_at: new Date()
        }
      ];

      mockClient.query.mockResolvedValue({ rows: mockDeliveries });

      // Act
      metricsCollector = new MetricsCollector({
        dbPool: mockPool,
        enablePersistence: true,
        loadHistoricalData: true,
        loadFromDeliveries: true,
        historicalDataHours: 12
      });

      // Wait for async loading
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, webhook_id, status, payload'),
        expect.arrayContaining([expect.any(Date)])
      );
    });
  });

  describe('reloadFromDatabase with deliveries', () => {
    it('should reload from deliveries when specified', async () => {
      // Arrange
      const mockDeliveries = [
        {
          id: 'delivery-reload',
          webhook_id: 'webhook-reload',
          status: 'completed',
          created_at: new Date()
        }
      ];

      mockClient.query.mockResolvedValue({ rows: mockDeliveries });

      metricsCollector = new MetricsCollector({
        dbPool: mockPool,
        enablePersistence: true,
        loadHistoricalData: false
      });

      // Add some existing metrics
      metricsCollector.incrementCounter('existing_counter');

      // Act
      await metricsCollector.reloadFromDatabase(24, true); // true = from deliveries

      // Assert
      const metrics = metricsCollector.getMetrics();
      
      // Should not have the existing counter anymore
      expect(metrics['existing_counter']).toBeUndefined();
      
      // Should have metrics from deliveries
      expect(metrics['webhook_deliveries_total{webhook_id=webhook-reload}']).toBeDefined();
    });
  });
});