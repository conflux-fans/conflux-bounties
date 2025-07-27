#!/usr/bin/env tsx

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { prisma } from '../lib/database';

interface JsonDatabase {
  audit_reports: any[];
  webhook_configurations: any[];
  webhook_deliveries: any[];
}

function convertAuditStatus(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'COMPLETED';
    case 'failed':
      return 'FAILED';
    case 'processing':
      return 'PROCESSING';
    default:
      return 'FAILED';
  }
}

async function migrateData() {
  console.log('🚀 Starting data migration from JSON to PostgreSQL...\n');

  const dataPath = join(process.cwd(), 'data', 'database.json');
  
  if (!existsSync(dataPath)) {
    console.log('❌ No database.json file found at:', dataPath);
    console.log('   Nothing to migrate.');
    return;
  }

  let jsonData: JsonDatabase;
  
  try {
    const fileContent = readFileSync(dataPath, 'utf8');
    jsonData = JSON.parse(fileContent);
    console.log('✅ Successfully loaded JSON database');
  } catch (error) {
    console.error('❌ Error reading JSON database:', error);
    return;
  }

  // Check database connection
  try {
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL database');
  } catch (error) {
    console.error('❌ Error connecting to PostgreSQL:', error);
    console.log('   Make sure your DATABASE_URL is correct and PostgreSQL is running');
    return;
  }

  let migratedReports = 0;
  let migratedWebhooks = 0;
  let migratedDeliveries = 0;

  // Migrate audit reports
  if (jsonData.audit_reports && jsonData.audit_reports.length > 0) {
    console.log(`\n📊 Migrating ${jsonData.audit_reports.length} audit reports...`);
    
    for (const report of jsonData.audit_reports) {
      try {
        await prisma.auditReport.create({
          data: {
            id: report.id,
            contractAddress: report.contract_address,
            reportJson: report.report_json,
            reportMarkdown: report.report_markdown,
            findingsCount: report.findings_count,
            criticalFindings: report.critical_findings,
            highFindings: report.high_findings,
            mediumFindings: report.medium_findings,
            lowFindings: report.low_findings,
            auditStatus: convertAuditStatus(report.audit_status) as any,
            createdAt: new Date(report.created_at),
            updatedAt: new Date(report.updated_at),
            processingTimeMs: report.processing_time_ms,
            errorMessage: report.error_message,
            auditEngineVersion: report.audit_engine_version,
            staticAnalysisTools: report.static_analysis_tools
          }
        });
        migratedReports++;
      } catch (error) {
        console.error(`   ⚠️  Error migrating report ${report.id}:`, error);
      }
    }
  }

  // Migrate webhook configurations
  if (jsonData.webhook_configurations && jsonData.webhook_configurations.length > 0) {
    console.log(`\n🔗 Migrating ${jsonData.webhook_configurations.length} webhook configurations...`);
    
    for (const webhook of jsonData.webhook_configurations) {
      try {
        await prisma.webhookConfiguration.create({
          data: {
            id: webhook.id,
            userId: webhook.user_id,
            webhookUrl: webhook.webhook_url,
            events: webhook.events,
            isActive: webhook.is_active,
            secretHmac: webhook.secret_hmac,
            retryCount: webhook.retry_count,
            timeoutSeconds: webhook.timeout_seconds,
            customHeaders: webhook.custom_headers,
            createdAt: new Date(webhook.created_at),
            updatedAt: new Date(webhook.updated_at)
          }
        });
        migratedWebhooks++;
      } catch (error) {
        console.error(`   ⚠️  Error migrating webhook ${webhook.id}:`, error);
      }
    }
  }

  // Migrate webhook deliveries
  if (jsonData.webhook_deliveries && jsonData.webhook_deliveries.length > 0) {
    console.log(`\n📬 Migrating ${jsonData.webhook_deliveries.length} webhook deliveries...`);
    
    for (const delivery of jsonData.webhook_deliveries) {
      try {
        await prisma.webhookDelivery.create({
          data: {
            id: delivery.id,
            webhookId: delivery.webhook_id,
            auditId: delivery.audit_id,
            eventType: delivery.event_type,
            payload: delivery.payload,
            responseStatus: delivery.response_status,
            responseBody: delivery.response_body,
            deliveryAttempts: delivery.delivery_attempts,
            deliveredAt: delivery.delivered_at ? new Date(delivery.delivered_at) : null,
            createdAt: new Date(delivery.created_at)
          }
        });
        migratedDeliveries++;
      } catch (error) {
        console.error(`   ⚠️  Error migrating delivery ${delivery.id}:`, error);
      }
    }
  }

  console.log('\n✨ Migration completed!');
  console.log(`   📊 Audit reports: ${migratedReports} migrated`);
  console.log(`   🔗 Webhook configs: ${migratedWebhooks} migrated`);
  console.log(`   📬 Webhook deliveries: ${migratedDeliveries} migrated`);

  console.log('\n💡 Next steps:');
  console.log('   1. Test your API endpoints to ensure everything works');
  console.log('   2. Backup the data/database.json file');
  console.log('   3. Remove the data/database.json file if migration was successful');

  await prisma.$disconnect();
}

// Run the migration
migrateData().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});