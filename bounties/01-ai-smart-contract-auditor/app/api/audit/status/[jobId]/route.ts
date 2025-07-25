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
        { error: `Audit job with ID '${jobId}' was not found. Please check the Job ID and try again.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      address: job.address,
      ...(job.errorMessage && { errorMessage: job.errorMessage }),
      ...(job.status === 'completed' && { reportUrl: `/api/audit/report/${jobId}` })
    });
  } catch (error) {
    console.error(`Error fetching audit status for job ${jobId}:`, error);
    
    return NextResponse.json(
      { error: 'Failed to retrieve audit status. Please try again later.' },
      { status: 500 }
    );
  }
}