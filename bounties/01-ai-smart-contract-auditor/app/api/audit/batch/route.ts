import { NextRequest, NextResponse } from 'next/server';
import { runAudit, Report } from '@/lib/analysisEngine';

interface BatchAuditRequest {
  addresses: string[];
  options?: {
    maxConcurrency?: number;
    includeResults?: boolean;
  };
}

interface BatchAuditJob {
  id: string;
  address: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  report?: Report;
  error?: string;
}

interface BatchAuditResponse {
  batchId: string;
  jobIds: string[];
  status: 'started';
  totalJobs: number;
  timestamp: string;
}

interface BatchAuditResults {
  batchId: string;
  status: 'completed' | 'partial' | 'failed';
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  results: BatchAuditJob[];
  summary: {
    totalFindings: number;
    averageFindings: number;
    severityDistribution: Record<string, number>;
    processingTime: number;
  };
}

const batchJobs = new Map<string, BatchAuditJob[]>();
const batchStatus = new Map<string, { status: string; startTime: Date; endTime?: Date }>();

function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateJobId(address: string): string {
  return `job_${address.slice(-8)}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

function validateAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  
  const trimmed = address.trim();
  if (trimmed.length < 10) return false;
  
  return trimmed.startsWith('cfx:') || trimmed.startsWith('0x');
}

async function processAuditsWithConcurrency(
  jobs: BatchAuditJob[], 
  maxConcurrency: number = 5
): Promise<void> {
  const semaphore = new Array(maxConcurrency).fill(null);
  let index = 0;
  
  const processJob = async (job: BatchAuditJob): Promise<void> => {
    try {
      console.log(`[BatchAudit] Starting audit for ${job.address} (Job: ${job.id})`);
      job.status = 'processing';
      
      const report = await runAudit(job.address);
      
      job.status = 'completed';
      job.report = report;
      job.endTime = new Date();
      
      console.log(`[BatchAudit] Completed audit for ${job.address} with ${report.findings.length} findings`);
      
    } catch (error) {
      console.error(`[BatchAudit] Failed audit for ${job.address}:`, error);
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.endTime = new Date();
    }
  };

  const workers = semaphore.map(async () => {
    while (index < jobs.length) {
      const jobIndex = index++;
      if (jobIndex < jobs.length) {
        await processJob(jobs[jobIndex]);
      }
    }
  });

  await Promise.all(workers);
}

function calculateBatchSummary(jobs: BatchAuditJob[]): BatchAuditResults['summary'] {
  const completedJobs = jobs.filter(job => job.status === 'completed' && job.report);
  const allFindings = completedJobs.flatMap(job => job.report?.findings || []);
  
  const severityDistribution = allFindings.reduce((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const totalProcessingTime = jobs.reduce((acc, job) => {
    if (job.startTime && job.endTime) {
      return acc + (job.endTime.getTime() - job.startTime.getTime());
    }
    return acc;
  }, 0);

  return {
    totalFindings: allFindings.length,
    averageFindings: completedJobs.length > 0 ? allFindings.length / completedJobs.length : 0,
    severityDistribution,
    processingTime: totalProcessingTime
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: BatchAuditRequest = await request.json();
    const { addresses, options = {} } = body;
    const { maxConcurrency = 5, includeResults = false } = options;

    if (!addresses || !Array.isArray(addresses)) {
      return NextResponse.json(
        { error: 'addresses must be a non-empty array' },
        { status: 400 }
      );
    }

    if (addresses.length === 0) {
      return NextResponse.json(
        { error: 'At least one address is required' },
        { status: 400 }
      );
    }

    if (addresses.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 addresses allowed per batch' },
        { status: 400 }
      );
    }

    if (maxConcurrency < 1 || maxConcurrency > 10) {
      return NextResponse.json(
        { error: 'maxConcurrency must be between 1 and 10' },
        { status: 400 }
      );
    }

    const validAddresses = new Set<string>();
    const invalidAddresses: string[] = [];

    for (const address of addresses) {
      if (validateAddress(address)) {
        validAddresses.add(address.trim());
      } else {
        invalidAddresses.push(address);
      }
    }

    if (invalidAddresses.length > 0) {
      return NextResponse.json(
        { 
          error: 'Invalid addresses found',
          invalidAddresses,
          details: 'Addresses must start with "cfx:" or "0x" and be at least 10 characters long'
        },
        { status: 400 }
      );
    }

    if (validAddresses.size === 0) {
      return NextResponse.json(
        { error: 'No valid addresses provided' },
        { status: 400 }
      );
    }

    const batchId = generateBatchId();
    const jobs: BatchAuditJob[] = Array.from(validAddresses).map(address => ({
      id: generateJobId(address),
      address,
      status: 'pending' as const,
      startTime: new Date()
    }));

    batchJobs.set(batchId, jobs);
    batchStatus.set(batchId, {
      status: 'processing',
      startTime: new Date()
    });

    console.log(`[BatchAudit] Starting batch ${batchId} with ${jobs.length} jobs (concurrency: ${maxConcurrency})`);

    processAuditsWithConcurrency(jobs, maxConcurrency)
      .then(() => {
        const status = batchStatus.get(batchId);
        if (status) {
          status.status = 'completed';
          status.endTime = new Date();
          batchStatus.set(batchId, status);
        }
        console.log(`[BatchAudit] Batch ${batchId} completed`);
      })
      .catch((error) => {
        console.error(`[BatchAudit] Batch ${batchId} failed:`, error);
        const status = batchStatus.get(batchId);
        if (status) {
          status.status = 'failed';
          status.endTime = new Date();
          batchStatus.set(batchId, status);
        }
      });

    const response: BatchAuditResponse = {
      batchId,
      jobIds: jobs.map(job => job.id),
      status: 'started',
      totalJobs: jobs.length,
      timestamp: new Date().toISOString()
    };

    if (includeResults) {
      const timeout = 30 * 60 * 1000;
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeout) {
        const allCompleted = jobs.every(job => 
          job.status === 'completed' || job.status === 'failed'
        );
        
        if (allCompleted) break;
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const completedJobs = jobs.filter(job => job.status === 'completed').length;
      const failedJobs = jobs.filter(job => job.status === 'failed').length;

      const results: BatchAuditResults = {
        batchId,
        status: failedJobs === 0 ? 'completed' : completedJobs > 0 ? 'partial' : 'failed',
        totalJobs: jobs.length,
        completedJobs,
        failedJobs,
        results: jobs,
        summary: calculateBatchSummary(jobs)
      };

      return NextResponse.json(results);
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in batch audit:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error occurred during batch audit',
        type: 'batch_audit_error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get('batchId');

  if (!batchId) {
    return NextResponse.json(
      { error: 'batchId query parameter is required' },
      { status: 400 }
    );
  }

  const jobs = batchJobs.get(batchId);
  const status = batchStatus.get(batchId);

  if (!jobs || !status) {
    return NextResponse.json(
      { error: `Batch ${batchId} not found` },
      { status: 404 }
    );
  }

  const completedJobs = jobs.filter(job => job.status === 'completed').length;
  const failedJobs = jobs.filter(job => job.status === 'failed').length;
  const processingJobs = jobs.filter(job => job.status === 'processing').length;

  const results: BatchAuditResults = {
    batchId,
    status: status.status === 'completed' 
      ? (failedJobs === 0 ? 'completed' : completedJobs > 0 ? 'partial' : 'failed')
      : 'processing' as any,
    totalJobs: jobs.length,
    completedJobs,
    failedJobs,
    results: jobs,
    summary: calculateBatchSummary(jobs)
  };

  return NextResponse.json(results);
}

export type { BatchAuditRequest, BatchAuditResponse, BatchAuditResults, BatchAuditJob };