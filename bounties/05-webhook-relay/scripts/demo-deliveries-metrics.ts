#!/usr/bin/env ts-node

import { Pool } from 'pg';
import { MetricsCollector } from '../src/monitoring/MetricsCollector';

async function demoDeliveriesMetrics() {
  console.log('🚀 Demo: Loading Metrics from Deliveries Table\n');

  // Database configuration
  const databaseUrl = process.env['DATABASE_URL'] || 
    'postgresql://webhook_user:webhook_pass@localhost:5432/webhook_relay';

  const dbPool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  try {
    // Step 1: Check database connection
    console.log('📊 Step 1: Checking database connection...');
    const client = await dbPool.connect();
    console.log('✅ Database connection successful');
    client.release();

    // Step 2: Ensure deliveries table exists and insert sample data
    console.log('\n📊 Step 2: Setting up sample delivery data...');
    const setupClient = await dbPool.connect();
    try {
      // Create deliveries table if it doesn't exist
      await setupClient.query(`
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

      // Clean up any existing demo data
      await setupClient.query("DELETE FROM deliveries WHERE id LIKE 'demo_%'");
      await setupClient.query("DELETE FROM webhooks WHERE id LIKE 'webhook-%'");
      await setupClient.query("DELETE FROM subscriptions WHERE id LIKE 'subscription-%'");

      // Insert sample subscriptions first
      await setupClient.query(`
        INSERT INTO subscriptions (id, name, contract_address, event_signature, active) VALUES
        ('subscription-erc20-transfers', 'ERC20 Token Transfers', '0x1234567890123456789012345678901234567890', 'Transfer(address,address,uint256)', true),
        ('subscription-nft-mints', 'NFT Minting Events', '0x2345678901234567890123456789012345678901', 'Mint(address,uint256)', true),
        ('subscription-defi-events', 'DeFi Protocol Events', '0x3456789012345678901234567890123456789012', 'Deposit(address,uint256)', true)
      `);

      // Insert sample webhooks
      await setupClient.query(`
        INSERT INTO webhooks (id, subscription_id, url, format, active) VALUES
        ('webhook-1', 'subscription-erc20-transfers', 'https://hooks.zapier.com/hooks/catch/123456/abcdef/', 'zapier', true),
        ('webhook-2', 'subscription-nft-mints', 'https://hook.integromat.com/abcdef123456', 'make', true),
        ('webhook-3', 'subscription-defi-events', 'https://n8n.example.com/webhook/test', 'n8n', true)
      `);

      // Insert sample delivery data representing different scenarios
      await setupClient.query(`
        INSERT INTO deliveries (id, webhook_id, subscription_id, status, response_time, response_status, event_data, payload, created_at, completed_at) VALUES
        -- Successful deliveries for webhook-1
        ('demo_1', 'webhook-1', 'subscription-erc20-transfers', 'completed', 120, 200, '{"event": "Transfer", "from": "0x123", "to": "0x456", "value": "1000"}', '{"message": "Token transfer detected"}', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours' + INTERVAL '120 milliseconds'),
        ('demo_2', 'webhook-1', 'subscription-erc20-transfers', 'completed', 95, 200, '{"event": "Transfer", "from": "0x789", "to": "0xabc", "value": "500"}', '{"message": "Token transfer detected"}', NOW() - INTERVAL '2.5 hours', NOW() - INTERVAL '2.5 hours' + INTERVAL '95 milliseconds'),
        ('demo_3', 'webhook-1', 'subscription-erc20-transfers', 'completed', 200, 200, '{"event": "Transfer", "from": "0xdef", "to": "0x123", "value": "2000"}', '{"message": "Token transfer detected"}', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours' + INTERVAL '200 milliseconds'),
        
        -- Failed deliveries for webhook-1
        ('demo_4', 'webhook-1', 'subscription-erc20-transfers', 'failed', 5000, 500, '{"event": "Transfer", "from": "0x111", "to": "0x222", "value": "750"}', '{"message": "Token transfer detected"}', NOW() - INTERVAL '1.5 hours', NULL),
        ('demo_5', 'webhook-1', 'subscription-erc20-transfers', 'failed', 3000, 404, '{"event": "Transfer", "from": "0x333", "to": "0x444", "value": "1250"}', '{"message": "Token transfer detected"}', NOW() - INTERVAL '1 hour', NULL),
        
        -- Deliveries for webhook-2 (different subscription)
        ('demo_6', 'webhook-2', 'subscription-nft-mints', 'completed', 150, 200, '{"event": "Mint", "to": "0x555", "tokenId": "123"}', '{"message": "NFT minted"}', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '45 minutes' + INTERVAL '150 milliseconds'),
        ('demo_7', 'webhook-2', 'subscription-nft-mints', 'completed', 180, 200, '{"event": "Mint", "to": "0x666", "tokenId": "124"}', '{"message": "NFT minted"}', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes' + INTERVAL '180 milliseconds'),
        
        -- Deliveries for webhook-3 (Zapier integration)
        ('demo_8', 'webhook-3', 'subscription-defi-events', 'completed', 300, 200, '{"event": "Deposit", "user": "0x777", "amount": "5000"}', '{"message": "DeFi deposit detected"}', NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes' + INTERVAL '300 milliseconds'),
        ('demo_9', 'webhook-3', 'subscription-defi-events', 'failed', 10000, 408, '{"event": "Withdrawal", "user": "0x888", "amount": "3000"}', '{"message": "DeFi withdrawal detected"}', NOW() - INTERVAL '15 minutes', NULL),
        
        -- Recent pending delivery
        ('demo_10', 'webhook-1', 'subscription-erc20-transfers', 'pending', NULL, NULL, '{"event": "Transfer", "from": "0x999", "to": "0xaaa", "value": "800"}', '{"message": "Token transfer detected"}', NOW() - INTERVAL '5 minutes', NULL)
      `);

      console.log('✅ Sample delivery data inserted successfully');
      console.log('   - 10 deliveries across 3 webhooks and 3 subscriptions');
      console.log('   - Mix of completed, failed, and pending statuses');
      console.log('   - Response times ranging from 95ms to 10s');
    } finally {
      setupClient.release();
    }

    // Step 3: Create MetricsCollector and load from deliveries
    console.log('\n📊 Step 3: Loading metrics from deliveries table...');
    const metricsCollector = new MetricsCollector({
      dbPool,
      enablePersistence: true,
      loadHistoricalData: false // We'll load manually for demo
    });

    await metricsCollector.loadMetricsFromDeliveries(24); // Load last 24 hours
    
    const metrics = metricsCollector.getMetrics();
    console.log(`📈 Generated ${Object.keys(metrics).length} metrics from delivery data`);

    // Step 4: Display key metrics
    console.log('\n📊 Step 4: Key Metrics Generated:');
    
    console.log('\n🔗 Webhook-Level Metrics:');
    const webhookIds = ['webhook-1', 'webhook-2', 'webhook-3'];
    for (const webhookId of webhookIds) {
      const total = metrics[`webhook_deliveries_total{webhook_id=${webhookId}}`]?.value || 0;
      const success = metrics[`webhook_delivery_success_total{webhook_id=${webhookId}}`]?.value || 0;
      const failure = metrics[`webhook_delivery_failure_total{webhook_id=${webhookId}}`]?.value || 0;
      const successRate = metrics[`webhook_success_rate_percent{webhook_id=${webhookId}}`]?.value || 0;
      const avgResponseTime = metrics[`webhook_response_time_ms{webhook_id=${webhookId}}`]?.value || 0;
      
      console.log(`  ${webhookId}:`);
      console.log(`    Total: ${total}, Success: ${success}, Failed: ${failure}`);
      console.log(`    Success Rate: ${successRate}%, Avg Response Time: ${avgResponseTime}ms`);
    }

    console.log('\n📊 Subscription-Level Metrics:');
    const subscriptionIds = ['subscription-erc20-transfers', 'subscription-nft-mints', 'subscription-defi-events'];
    for (const subId of subscriptionIds) {
      const total = metrics[`subscription_deliveries_total{subscription_id=${subId}}`]?.value || 0;
      const success = metrics[`subscription_success_total{subscription_id=${subId}}`]?.value || 0;
      const failure = metrics[`subscription_failure_total{subscription_id=${subId}}`]?.value || 0;
      
      console.log(`  ${subId}: Total: ${total}, Success: ${success}, Failed: ${failure}`);
    }

    console.log('\n🌍 Overall Performance Metrics:');
    const overallAvg = metrics['overall_response_time_avg_ms']?.value || 0;
    const p50 = metrics['overall_response_time_p50_ms']?.value || 0;
    const p95 = metrics['overall_response_time_p95_ms']?.value || 0;
    const p99 = metrics['overall_response_time_p99_ms']?.value || 0;
    
    console.log(`  Average Response Time: ${overallAvg}ms`);
    console.log(`  50th Percentile: ${p50}ms`);
    console.log(`  95th Percentile: ${p95}ms`);
    console.log(`  99th Percentile: ${p99}ms`);

    // Step 5: Show hourly breakdown
    console.log('\n⏰ Hourly Breakdown:');
    const hourlyMetrics = Object.entries(metrics).filter(([key]) => key.startsWith('hourly_deliveries_total'));
    for (const [, metric] of hourlyMetrics) {
      const hour = metric.labels['hour'];
      const total = metric.value;
      const success = metrics[`hourly_success_total{hour=${hour}}`]?.value || 0;
      const failure = metrics[`hourly_failure_total{hour=${hour}}`]?.value || 0;
      
      console.log(`  ${hour}: ${total} total (${success} success, ${failure} failed)`);
    }

    // Step 6: Generate Prometheus export
    console.log('\n📊 Step 5: Prometheus Export Sample:');
    const prometheusOutput = metricsCollector.getPrometheusMetrics();
    
    // Show first 20 lines of Prometheus output
    const lines = prometheusOutput.split('\n').slice(0, 20);
    console.log(lines.join('\n'));
    console.log('...(truncated)');
    
    console.log(`\n📏 Full Prometheus output: ${prometheusOutput.split('\n').length} lines`);

    // Step 7: Demonstrate auto-loading
    console.log('\n📊 Step 6: Demonstrating auto-loading from deliveries...');
    const autoCollector = new MetricsCollector({
      dbPool,
      enablePersistence: true,
      loadHistoricalData: true,
      loadFromDeliveries: true,
      historicalDataHours: 4
    });

    // Wait for async loading
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const autoMetrics = autoCollector.getMetrics();
    console.log(`📈 Auto-loaded ${Object.keys(autoMetrics).length} metrics`);
    
    if (Object.keys(autoMetrics).length === Object.keys(metrics).length) {
      console.log('✅ Auto-loading produced same results as manual loading');
    } else {
      console.log('⚠️  Auto-loading produced different results');
    }

    // Step 8: Show practical use case
    console.log('\n📊 Step 7: Practical Use Case - Webhook Health Dashboard:');
    console.log('\n🏥 Webhook Health Report:');
    
    for (const webhookId of webhookIds) {
      const total = metrics[`webhook_deliveries_total{webhook_id=${webhookId}}`]?.value || 0;
      const successRate = metrics[`webhook_success_rate_percent{webhook_id=${webhookId}}`]?.value || 0;
      const avgResponseTime = metrics[`webhook_response_time_ms{webhook_id=${webhookId}}`]?.value || 0;
      
      let healthStatus = '🟢 Healthy';
      if (successRate < 90) {
        healthStatus = '🔴 Unhealthy';
      } else if (successRate < 95 || avgResponseTime > 1000) {
        healthStatus = '🟡 Warning';
      }
      
      console.log(`  ${webhookId}: ${healthStatus}`);
      console.log(`    Success Rate: ${successRate}% (${successRate >= 95 ? '✅' : '❌'} Target: ≥95%)`);
      console.log(`    Avg Response: ${avgResponseTime}ms (${avgResponseTime <= 1000 ? '✅' : '❌'} Target: ≤1000ms)`);
      console.log(`    Total Deliveries: ${total}`);
    }

    // First check if data exists before cleanup
    console.log('\n🔍 Checking inserted data...');
    const checkClient = await dbPool.connect();
    try {
      const result = await checkClient.query("SELECT COUNT(*) as count FROM deliveries WHERE id LIKE 'demo_%'");
      console.log(`📊 Found ${result.rows[0].count} demo delivery records`);
      
      if (result.rows[0].count > 0) {
        const sampleResult = await checkClient.query("SELECT id, webhook_id, status, created_at FROM deliveries WHERE id LIKE 'demo_%' ORDER BY created_at LIMIT 3");
        console.log('📋 Sample records:');
        sampleResult.rows.forEach(row => {
          console.log(`   ${row.id}: ${row.webhook_id} - ${row.status} (${row.created_at})`);
        });
      }
    } finally {
      checkClient.release();
    }

    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await metricsCollector.stop();
    await autoCollector.stop();

    const cleanupClient = await dbPool.connect();
    try {
      await cleanupClient.query("DELETE FROM deliveries WHERE id LIKE 'demo_%'");
      await cleanupClient.query("DELETE FROM webhooks WHERE id LIKE 'webhook-%'");
      await cleanupClient.query("DELETE FROM subscriptions WHERE id LIKE 'subscription-%'");
      console.log('✅ Demo data cleaned up');
    } finally {
      cleanupClient.release();
    }

    console.log('\n🎉 Demo completed successfully!');
    console.log('\n💡 Key Takeaways:');
    console.log('   • Metrics can be generated from existing delivery records');
    console.log('   • Provides webhook performance insights without additional instrumentation');
    console.log('   • Supports both manual and automatic loading');
    console.log('   • Generates Prometheus-compatible metrics for monitoring dashboards');
    console.log('   • Enables data-driven webhook health monitoring');

  } catch (error) {
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
  } finally {
    await dbPool.end();
  }
}

// Run the demo if this script is executed directly
if (require.main === module) {
  demoDeliveriesMetrics().catch(console.error);
}

export { demoDeliveriesMetrics };