import { NextRequest, NextResponse } from 'next/server';
import { getAuditStatus } from '@/lib/analysisEngine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

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
        { error: `Audit job with ID '${jobId}' was not found` },
        { status: 404 }
      );
    }

    if (job.status !== 'completed') {
      return NextResponse.json(
        { error: `Audit is not completed yet. Current status: ${job.status}` },
        { status: 400 }
      );
    }

    if (!job.reports) {
      return NextResponse.json(
        { error: 'Audit report is not available. The audit may have failed to generate a report.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      json: job.reports.json,
      markdown: job.reports.markdown,
      jobId: job.id,
      address: job.address,
      completedAt: job.createdAt
    });
  } catch (error) {
    console.error(`Error fetching audit report for job ${jobId}:`, error);
    
    return NextResponse.json(
      { error: 'Failed to retrieve audit report. Please try again later.' },
      { status: 500 }
    );
  }
}