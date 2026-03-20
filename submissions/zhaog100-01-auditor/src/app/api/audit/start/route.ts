import { NextRequest, NextResponse } from 'next/server';
import { normalizeAddress, isValidEVMAddress } from '@/lib/utils';
import { fetchContractSource } from '@/lib/confluxscan';
import { analyzeContractWithLLM, computeSummary } from '@/lib/analyzer';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import type { AuditReport, AuditFinding } from '@/types/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, engine = 'gpt-4o-mini' } = body;

    if (!address) {
      return NextResponse.json({ error: 'Contract address is required' }, { status: 400 });
    }

    const normalized = normalizeAddress(address);
    if (!isValidEVMAddress(normalized)) {
      return NextResponse.json({ error: 'Invalid eSpace address format. Use 0x...' }, { status: 400 });
    }

    const jobId = uuidv4();

    // Create job record
    const job = await prisma.analysisJob.create({
      data: {
        jobId,
        contractAddress: normalized,
        status: 'pending',
      },
    });

    // Start analysis asynchronously (fire and forget for demo; in production use a queue)
    runAnalysis(job.id, jobId, normalized, engine).catch(console.error);

    return NextResponse.json({
      jobId,
      status: 'pending',
      message: 'Analysis started',
    }, { status: 202 });
  } catch (error) {
    console.error('Audit start error:', error);
    return NextResponse.json(
      { error: 'Failed to start analysis' },
      { status: 500 },
    );
  }
}

async function runAnalysis(
  jobId: number,
  jobIdStr: string,
  address: string,
  engine: string,
) {
  const startTime = Date.now();
  try {
    await prisma.analysisJob.update({ where: { id: jobId }, data: { status: 'processing', progress: 10, startedAt: new Date() } });

    // Step 1: Fetch contract
    const contractSource = await fetchContractSource(address);
    await prisma.analysisJob.update({ where: { id: jobId }, data: { progress: 30 } });

    // Save contract
    await prisma.contract.upsert({
      where: { address },
      create: {
        address,
        name: contractSource.name,
        compilerVersion: contractSource.compilerVersion,
        sourceCode: contractSource.sourceCode,
        abi: contractSource.abi,
        verified: true,
      },
      update: {
        name: contractSource.name,
        compilerVersion: contractSource.compilerVersion,
        sourceCode: contractSource.sourceCode,
        abi: contractSource.abi,
        verified: true,
      },
    });

    // Step 2: AI Analysis
    await prisma.analysisJob.update({ where: { id: jobId }, data: { progress: 50 } });

    const { findings, gasOptimizations, codeQuality } = await analyzeContractWithLLM(
      contractSource.sourceCode,
      contractSource.name,
    );

    await prisma.analysisJob.update({ where: { id: jobId }, data: { progress: 80 } });

    // Step 3: Compute summary
    const summary = computeSummary(findings, gasOptimizations, codeQuality);

    // Step 4: Save report
    const contract = await prisma.contract.findUnique({ where: { address } });
    if (!contract) throw new Error('Contract not found after save');

    const severityScore = summary.criticalCount * 25 + summary.highCount * 10 + summary.mediumCount * 3;

    const report = await prisma.auditReport.create({
      data: {
        contractId: contract.id,
        analysisEngine: engine,
        findings: findings as any,
        summary: summary as any,
        severityScore,
        status: 'completed',
      },
    });

    // Save individual findings
    for (const f of [...findings, ...gasOptimizations, ...codeQuality]) {
      await prisma.finding.create({
        data: {
          auditReportId: report.id,
          category: f.category,
          severity: f.severity,
          swcId: f.swc || null,
          cweId: f.cwe || null,
          title: f.title,
          description: f.description,
          lineNumbers: f.lines,
          codeSnippet: f.codeSnippet || null,
          recommendation: f.recommendation || null,
        },
      });
    }

    const duration = Date.now() - startTime;

    await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        progress: 100,
        reportId: report.id,
        completedAt: new Date(),
      },
    });

    return { duration, reportId: report.id };
  } catch (error: any) {
    await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage: error.message || 'Analysis failed',
        completedAt: new Date(),
      },
    });
    throw error;
  }
}
