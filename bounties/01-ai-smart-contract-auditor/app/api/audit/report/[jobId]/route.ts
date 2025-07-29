import { NextRequest, NextResponse } from 'next/server';
import { getAuditReportById } from '@/lib/database';

interface AuditReportParams {
  jobId: string;
}

function validateUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<AuditReportParams> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    if (!validateUUID(jobId)) {
      return NextResponse.json(
        { 
          error: 'Invalid job ID format',
          details: 'Job ID must be a valid UUID'
        },
        { status: 400 }
      );
    }

    console.log(`[AuditReport] Fetching report for job ID: ${jobId}`);

    const report = await getAuditReportById(jobId);

    if (!report) {
      console.log(`[AuditReport] Report not found for job ID: ${jobId}`);
      return NextResponse.json(
        { 
          error: 'Audit report not found',
          details: `No audit report found with job ID: ${jobId}`
        },
        { status: 404 }
      );
    }

    if (report.audit_status !== 'completed') {
      return NextResponse.json(
        { 
          error: 'Audit is not completed yet',
          details: `Current status: ${report.audit_status}`,
          status: report.audit_status,
          errorMessage: report.error_message
        },
        { status: 400 }
      );
    }

    if (!report.report_json || !report.report_markdown) {
      return NextResponse.json(
        { 
          error: 'Audit report data is not available',
          details: 'The audit completed but report content is missing'
        },
        { status: 404 }
      );
    }

    let reportJson;
    try {
      reportJson = typeof report.report_json === 'string' 
        ? JSON.parse(report.report_json) 
        : report.report_json;
    } catch (parseError) {
      console.error('[AuditReport] Failed to parse report JSON:', parseError);
      return NextResponse.json(
        { 
          error: 'Report data is corrupted',
          details: 'Failed to parse audit report JSON data'
        },
        { status: 500 }
      );
    }

    let staticAnalysisTools;
    try {
      staticAnalysisTools = typeof report.static_analysis_tools === 'string' 
        ? JSON.parse(report.static_analysis_tools) 
        : report.static_analysis_tools;
    } catch (parseError) {
      staticAnalysisTools = [];
    }

    const response = {
      json: reportJson,
      markdown: report.report_markdown,
      jobId: report.id,
      address: report.contract_address,
      completedAt: report.created_at,
      metadata: {
        findingsCount: report.findings_count,
        severityBreakdown: {
          critical: report.critical_findings,
          high: report.high_findings,
          medium: report.medium_findings,
          low: report.low_findings
        },
        processingTimeMs: report.processing_time_ms,
        auditEngineVersion: report.audit_engine_version,
        staticAnalysisTools: staticAnalysisTools
      }
    };

    const headers = {
      'Cache-Control': 'public, max-age=3600', 
      'Content-Type': 'application/json'
    };

    console.log(`[AuditReport] Successfully retrieved report for job ID: ${jobId}`);
    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('[AuditReport] Error fetching audit report:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error occurred while fetching audit report',
        type: 'audit_report_error',
        jobId: (await params).jobId,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export type { AuditReportParams };