import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isCuid, isUUID } from '@/lib/utils';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  if (!isUUID(jobId) && !isCuid(jobId)) {
    return NextResponse.json({ error: 'Invalid job ID format' }, { status: 400 });
  }

  const job = await prisma.analysisJob.findUnique({
    where: { jobId },
    include: {
      report: {
        include: {
          contract: true,
        },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    contractAddress: job.contractAddress,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() || null,
    errorMessage: job.errorMessage || null,
    reportId: job.reportId || null,
  });
}
