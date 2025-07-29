import { NextRequest, NextResponse } from 'next/server';
import { getAuditReportsByAddress, getAuditReportStats, AuditReport } from '@/lib/database';

interface AuditHistoryParams {
  address: string;
}

interface AuditHistoryQuery {
  limit?: string;
  offset?: string;
  includeStats?: string;
  status?: string;
}

interface TransformedAuditReport {
  id: string;
  contractAddress: string;
  auditStatus: string;
  findingsCount: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  createdAt: string;
  updatedAt: string;
  processingTimeMs?: number | null;
  errorMessage?: string | null;
  auditEngineVersion?: string | null;
  staticAnalysisTools?: string | null;
  reportData?: {
    json: string;
    markdown: string;
  };
}

interface AuditHistoryResponse {
  address: string;
  reports: TransformedAuditReport[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  stats?: {
    total: number;
    completed: number;
    failed: number;
    avgFindings: number;
    severityDistribution: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
}

function validateAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  
  const trimmed = address.trim();
  if (trimmed.length < 10) return false;
  
  return /^0x[a-fA-F0-9]{8,}$/i.test(trimmed);
}

function validateQueryParams(searchParams: URLSearchParams): {
  limit: number;
  offset: number;
  includeStats: boolean;
  status?: string;
} {
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 100);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
  const includeStats = searchParams.get('includeStats') === 'true';
  const status = searchParams.get('status') || undefined;

  if (status && !['completed', 'failed', 'processing'].includes(status)) {
    throw new Error('Invalid status parameter. Must be one of: completed, failed, processing');
  }

  return { limit, offset, includeStats, status };
}

function transformReportForResponse(report: AuditReport): TransformedAuditReport {
  return {
    id: report.id,
    contractAddress: report.contract_address,
    auditStatus: report.audit_status,
    findingsCount: report.findings_count,
    severityBreakdown: {
      critical: report.critical_findings,
      high: report.high_findings,
      medium: report.medium_findings,
      low: report.low_findings
    },
    createdAt: report.created_at,
    updatedAt: report.updated_at,
    processingTimeMs: report.processing_time_ms,
    errorMessage: report.error_message,
    auditEngineVersion: report.audit_engine_version,
    staticAnalysisTools: report.static_analysis_tools,
    reportData: report.audit_status === 'completed' ? {
      json: report.report_json,
      markdown: report.report_markdown
    } : undefined
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<AuditHistoryParams> }
) {
  try {
    const { address } = await params;
    const { searchParams } = new URL(request.url);

    console.log(`[ReportsHistory] Starting search request for address: "${address}"`);
    console.log(`[ReportsHistory] Full URL: ${request.url}`);
    console.log(`[ReportsHistory] Search params:`, Object.fromEntries(searchParams.entries()));

    if (!validateAddress(address)) {
      console.log(`[ReportsHistory] Address validation failed for: "${address}"`);
      return NextResponse.json(
        { 
          error: 'Invalid contract address format',
          details: 'Address must be a valid EVM address starting with "0x" and containing at least 8 hex characters'
        },
        { status: 400 }
      );
    }

    console.log(`[ReportsHistory] Address validation passed for: "${address}"`);

    let queryParams;
    try {
      queryParams = validateQueryParams(searchParams);
      console.log(`[ReportsHistory] Query params validated:`, queryParams);
    } catch (error) {
      console.log(`[ReportsHistory] Query parameter validation failed:`, error);
      return NextResponse.json(
        { 
          error: 'Invalid query parameters',
          details: error instanceof Error ? error.message : 'Unknown parameter validation error'
        },
        { status: 400 }
      );
    }

    const { limit, offset, includeStats, status } = queryParams;

    console.log(`[ReportsHistory] Fetching audit history for address: "${address}", limit: ${limit}, offset: ${offset}, status: ${status}, includeStats: ${includeStats}`);

    const startTime = Date.now();
    const result = await getAuditReportsByAddress(address, limit + 1, offset, status);
    const dbQueryTime = Date.now() - startTime;
    
    console.log(`[ReportsHistory] Database query completed in ${dbQueryTime}ms`);
    console.log(`[ReportsHistory] Database result:`, {
      totalReports: result.total,
      returnedReports: result.reports.length,
      firstReportId: result.reports[0]?.id || 'none',
      addressMatches: result.reports.map(r => r.contract_address)
    });
    
    const resultReports = result?.reports || [];
    
    const hasMore = resultReports.length > limit;
    const reports = hasMore ? resultReports.slice(0, limit) : resultReports;

    const transformedReports = reports.map(transformReportForResponse);

    let stats;
    if (includeStats) {
      console.log(`[ReportsHistory] Fetching stats for address: "${address}"`);
      try {
        const statsStartTime = Date.now();
        const rawStats = await getAuditReportStats(address);
        const statsQueryTime = Date.now() - statsStartTime;
        
        console.log(`[ReportsHistory] Stats query completed in ${statsQueryTime}ms:`, rawStats);
        
        stats = {
          total: rawStats.total,
          completed: rawStats.completed,
          failed: rawStats.failed,
          avgFindings: rawStats.avgFindings,
          severityDistribution: {
            critical: rawStats.totalCritical,
            high: rawStats.totalHigh,
            medium: rawStats.totalMedium,
            low: rawStats.totalLow
          }
        };
      } catch (error) {
        console.warn(`[ReportsHistory] Failed to fetch stats for "${address}":`, error);
      }
    }

    const response: AuditHistoryResponse = {
      address,
      reports: transformedReports,
      pagination: {
        limit,
        offset,
        total: result.total,
        hasMore
      },
      ...(stats && { stats })
    };

    console.log(`[ReportsHistory] Sending response:`, {
      address: response.address,
      reportCount: response.reports.length,
      pagination: response.pagination,
      hasStats: !!response.stats
    });

    const cacheMaxAge = 300; // 5 minutes
    const headers = {
      'Cache-Control': `public, max-age=${cacheMaxAge}, stale-while-revalidate=600`,
      'Content-Type': 'application/json'
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('[ReportsHistory] Error fetching audit history:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const isValidationError = errorMessage.includes('Invalid') || errorMessage.includes('validation');
    const statusCode = isValidationError ? 400 : 500;
    
    let errorAddress = 'unknown';
    try {
      const { address: paramAddress } = await params;
      errorAddress = paramAddress;
    } catch {
    }
    
    return NextResponse.json(
      { 
        error: statusCode === 500 ? 'Internal server error occurred while fetching audit history' : errorMessage,
        type: 'audit_history_error',
        address: errorAddress,
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    );
  }
}

export type { AuditHistoryResponse, AuditHistoryParams, AuditHistoryQuery, TransformedAuditReport };