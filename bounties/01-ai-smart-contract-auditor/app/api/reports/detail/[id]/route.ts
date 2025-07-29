import { NextRequest, NextResponse } from 'next/server';
import { getAuditReportById, AuditReport } from '@/lib/database';
import { getContractSource } from '@/lib/confluxScanClient';

interface ReportParams {
  id: string;
}

interface ReportQuery {
  includeContent?: string;
  format?: string;
}

function validateReportId(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return true;
  }
  
  const cuidRegex = /^c[a-z0-9]{24}$/i;
  if (cuidRegex.test(id)) {
    return true;
  }
  
  const reportIdRegex = /^report_\d+_[a-z0-9]+$/i;
  return reportIdRegex.test(id);
}

async function transformReportForResponse(report: AuditReport, includeContent: boolean = true, includeSourceCode: boolean = false): Promise<any> {
  let reportJson = null;
  try {
    reportJson = typeof report.report_json === 'string' 
      ? JSON.parse(report.report_json) 
      : report.report_json;
  } catch (parseError) {
    console.warn(`[Reports] Failed to parse report JSON for ${report.id}:`, parseError);
    reportJson = null;
  }

  let staticAnalysisTools: string[] = [];
  try {
    staticAnalysisTools = typeof report.static_analysis_tools === 'string' 
      ? JSON.parse(report.static_analysis_tools) 
      : (Array.isArray(report.static_analysis_tools) ? report.static_analysis_tools : []);
  } catch (parseError) {
    console.warn(`[Reports] Failed to parse static analysis tools for ${report.id}:`, parseError);
    staticAnalysisTools = [];
  }

  const transformed: any = {
    id: report.id || '',
    contractAddress: report.contract_address || '',
    auditStatus: report.audit_status || 'failed',
    findingsCount: report.findings_count || 0,
    severityBreakdown: {
      critical: report.critical_findings || 0,
      high: report.high_findings || 0,
      medium: report.medium_findings || 0,
      low: report.low_findings || 0
    },
    createdAt: report.created_at || new Date().toISOString(),
    updatedAt: report.updated_at || new Date().toISOString(),
    processingTimeMs: report.processing_time_ms || null,
    errorMessage: report.error_message || null,
    auditEngineVersion: report.audit_engine_version || null,
    staticAnalysisTools: staticAnalysisTools
  };

  if (includeContent && report.audit_status === 'completed') {
    transformed.reportData = {
      json: reportJson || {}, 
      markdown: report.report_markdown || ''
    };
  }

  if (includeSourceCode && report.contract_address) {
    try {
      const sourceCode = await getContractSource(report.contract_address);
      transformed.sourceCode = sourceCode;
    } catch (error) {
      console.warn(`[Reports] Failed to fetch source code for ${report.contract_address}:`, error);
      transformed.sourceCode = null;
    }
  }

  return transformed;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<ReportParams> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    if (!validateReportId(id)) {
      return NextResponse.json(
        { 
          error: 'Invalid report ID format',
          details: 'Report ID must be a valid UUID, cuid, or report ID format'
        },
        { status: 400 }
      );
    }

    const includeContent = searchParams.get('includeContent') !== 'false'; // Default to true
    const includeSourceCode = searchParams.get('includeSourceCode') === 'true'; // Default to false
    const format = searchParams.get('format') || 'json';

    if (!['json', 'markdown', 'both', 'full'].includes(format)) {
      return NextResponse.json(
        { 
          error: 'Invalid format parameter',
          details: 'Format must be one of: json, markdown, both, full'
        },
        { status: 400 }
      );
    }

    console.log(`[Reports] Fetching report ${id}, includeContent: ${includeContent}, includeSourceCode: ${includeSourceCode}, format: ${format}`);

    const report = await getAuditReportById(id);
    
    console.log(`[Reports] Raw report data for ${id}:`, JSON.stringify(report, null, 2));

    if (!report) {
      return NextResponse.json(
        { 
          error: 'Report not found',
          details: `No audit report found with ID: ${id}`
        },
        { status: 404 }
      );
    }

    if (format === 'markdown' && report.audit_status === 'completed' && report.report_markdown) {
      return new NextResponse(report.report_markdown, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="audit-report-${report.contract_address.slice(-8)}-${new Date(report.created_at).toISOString().split('T')[0]}.md"`,
          'Cache-Control': 'public, max-age=3600' // 1 hour cache for completed reports
        }
      });
    }

    const response = await transformReportForResponse(report, includeContent, includeSourceCode);

    const cacheMaxAge = report.audit_status === 'completed' ? 3600 : 60; // 1 hour for completed, 1 minute for others
    const headers = {
      'Cache-Control': `public, max-age=${cacheMaxAge}`,
      'Content-Type': 'application/json'
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('[Reports] Error fetching report:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error occurred while fetching report',
        type: 'report_fetch_error',
        reportId: (await params).id,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export type { ReportParams, ReportQuery };