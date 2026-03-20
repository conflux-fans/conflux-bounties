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
          findingRecords: true,
        },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (job.status !== 'completed' || !job.report) {
    return NextResponse.json({ error: 'Report not yet available', status: job.status }, { status: 202 });
  }

  const report = job.report;
  const contract = report.contract;

  return NextResponse.json({
    contract: {
      address: contract.address,
      name: contract.name,
      compiler: contract.compilerVersion,
    },
    analysis: {
      engine: report.analysisEngine,
      timestamp: report.createdAt.toISOString(),
    },
    summary: report.summary,
    findings: report.findings,
    gasOptimizations: report.findingRecords
      ?.filter(f => f.category === 'gas')
      .map(f => ({
        id: `F${f.id}`,
        category: f.category,
        severity: f.severity,
        swc: f.swcId,
        cwe: f.cweId,
        title: f.title,
        description: f.description,
        lines: f.lineNumbers,
        codeSnippet: f.codeSnippet,
        recommendation: f.recommendation,
      })),
    codeQuality: report.findingRecords
      ?.filter(f => f.category === 'quality')
      .map(f => ({
        id: `F${f.id}`,
        category: f.category,
        severity: f.severity,
        swc: f.swcId,
        cwe: f.cweId,
        title: f.title,
        description: f.description,
        lines: f.lineNumbers,
        codeSnippet: f.codeSnippet,
        recommendation: f.recommendation,
      })),
  });
}
