import { NextRequest, NextResponse } from 'next/server';
import { getAllReports, AuditReport } from '@/lib/database';

interface GlobalReportsQuery {
  limit?: string;
  offset?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface GlobalReportsResponse {
  reports: any[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  filters: {
    status?: string;
    sortBy: string;
    sortOrder: string;
  };
}

/**
 * Validate and sanitize query parameters
 */
function validateQueryParams(searchParams: URLSearchParams): {
  limit: number;
  offset: number;
  status?: string;
  sortBy: string;
  sortOrder: string;
} {
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 100);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
  const status = searchParams.get('status') || undefined;
  const sortBy = searchParams.get('sortBy') || 'created_at';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  // Validate status if provided
  if (status && !['completed', 'failed', 'processing'].includes(status)) {
    throw new Error('Invalid status parameter. Must be one of: completed, failed, processing');
  }

  // Validate sort parameters
  const validSortFields = ['created_at', 'updated_at', 'contract_address', 'findings_count', 'processing_time_ms'];
  if (!validSortFields.includes(sortBy)) {
    throw new Error(`Invalid sortBy parameter. Must be one of: ${validSortFields.join(', ')}`);
  }

  if (!['asc', 'desc'].includes(sortOrder)) {
    throw new Error('Invalid sortOrder parameter. Must be one of: asc, desc');
  }

  return { limit, offset, status, sortBy, sortOrder };
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
    staticAnalysisTools: report.static_analysis_tools ? JSON.parse(report.static_analysis_tools) : []
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

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

    const { limit, offset, status, sortBy, sortOrder } = queryParams;

    console.log(`[GlobalReports] Fetching reports: limit=${limit}, offset=${offset}, status=${status}, sort=${sortBy} ${sortOrder}`);

    // Get reports from database
    const { reports, total: totalCount } = await getAllReports(
      limit,
      offset,
      sortBy,
      sortOrder === 'asc' ? 'asc' : 'desc'
    );

    // Filter by status if specified (TODO: move this to database function)
    let filteredReports = reports || [];
    if (status && reports) {
      filteredReports = reports.filter(report => report.audit_status === status);
    }

    // Transform reports for response
    const transformedReports = filteredReports.map(transformReportForResponse);

    // Calculate pagination
    const hasMore = offset + limit < totalCount;

    const response: GlobalReportsResponse = {
      reports: transformedReports,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore
      },
      filters: {
        status,
        sortBy,
        sortOrder
      }
    };

    // Add caching headers
    const cacheMaxAge = 300; // 5 minutes
    const headers = {
      'Cache-Control': `public, max-age=${cacheMaxAge}, stale-while-revalidate=600`,
      'Content-Type': 'application/json'
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('[GlobalReports] Error fetching global reports:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error occurred while fetching reports',
        type: 'global_reports_error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Export types for use in other modules
export type { GlobalReportsQuery, GlobalReportsResponse };