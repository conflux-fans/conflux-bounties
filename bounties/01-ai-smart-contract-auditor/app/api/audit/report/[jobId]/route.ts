import { NextRequest, NextResponse } from 'next/server';
import { getAuditStatus } from '../../../../lib/analysisEngine';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { jobId } = params;

  if (!jobId) {
    return NextResponse.json(
      { error: 'Job ID is required' },
      { status: 400 }
    );
  }

  try {
    const job = await getAuditStatus(jobId);
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (!job.reports) {
      return NextResponse.json(
        { error: 'Report not available' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      json: job.reports.json,
      markdown: job.reports.markdown
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}