import { PrismaClient, AuditStatus } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuditReport {
  id: string;
  contract_address: string;
  report_json: string;
  report_markdown: string;
  findings_count: number;
  critical_findings: number;
  high_findings: number;
  medium_findings: number;
  low_findings: number;
  audit_status: 'completed' | 'failed' | 'processing';
  created_at: string;
  updated_at: string;
  processing_time_ms?: number | null;
  error_message?: string | null;
  audit_engine_version?: string | null;
  static_analysis_tools?: string | null;
}

export interface AuditReportInsert {
  contract_address: string;
  report_json: any;
  report_markdown: string;
  findings_count: number;
  critical_findings: number;
  high_findings: number;
  medium_findings: number;
  low_findings: number;
  audit_status: 'completed' | 'failed' | 'processing';
  processing_time_ms?: number;
  error_message?: string;
  audit_engine_version?: string;
  static_analysis_tools?: string[];
}

export interface WebhookConfiguration {
  id: string;
  user_id: string;
  webhook_url: string;
  events: string;
  is_active: boolean;
  secret_hmac?: string | null;
  retry_count: number;
  timeout_seconds: number;
  custom_headers?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookConfigurationInsert {
  user_id: string;
  webhook_url: string;
  events: string[];
  is_active?: boolean;
  secret_hmac?: string;
  retry_count?: number;
  timeout_seconds?: number;
  custom_headers?: Record<string, string>;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  audit_id: string;
  event_type: string;
  payload: string;
  response_status?: number | null;
  response_body?: string | null;
  delivery_attempts: number;
  delivered_at?: string | null;
  created_at: string;
}

export interface WebhookDeliveryInsert {
  webhook_id: string;
  audit_id: string;
  event_type: string;
  payload: any;
  response_status?: number;
  response_body?: string;
  delivery_attempts?: number;
  delivered_at?: string;
}

function auditStatusToString(status: AuditStatus): 'completed' | 'failed' | 'processing' {
  switch (status) {
    case AuditStatus.COMPLETED:
      return 'completed';
    case AuditStatus.FAILED:
      return 'failed';
    case AuditStatus.PROCESSING:
      return 'processing';
  }
}

function stringToAuditStatus(status: 'completed' | 'failed' | 'processing'): AuditStatus {
  switch (status) {
    case 'completed':
      return AuditStatus.COMPLETED;
    case 'failed':
      return AuditStatus.FAILED;
    case 'processing':
      return AuditStatus.PROCESSING;
  }
}

function transformPrismaAuditReport(report: any): AuditReport {
  return {
    id: report.id,
    contract_address: report.contractAddress,
    report_json: report.reportJson,
    report_markdown: report.reportMarkdown,
    findings_count: report.findingsCount,
    critical_findings: report.criticalFindings,
    high_findings: report.highFindings,
    medium_findings: report.mediumFindings,
    low_findings: report.lowFindings,
    audit_status: auditStatusToString(report.auditStatus),
    created_at: report.createdAt.toISOString(),
    updated_at: report.updatedAt.toISOString(),
    processing_time_ms: report.processingTimeMs,
    error_message: report.errorMessage,
    audit_engine_version: report.auditEngineVersion,
    static_analysis_tools: report.staticAnalysisTools
  };
}

export async function insertAuditReport(report: AuditReportInsert): Promise<AuditReport | null> {
  try {
    const result = await prisma.auditReport.create({
      data: {
        contractAddress: report.contract_address,
        reportJson: JSON.stringify(report.report_json),
        reportMarkdown: report.report_markdown,
        findingsCount: report.findings_count,
        criticalFindings: report.critical_findings,
        highFindings: report.high_findings,
        mediumFindings: report.medium_findings,
        lowFindings: report.low_findings,
        auditStatus: stringToAuditStatus(report.audit_status),
        processingTimeMs: report.processing_time_ms || null,
        errorMessage: report.error_message || null,
        auditEngineVersion: report.audit_engine_version || null,
        staticAnalysisTools: report.static_analysis_tools ? JSON.stringify(report.static_analysis_tools) : null
      }
    });

    return transformPrismaAuditReport(result);
  } catch (error) {
    console.error('Error inserting audit report:', error);
    return null;
  }
}

export async function getAuditReportById(id: string): Promise<AuditReport | null> {
  try {
    const result = await prisma.auditReport.findUnique({
      where: { id }
    });

    return result ? transformPrismaAuditReport(result) : null;
  } catch (error) {
    console.error('Error getting audit report by ID:', error);
    return null;
  }
}

export async function getAuditReportsByAddress(
  address: string,
  limit: number = 50,
  offset: number = 0,
  status?: string
): Promise<{ reports: AuditReport[]; total: number }> {
  try {
    
    const where: any = {
      contractAddress: {
        equals: address,
        mode: 'insensitive'
      }
    };

    if (status) {
      where.auditStatus = stringToAuditStatus(status as 'completed' | 'failed' | 'processing');
    }


    const [reports, total] = await Promise.all([
      prisma.auditReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.auditReport.count({ where })
    ]);


    return {
      reports: reports.map(transformPrismaAuditReport),
      total
    };
  } catch (error) {
    console.error('Error getting audit reports by address:', error);
    return { reports: [], total: 0 };
  }
}

export async function getLatestAuditReport(address: string): Promise<AuditReport | null> {
  try {
    const result = await prisma.auditReport.findFirst({
      where: { contractAddress: address },
      orderBy: { createdAt: 'desc' }
    });

    return result ? transformPrismaAuditReport(result) : null;
  } catch (error) {
    console.error('Error getting latest audit report:', error);
    return null;
  }
}

export function getAllReports(
  limit: number = 50,
  offset: number = 0,
  sortBy: string = 'created_at',
  order: 'asc' | 'desc' = 'desc'
): Promise<{ reports: AuditReport[]; total: number }> {
  try {
    const sortFieldMap: Record<string, string> = {
      'created_at': 'createdAt',
      'updated_at': 'updatedAt',
      'contract_address': 'contractAddress',
      'findings_count': 'findingsCount',
      'processing_time_ms': 'processingTimeMs'
    };

    const prismaSort = sortFieldMap[sortBy] || 'createdAt';

    return Promise.all([
      prisma.auditReport.findMany({
        orderBy: { [prismaSort]: order },
        take: limit,
        skip: offset
      }),
      prisma.auditReport.count()
    ]).then(([reports, total]) => ({
      reports: reports.map(transformPrismaAuditReport),
      total
    }));
  } catch (error) {
    console.error('Error getting all reports:', error);
    return Promise.resolve({ reports: [], total: 0 });
  }
}

export async function getAuditReportStats(address?: string) {
  try {
    const where = address ? { 
      contractAddress: {
        equals: address,
        mode: 'insensitive' as const
      }
    } : {};

    const [
      total,
      completed,
      failed,
      processing,
      completedReports
    ] = await Promise.all([
      prisma.auditReport.count({ where }),
      prisma.auditReport.count({ where: { ...where, auditStatus: AuditStatus.COMPLETED } }),
      prisma.auditReport.count({ where: { ...where, auditStatus: AuditStatus.FAILED } }),
      prisma.auditReport.count({ where: { ...where, auditStatus: AuditStatus.PROCESSING } }),
      prisma.auditReport.findMany({ 
        where: { ...where, auditStatus: AuditStatus.COMPLETED },
        select: {
          findingsCount: true,
          criticalFindings: true,
          highFindings: true,
          mediumFindings: true,
          lowFindings: true
        }
      })
    ]);

    const avgFindings = completedReports.length > 0 
      ? completedReports.reduce((sum, r) => sum + r.findingsCount, 0) / completedReports.length 
      : 0;
    
    const totalCritical = completedReports.reduce((sum, r) => sum + r.criticalFindings, 0);
    const totalHigh = completedReports.reduce((sum, r) => sum + r.highFindings, 0);
    const totalMedium = completedReports.reduce((sum, r) => sum + r.mediumFindings, 0);
    const totalLow = completedReports.reduce((sum, r) => sum + r.lowFindings, 0);

    return {
      total,
      completed,
      failed,
      processing,
      avgFindings,
      totalCritical,
      totalHigh,
      totalMedium,
      totalLow
    };
  } catch (error) {
    console.error('Error getting audit report stats:', error);
    return {
      total: 0,
      completed: 0,
      failed: 0,
      processing: 0,
      avgFindings: 0,
      totalCritical: 0,
      totalHigh: 0,
      totalMedium: 0,
      totalLow: 0
    };
  }
}

export async function getActiveWebhookConfigurations(): Promise<WebhookConfiguration[]> {
  try {
    const results = await prisma.webhookConfiguration.findMany({
      where: { isActive: true }
    });

    return results.map(config => ({
      id: config.id,
      user_id: config.userId,
      webhook_url: config.webhookUrl,
      events: config.events,
      is_active: config.isActive,
      secret_hmac: config.secretHmac,
      retry_count: config.retryCount,
      timeout_seconds: config.timeoutSeconds,
      custom_headers: config.customHeaders,
      created_at: config.createdAt.toISOString(),
      updated_at: config.updatedAt.toISOString()
    }));
  } catch (error) {
    console.error('Error getting active webhook configurations:', error);
    return [];
  }
}

export async function getWebhookConfigurationsByUserId(userId: string): Promise<WebhookConfiguration[]> {
  try {
    const results = await prisma.webhookConfiguration.findMany({
      where: { userId: userId }
    });

    return results.map(config => ({
      id: config.id,
      user_id: config.userId,
      webhook_url: config.webhookUrl,
      events: config.events,
      is_active: config.isActive,
      secret_hmac: config.secretHmac,
      retry_count: config.retryCount,
      timeout_seconds: config.timeoutSeconds,
      custom_headers: config.customHeaders,
      created_at: config.createdAt.toISOString(),
      updated_at: config.updatedAt.toISOString()
    }));
  } catch (error) {
    console.error('Error getting webhook configurations by user ID:', error);
    return [];
  }
}

export async function insertWebhookConfiguration(config: WebhookConfigurationInsert): Promise<WebhookConfiguration | null> {
  try {
    const result = await prisma.webhookConfiguration.create({
      data: {
        userId: config.user_id,
        webhookUrl: config.webhook_url,
        events: JSON.stringify(config.events),
        isActive: config.is_active ?? true,
        secretHmac: config.secret_hmac,
        retryCount: config.retry_count ?? 3,
        timeoutSeconds: config.timeout_seconds ?? 30,
        customHeaders: config.custom_headers ? JSON.stringify(config.custom_headers) : null
      }
    });

    return {
      id: result.id,
      user_id: result.userId,
      webhook_url: result.webhookUrl,
      events: result.events,
      is_active: result.isActive,
      secret_hmac: result.secretHmac,
      retry_count: result.retryCount,
      timeout_seconds: result.timeoutSeconds,
      custom_headers: result.customHeaders,
      created_at: result.createdAt.toISOString(),
      updated_at: result.updatedAt.toISOString()
    };
  } catch (error) {
    console.error('Error inserting webhook configuration:', error);
    return null;
  }
}

export async function insertWebhookDelivery(delivery: WebhookDeliveryInsert): Promise<WebhookDelivery | null> {
  try {
    const result = await prisma.webhookDelivery.create({
      data: {
        webhookId: delivery.webhook_id,
        auditId: delivery.audit_id,
        eventType: delivery.event_type,
        payload: JSON.stringify(delivery.payload),
        responseStatus: delivery.response_status || null,
        responseBody: delivery.response_body || null,
        deliveryAttempts: delivery.delivery_attempts || 0,
        deliveredAt: delivery.delivered_at ? new Date(delivery.delivered_at) : null
      }
    });

    return {
      id: result.id,
      webhook_id: result.webhookId,
      audit_id: result.auditId,
      event_type: result.eventType,
      payload: result.payload,
      response_status: result.responseStatus,
      response_body: result.responseBody,
      delivery_attempts: result.deliveryAttempts,
      delivered_at: result.deliveredAt?.toISOString() || null,
      created_at: result.createdAt.toISOString()
    };
  } catch (error) {
    console.error('Error inserting webhook delivery:', error);
    return null;
  }
}

export async function getWebhookDeliveryById(id: string): Promise<WebhookDelivery | null> {
  try {
    const result = await prisma.webhookDelivery.findUnique({
      where: { id }
    });

    if (!result) return null;

    return {
      id: result.id,
      webhook_id: result.webhookId,
      audit_id: result.auditId,
      event_type: result.eventType,
      payload: result.payload,
      response_status: result.responseStatus,
      response_body: result.responseBody,
      delivery_attempts: result.deliveryAttempts,
      delivered_at: result.deliveredAt?.toISOString() || null,
      created_at: result.createdAt.toISOString()
    };
  } catch (error) {
    console.error('Error getting webhook delivery by ID:', error);
    return null;
  }
}

export { prisma };

export default { prisma };