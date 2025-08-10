import { Pool } from 'pg';
import { MetricsCollector } from '../../src/monitoring/MetricsCollector';

describe('MetricsCollector Database Integration (Real DB)', () => {
  let dbPool: Pool | null = null;
  let metricsCollector: MetricsCollector;
  let isDatabaseAvailable = false;

  beforeAll(async () => {
    // Try multiple database URLs for different environments
    const testDbUrls = [
      process.env['TEST_DATABASE_URL'],
      'postgresql://webhook_user:webhook_pass@localhost:5432/webhook_relay_test',
      'postgresql://postgres:postgres@localhost:5432/webhook_relay_test',
      'postgresql://webhook_user:webhook_pass@postgres:5432/webhook_relay_test'
    ].filter(Boolean);
    
    for (const testDbUrl of testDbUrls) {
      try {
        console.log(`Attempting to connect to database: ${testDbUrl}`);
        dbPool = new Pool({
          connectionString: testDbUrl!,
          max: 5,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        });
        
        // Test connection with timeout
        await Promise.race([
          dbPool.query('SELECT 1'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
        ]);
        
        console.log('Database connection successful');
        isDatabaseAvailable = true;
        
        // Ensure metrics table exists
        const client = await dbPool.connect();
        try {
          await client.query(`
            CREATE TABLE IF NOT EXISTS metrics (
              id VARCHAR(100) PRIMARY KEY,
              metric_name VARCHAR(100) NOT NULL,
              metric_value NUMERIC NOT NULL,
              labels JSONB DEFAULT '{}',
              timestamp TIMESTAMP DEFAULT NOW()
            )
          `);
          
          // Ensure deliveries table exists for delivery metrics tests
          await client.query(`
            CREATE TABLE IF NOT EXISTS deliveries (
              id VARCHAR(100) PRIMARY KEY,
              subscription_id VARCHAR(100),
              webhook_id VARCHAR(100),
              event_data JSONB NOT NULL,
              payload JSONB NOT NULL,
              status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
              attempts INTEGER DEFAULT 0,
              max_attempts INTEGER DEFAULT 3,
              next_retry TIMESTAMP,
              last_attempt TIMESTAMP,
              response_status INTEGER,
              response_time INTEGER,
              error_message TEXT,
              created_at TIMESTAMP DEFAULT NOW(),
              completed_at TIMESTAMP
            )
          `);
          
          // Clean up any existing test data
          await client.query("DELETE FROM metrics WHERE metric_name LIKE 'test_%'");
          await client.query("DELETE FROM deliveries WHERE id LIKE 'test_%'");
        } finally {
          client.release();
        }
        break;
        
      } catch (error) {
        console.warn(`Failed to connect to ${testDbUrl}: ${(error as Error).message}`);
        if (dbPool) {
          try {
            await dbPool.end();
          } catch (closeError) {
            // Ignore close errors
          }
          dbPool = null;
        }
      }
    }
    
    if (!isDatabaseAvailable) {
      console.warn('No database connection available. Database integration tests will be skipped.');
      console.warn('To run database tests, ensure PostgreSQL is running and accessible.');
    }
  });

  afterAll(async () => {
    if (dbPool) {
      await dbPool.end();
    }
  });

  beforeEach(async () => {
    if (!dbPool) return;
    
    // Clean up test data before each test
    const client = await dbPool.connect();
    try {
      await client.query("DELETE FROM metrics WHERE metric_name LIKE 'test_%'");
      await client.query("DELETE FROM deliveries WHERE id LIKE 'test_%'");
    } finally {
      client.release();
    }
  });

  afterEach(async () => {
    // Clean up metrics collector with timeout
    if (metricsCollector) {
      try {
        await Promise.race([
          metricsCollector.stop(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Stop timeout')), 5000))
        ]);
      } catch (error) {
        console.warn('Error stopping metrics collector:', error);
      }
    }

    // Clean up any remaining timers or intervals
    jest.clearAllTimers();
    
    // Clean up global resources
    if ((global as any).cleanupGlobalResources) {
      try {
        await (global as any).cleanupGlobalResources();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Real Database Operations', () => {
    it('should successfully load metrics from real database', async () => {
      if (!dbPool || !isDatabaseAvailable) {
        console.warn('Skipping test: Database not available');
        return;
      }

      // Arrange - Insert test data directly into database
      const client = await dbPool.connect();
      try {
        await client.query(`
          INSERT INTO metrics (id, metric_name, metric_value, labels, timestamp) VALUES
          ('test_1', 'test_counter_total', 42, '{"service": "test", "env": "integration"}', NOW() - INTERVAL '1 hour'),
          ('test_2', 'test_duration_ms', 150.5, '{"operation": "test"}', NOW() - INTERVAL '30 minutes'),
          ('test_3', 'test_gauge', 75, '{}', NOW() - INTERVAL '10 minutes')
        `);
      } finally {
        client.release();
      }

      // Act
      metricsCollector = new MetricsCollector({
        dbPool: dbPool!,
        enablePersistence: true,
        loadHistoricalData: false
      });

      await metricsCollector.loadHistoricalMetrics(2); // Load last 2 hours

      // Assert
      const metrics = metricsCollector.getMetrics();
      expect(Object.keys(metrics)).toHaveLength(3);

      // Verify specific metrics
      const counterKey = 'test_counter_total{env=integration,service=test}';
      const histogramKey = 'test_duration_ms{operation=test}';
      const gaugeKey = 'test_gauge';

      expect(metrics[counterKey]).toMatchObject({
        name: 'test_counter_total',
        type: 'counter',
        value: 42,
        labels: { service: 'test', env: 'integration' }
      });

      expect(metrics[histogramKey]).toMatchObject({
        name: 'test_duration_ms',
        type: 'histogram',
        value: 150.5,
        labels: { operation: 'test' }
      });

      expect(metrics[gaugeKey]).toMatchObject({
        name: 'test_gauge',
        type: 'gauge',
        value: 75,
        labels: {}
      });
    });

    it('should filter metrics by time range correctly', async () => {
      if (!dbPool || !isDatabaseAvailable) {
        console.warn('Skipping test: Database not available');
        return;
      }

      // Arrange - Insert test data with different timestamps
      const client = await dbPool.connect();
      try {
        await client.query(`
          INSERT INTO metrics (id, metric_name, metric_value, labels, timestamp) VALUES
          ('test_old', 'test_old_metric', 1, '{}', NOW() - INTERVAL '25 hours'),
          ('test_recent', 'test_recent_metric', 2, '{}', NOW() - INTERVAL '1 hour')
        `);
      } finally {
        client.release();
      }

      // Act
      metricsCollector = new MetricsCollector({
        dbPool: dbPool!,
        enablePersistence: true,
        loadHistoricalData: false
      });

      await metricsCollector.loadHistoricalMetrics(24); // Load last 24 hours

      // Assert
      const metrics = metricsCollector.getMetrics();
      expect(Object.keys(metrics)).toHaveLength(1);
      expect(metrics['test_recent_metric']).toBeDefined();
      expect(metrics['test_old_metric']).toBeUndefined();
    });

    it('should handle concurrent operations correctly', async () => {
      if (!dbPool || !isDatabaseAvailable) {
        console.warn('Skipping test: Database not available');
        return;
      }

      // Arrange
      metricsCollector = new MetricsCollector({
        dbPool: dbPool!,
        enablePersistence: true,
        loadHistoricalData: false
      });

      // Add some current metrics
      metricsCollector.incrementCounter('test_concurrent_counter', { type: 'current' });
      metricsCollector.recordGauge('test_concurrent_gauge', 100, { type: 'current' });

      // Insert historical data
      const client = await dbPool.connect();
      try {
        await client.query(`
          INSERT INTO metrics (id, metric_name, metric_value, labels, timestamp) VALUES
          ('test_hist_1', 'test_historical_counter', 50, '{"type": "historical"}', NOW() - INTERVAL '1 hour'),
          ('test_hist_2', 'test_historical_gauge', 200, '{"type": "historical"}', NOW() - INTERVAL '30 minutes')
        `);
      } finally {
        client.release();
      }

      // Act - Load historical data while current metrics exist
      await metricsCollector.loadHistoricalMetrics(2);

      // Assert
      const metrics = metricsCollector.getMetrics();
      expect(Object.keys(metrics)).toHaveLength(4);

      // Current metrics should still exist
      expect(metrics['test_concurrent_counter{type=current}']).toBeDefined();
      expect(metrics['test_concurrent_gauge{type=current}']).toBeDefined();

      // Historical metrics should be loaded
      expect(metrics['test_historical_counter{type=historical}']).toBeDefined();
      expect(metrics['test_historical_gauge{type=historical}']).toBeDefined();
    });

    it('should handle database connection issues gracefully', async () => {
      if (!isDatabaseAvailable) {
        console.warn('Skipping test: Database not available');
        return;
      }

      // Arrange - Create collector with invalid database config
      const invalidPool = new Pool({
        connectionString: 'postgresql://invalid:invalid@localhost:9999/invalid',
        connectionTimeoutMillis: 1000
      });

      metricsCollector = new MetricsCollector({
        dbPool: invalidPool,
        enablePersistence: true,
        loadHistoricalData: false
      });

      // Act & Assert
      await expect(metricsCollector.loadHistoricalMetrics(24))
        .rejects.toThrow();

      await invalidPool.end();
    });

    it('should work with automatic loading on startup', async () => {
      if (!dbPool || !isDatabaseAvailable) {
        console.warn('Skipping test: Database not available');
        return;
      }

      // Arrange - Insert test data
      const client = await dbPool.connect();
      try {
        await client.query(`
          INSERT INTO metrics (id, metric_name, metric_value, labels, timestamp) VALUES
          ('test_auto', 'test_auto_loaded', 999, '{"auto": "true"}', NOW() - INTERVAL '1 hour')
        `);
      } finally {
        client.release();
      }

      // Act - Create collector with auto-loading enabled
      metricsCollector = new MetricsCollector({
        dbPool: dbPool!,
        enablePersistence: true,
        loadHistoricalData: true,
        historicalDataHours: 2
      });

      // Wait for async loading to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Assert
      const metrics = metricsCollector.getMetrics();
      expect(metrics['test_auto_loaded{auto=true}']).toMatchObject({
        name: 'test_auto_loaded',
        value: 999,
        labels: { auto: 'true' }
      });
    });

    it('should generate correct Prometheus metrics from loaded data', async () => {
      if (!dbPool || !isDatabaseAvailable) {
        console.warn('Skipping test: Database not available');
        return;
      }

      // Arrange - Insert test data
      const client = await dbPool.connect();
      try {
        await client.query(`
          INSERT INTO metrics (id, metric_name, metric_value, labels, timestamp) VALUES
          ('test_prom_1', 'test_requests_total', 1000, '{"method": "GET", "status": "200"}', NOW() - INTERVAL '1 hour'),
          ('test_prom_2', 'test_requests_total', 50, '{"method": "POST", "status": "400"}', NOW() - INTERVAL '30 minutes'),
          ('test_prom_3', 'test_response_time_ms', 250, '{"endpoint": "/api/test"}', NOW() - INTERVAL '15 minutes')
        `);
      } finally {
        client.release();
      }

      // Act
      metricsCollector = new MetricsCollector({
        dbPool: dbPool!,
        enablePersistence: true,
        loadHistoricalData: false
      });

      await metricsCollector.loadHistoricalMetrics(2);
      const prometheusOutput = metricsCollector.getPrometheusMetrics();

      // Assert
      expect(prometheusOutput).toContain('# HELP test_requests_total');
      expect(prometheusOutput).toContain('# TYPE test_requests_total counter');
      expect(prometheusOutput).toContain('test_requests_total{method="GET",status="200"} 1000');
      expect(prometheusOutput).toContain('test_requests_total{method="POST",status="400"} 50');
      
      expect(prometheusOutput).toContain('# HELP test_response_time_ms');
      expect(prometheusOutput).toContain('# TYPE test_response_time_ms histogram');
      expect(prometheusOutput).toContain('test_response_time_ms{endpoint="/api/test"} 250');
    });

    it('should load metrics from deliveries table', async () => {
      if (!dbPool || !isDatabaseAvailable) {
        console.warn('Skipping test: Database not available');
        return;
      }

      // Arrange - Insert test delivery data
      const client = await dbPool.connect();
      try {
        // First ensure we have the deliveries table
        await client.query(`
          CREATE TABLE IF NOT EXISTS deliveries (
            id VARCHAR(100) PRIMARY KEY,
            subscription_id VARCHAR(100),
            webhook_id VARCHAR(100),
            event_data JSONB NOT NULL,
            payload JSONB NOT NULL,
            status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
            attempts INTEGER DEFAULT 0,
            max_attempts INTEGER DEFAULT 3,
            next_retry TIMESTAMP,
            last_attempt TIMESTAMP,
            response_status INTEGER,
            response_time INTEGER,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            completed_at TIMESTAMP
          )
        `);

        // Clean up any existing test data
        await client.query("DELETE FROM deliveries WHERE id LIKE 'test_%'");

        // Insert test delivery data
        await client.query(`
          INSERT INTO deliveries (id, webhook_id, subscription_id, status, response_time, event_data, payload, created_at) VALUES
          ('test_delivery_1', 'webhook-1', 'sub-1', 'completed', 150, '{}', '{}', NOW() - INTERVAL '1 hour'),
          ('test_delivery_2', 'webhook-1', 'sub-1', 'failed', 5000, '{}', '{}', NOW() - INTERVAL '45 minutes'),
          ('test_delivery_3', 'webhook-2', 'sub-2', 'completed', 200, '{}', '{}', NOW() - INTERVAL '30 minutes'),
          ('test_delivery_4', 'webhook-1', 'sub-1', 'completed', 100, '{}', '{}', NOW() - INTERVAL '15 minutes')
        `);
      } finally {
        client.release();
      }

      // Act
      metricsCollector = new MetricsCollector({
        dbPool: dbPool!,
        enablePersistence: true,
        loadHistoricalData: false
      });

      await metricsCollector.loadMetricsFromDeliveries(2); // Load last 2 hours

      // Assert
      const metrics = metricsCollector.getMetrics();
      expect(Object.keys(metrics).length).toBeGreaterThan(0);

      // Check webhook-specific metrics
      expect(metrics['webhook_deliveries_total{webhook_id=webhook-1}']).toMatchObject({
        name: 'webhook_deliveries_total',
        type: 'counter',
        value: 3, // 3 deliveries for webhook-1
        labels: { webhook_id: 'webhook-1' }
      });

      expect(metrics['webhook_delivery_success_total{webhook_id=webhook-1}']).toMatchObject({
        name: 'webhook_delivery_success_total',
        type: 'counter',
        value: 2, // 2 successful deliveries for webhook-1
        labels: { webhook_id: 'webhook-1' }
      });

      expect(metrics['webhook_delivery_failure_total{webhook_id=webhook-1}']).toMatchObject({
        name: 'webhook_delivery_failure_total',
        type: 'counter',
        value: 1, // 1 failed delivery for webhook-1
        labels: { webhook_id: 'webhook-1' }
      });

      // Check success rate (2 success out of 3 total = 66.67%)
      const successRateMetric = metrics['webhook_success_rate_percent{webhook_id=webhook-1}'];
      expect(successRateMetric).toBeDefined();
      expect(successRateMetric!.value).toBeCloseTo(66.67, 1);

      // Check response time metrics
      const responseTimeMetric = metrics['webhook_response_time_ms{webhook_id=webhook-1}'];
      expect(responseTimeMetric).toBeDefined();
      expect(responseTimeMetric!.type).toBe('histogram');
      expect(responseTimeMetric!.histogramData?.count).toBe(3);

      // Check subscription metrics
      expect(metrics['subscription_deliveries_total{subscription_id=sub-1}']).toMatchObject({
        name: 'subscription_deliveries_total',
        type: 'counter',
        value: 3,
        labels: { subscription_id: 'sub-1' }
      });

      // Check overall response time metrics
      expect(metrics['overall_response_time_avg_ms']).toBeDefined();
      expect(metrics['overall_response_time_p95_ms']).toBeDefined();
    });

    it('should auto-load from deliveries on startup', async () => {
      if (!dbPool || !isDatabaseAvailable) {
        console.warn('Skipping test: Database not available');
        return;
      }

      // Arrange - Insert test delivery data
      const client = await dbPool.connect();
      try {
        await client.query("DELETE FROM deliveries WHERE id LIKE 'test_auto_%'");
        
        await client.query(`
          INSERT INTO deliveries (id, webhook_id, subscription_id, status, response_time, event_data, payload, created_at) VALUES
          ('test_auto_1', 'webhook-auto', 'sub-auto', 'completed', 250, '{}', '{}', NOW() - INTERVAL '30 minutes')
        `);
      } finally {
        client.release();
      }

      // Act - Create collector with auto-loading from deliveries
      metricsCollector = new MetricsCollector({
        dbPool: dbPool!,
        enablePersistence: true,
        loadHistoricalData: true,
        loadFromDeliveries: true,
        historicalDataHours: 1
      });

      // Wait for async loading
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Assert
      const metrics = metricsCollector.getMetrics();
      expect(metrics['webhook_deliveries_total{webhook_id=webhook-auto}']).toMatchObject({
        name: 'webhook_deliveries_total',
        type: 'counter',
        value: 1,
        labels: { webhook_id: 'webhook-auto' }
      });
    });

    it('should generate Prometheus metrics from delivery data', async () => {
      if (!dbPool || !isDatabaseAvailable) {
        console.warn('Skipping test: Database not available');
        return;
      }

      // Arrange - Insert test delivery data
      const client = await dbPool.connect();
      try {
        await client.query("DELETE FROM deliveries WHERE id LIKE 'test_prom_%'");
        
        await client.query(`
          INSERT INTO deliveries (id, webhook_id, subscription_id, status, response_time, event_data, payload, created_at) VALUES
          ('test_prom_1', 'webhook-prom', 'sub-prom', 'completed', 100, '{}', '{}', NOW() - INTERVAL '30 minutes'),
          ('test_prom_2', 'webhook-prom', 'sub-prom', 'failed', 2000, '{}', '{}', NOW() - INTERVAL '15 minutes')
        `);
      } finally {
        client.release();
      }

      // Act
      metricsCollector = new MetricsCollector({
        dbPool: dbPool!,
        enablePersistence: true,
        loadHistoricalData: false
      });

      await metricsCollector.loadMetricsFromDeliveries(1);
      const prometheusOutput = metricsCollector.getPrometheusMetrics();

      // Assert
      expect(prometheusOutput).toContain('# HELP webhook_deliveries_total');
      expect(prometheusOutput).toContain('# TYPE webhook_deliveries_total counter');
      expect(prometheusOutput).toContain('webhook_deliveries_total{webhook_id="webhook-prom"} 2');
      
      expect(prometheusOutput).toContain('webhook_delivery_success_total{webhook_id="webhook-prom"} 1');
      expect(prometheusOutput).toContain('webhook_delivery_failure_total{webhook_id="webhook-prom"} 1');
      
      expect(prometheusOutput).toContain('# HELP webhook_success_rate_percent');
      expect(prometheusOutput).toContain('webhook_success_rate_percent{webhook_id="webhook-prom"} 50');
    });
  });
});