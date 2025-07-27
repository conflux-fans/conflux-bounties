import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Database types
export interface AuditReport {
  id: string;
  contract_address: string;
  report_json: string; // JSON stringified
  report_markdown: string;
  findings_count: number;
  critical_findings: number;
  high_findings: number;
  medium_findings: number;
  low_findings: number;
  audit_status: 'completed' | 'failed' | 'processing';
  created_at: string;
  updated_at: string;
  processing_time_ms?: number;
  error_message?: string;
  audit_engine_version?: string;
  static_analysis_tools?: string; // JSON stringified array
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

// Webhook types
export interface WebhookConfiguration {
  id: string;
  user_id: string;
  webhook_url: string;
  events: string; // JSON stringified array
  is_active: boolean;
  secret_hmac?: string;
  retry_count: number;
  timeout_seconds: number;
  custom_headers?: string; // JSON stringified object
  created_at: string;
  updated_at: string;
}

export interface WebhookConfigurationInsert {
  user_id: string;
  webhook_url: string;
  events: string[];
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
  payload: string; // JSON stringified
  response_status?: number;
  response_body?: string;
  delivery_attempts: number;
  delivered_at?: string;
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

// Database structure
interface Database {
  audit_reports: AuditReport[];
  webhook_configurations: WebhookConfiguration[];
  webhook_deliveries: WebhookDelivery[];
}

// Initialize database directory and file
const dataDir = join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, 'database.json');

// Initialize empty database if it doesn't exist
function initializeDatabase(): Database {
  if (!existsSync(dbPath)) {
    const emptyDb: Database = {
      audit_reports: [],
      webhook_configurations: [],
      webhook_deliveries: []
    };
    writeFileSync(dbPath, JSON.stringify(emptyDb, null, 2));
    return emptyDb;
  }
  
  try {
    const data = readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database file, creating new one:', error);
    const emptyDb: Database = {
      audit_reports: [],
      webhook_configurations: [],
      webhook_deliveries: []
    };
    writeFileSync(dbPath, JSON.stringify(emptyDb, null, 2));
    return emptyDb;
  }
}

// Read database
function readDatabase(): Database {
  try {
    const data = readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return initializeDatabase();
  }
}

// Write database
function writeDatabase(db: Database): void {
  try {
    writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('Error writing database:', error);
  }
}

// Initialize database on startup
initializeDatabase();

// Database operations
export async function insertAuditReport(report: AuditReportInsert): Promise<AuditReport | null> {
  try {
    const db = readDatabase();
    const id = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const newReport: AuditReport = {
      id,
      contract_address: report.contract_address,
      report_json: JSON.stringify(report.report_json),
      report_markdown: report.report_markdown,
      findings_count: report.findings_count,
      critical_findings: report.critical_findings,
      high_findings: report.high_findings,
      medium_findings: report.medium_findings,
      low_findings: report.low_findings,
      audit_status: report.audit_status,
      created_at: now,
      updated_at: now,
      processing_time_ms: report.processing_time_ms || null,
      error_message: report.error_message || null,
      audit_engine_version: report.audit_engine_version || null,
      static_analysis_tools: report.static_analysis_tools ? JSON.stringify(report.static_analysis_tools) : null
    };
    
    db.audit_reports.push(newReport);
    writeDatabase(db);
    
    return newReport;
  } catch (error) {
    console.error('Error inserting audit report:', error);
    return null;
  }
}

export function getAuditReportById(id: string): AuditReport | null {
  try {
    const db = readDatabase();
    const result = db.audit_reports.find(report => report.id === id);
    return result || null;
  } catch (error) {
    console.error('Error getting audit report by ID:', error);
    return null;
  }
}

export function getAuditReportsByAddress(
  address: string,
  limit: number = 50,
  offset: number = 0,
  status?: string
): { reports: AuditReport[]; total: number } {
  try {
    const db = readDatabase();
    let filteredReports = db.audit_reports.filter(report => report.contract_address === address);
    
    if (status) {
      filteredReports = filteredReports.filter(report => report.audit_status === status);
    }
    
    // Sort by created_at descending
    filteredReports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    const total = filteredReports.length;
    const reports = filteredReports.slice(offset, offset + limit);
    
    return { reports, total };
  } catch (error) {
    console.error('Error getting audit reports by address:', error);
    return { reports: [], total: 0 };
  }
}

export function getLatestAuditReport(address: string): AuditReport | null {
  try {
    const db = readDatabase();
    const reports = db.audit_reports
      .filter(report => report.contract_address === address)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return reports[0] || null;
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
): { reports: AuditReport[]; total: number } {
  try {
    const db = readDatabase();
    let reports = [...db.audit_reports];
    
    // Sort
    reports.sort((a, b) => {
      const aValue = a[sortBy as keyof AuditReport] || '';
      const bValue = b[sortBy as keyof AuditReport] || '';
      
      if (order === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    const total = reports.length;
    const paginatedReports = reports.slice(offset, offset + limit);
    
    return { reports: paginatedReports, total };
  } catch (error) {
    console.error('Error getting all reports:', error);
    return { reports: [], total: 0 };
  }
}

export function getAuditReportStats(address?: string) {
  try {
    const db = readDatabase();
    let reports = db.audit_reports;
    
    if (address) {
      reports = reports.filter(report => report.contract_address === address);
    }
    
    const total = reports.length;
    const completed = reports.filter(r => r.audit_status === 'completed').length;
    const failed = reports.filter(r => r.audit_status === 'failed').length;
    const processing = reports.filter(r => r.audit_status === 'processing').length;
    
    const completedReports = reports.filter(r => r.audit_status === 'completed');
    const avgFindings = completedReports.length > 0 
      ? completedReports.reduce((sum, r) => sum + r.findings_count, 0) / completedReports.length 
      : 0;
    
    const totalCritical = reports.reduce((sum, r) => sum + r.critical_findings, 0);
    const totalHigh = reports.reduce((sum, r) => sum + r.high_findings, 0);
    const totalMedium = reports.reduce((sum, r) => sum + r.medium_findings, 0);
    const totalLow = reports.reduce((sum, r) => sum + r.low_findings, 0);
    
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

// Webhook functions
export function getActiveWebhookConfigurations(): WebhookConfiguration[] {
  try {
    const db = readDatabase();
    return db.webhook_configurations.filter(config => config.is_active);
  } catch (error) {
    console.error('Error getting active webhook configurations:', error);
    return [];
  }
}

export async function insertWebhookDelivery(delivery: WebhookDeliveryInsert): Promise<WebhookDelivery | null> {
  try {
    const db = readDatabase();
    const id = `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const newDelivery: WebhookDelivery = {
      id,
      webhook_id: delivery.webhook_id,
      audit_id: delivery.audit_id,
      event_type: delivery.event_type,
      payload: JSON.stringify(delivery.payload),
      response_status: delivery.response_status || null,
      response_body: delivery.response_body || null,
      delivery_attempts: delivery.delivery_attempts || 0,
      delivered_at: delivery.delivered_at || null,
      created_at: now
    };
    
    db.webhook_deliveries.push(newDelivery);
    writeDatabase(db);
    
    return newDelivery;
  } catch (error) {
    console.error('Error inserting webhook delivery:', error);
    return null;
  }
}

export function getWebhookDeliveryById(id: string): WebhookDelivery | null {
  try {
    const db = readDatabase();
    const result = db.webhook_deliveries.find(delivery => delivery.id === id);
    return result || null;
  } catch (error) {
    console.error('Error getting webhook delivery by ID:', error);
    return null;
  }
}

export default { readDatabase, writeDatabase };