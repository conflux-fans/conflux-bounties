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

interface AuditHistoryResponse {
  address: string;
  reports: AuditReport[];
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

/**
 * Validate contract address format
 */
function validateAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  
  const trimmed = address.trim();
  if (trimmed.length < 10) return false;
  
  return trimmed.startsWith('cfx:') || trimmed.startsWith('0x');
}

/**
 * Sanitize and validate query parameters
 */
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

  // Validate status if provided
  if (status && !['completed', 'failed', 'processing'].includes(status)) {
    throw new Error('Invalid status parameter. Must be one of: completed, failed, processing');
  }

  return { limit, offset, includeStats, status };
}


/**
 * Transform report data for API response
 */
function transformReportForResponse(report: AuditReport) {
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
    // Only include report content for completed audits
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

    // Validate address
    if (!validateAddress(address)) {
      return NextResponse.json(
        { 
          error: 'Invalid contract address format',
          details: 'Address must start with "cfx:" or "0x" and be at least 10 characters long'
        },
        { status: 400 }
      );
    }

    // Validate and parse query parameters
    let queryParams;
    try {
      queryParams = validateQueryParams(searchParams);
    } catch (error) {
      return NextResponse.json(
        { 
          error: 'Invalid query parameters',
          details: error instanceof Error ? error.message : 'Unknown parameter validation error'
        },
        { status: 400 }
      );
    }

    const { limit, offset, includeStats, status } = queryParams;

    console.log(`[ReportsHistory] Fetching audit history for address: ${address}, limit: ${limit}, offset: ${offset}`);

    // Fetch reports from local database
    const result = getAuditReportsByAddress(address, limit + 1, offset, status);
    
    // Determine pagination
    const hasMore = result.reports.length > limit;
    const reports = hasMore ? result.reports.slice(0, limit) : result.reports;

    // Transform reports for response
    const transformedReports = reports.map(transformReportForResponse);

    // Fetch stats if requested
    let stats;
    if (includeStats) {
      try {
        const rawStats = getAuditReportStats(address);
        
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
        console.warn(`[ReportsHistory] Failed to fetch stats for ${address}:`, error);
        // Continue without stats rather than failing the entire request
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

    // Add caching headers for successful responses
    const cacheMaxAge = 300; // 5 minutes
    const headers = {
      'Cache-Control': `public, max-age=${cacheMaxAge}, stale-while-revalidate=600`,
      'Content-Type': 'application/json'
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('[ReportsHistory] Error fetching audit history:', error);
    
    // Determine error type and status code
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const isValidationError = errorMessage.includes('Invalid') || errorMessage.includes('validation');
    const statusCode = isValidationError ? 400 : 500;
    
    return NextResponse.json(
      { 
        error: statusCode === 500 ? 'Internal server error occurred while fetching audit history' : errorMessage,
        type: 'audit_history_error',
        address,
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    );
  }
}

// Export types for use in other modules
export type { AuditHistoryResponse, AuditHistoryParams, AuditHistoryQuery };