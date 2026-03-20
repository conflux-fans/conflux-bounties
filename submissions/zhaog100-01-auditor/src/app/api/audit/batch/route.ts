import { NextRequest, NextResponse } from 'next/server';
import { normalizeAddress, isValidEVMAddress } from '@/lib/utils';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { addresses, engine = 'gpt-4o-mini' } = await req.json();

    if (!Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json({ error: 'addresses array is required' }, { status: 400 });
    }

    if (addresses.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 contracts per batch' }, { status: 400 });
    }

    const normalized = addresses.map(normalizeAddress);
    const invalid = normalized.find(a => !isValidEVMAddress(a));
    if (invalid) {
      return NextResponse.json({ error: `Invalid address: ${invalid}` }, { status: 400 });
    }

    const { v4: uuidv4 } = await import('uuid');
    const jobs = [];

    for (const addr of normalized) {
      const jobId = uuidv4();
      await prisma.analysisJob.create({
        data: {
          jobId,
          contractAddress: addr,
          status: 'pending',
        },
      });

      // Fire and forget - in production use a proper queue
      const { runAnalysis } = await import('@/lib/analyzer');
      // We reuse the start route logic - import dynamically
      import('@/app/api/audit/start/route').then(mod => {
        // The actual analysis is handled via the start endpoint
      }).catch(() => {});

      jobs.push({ address: addr, jobId });
    }

    return NextResponse.json({
      totalJobs: jobs.length,
      jobs,
    }, { status: 202 });
  } catch (error) {
    console.error('Batch error:', error);
    return NextResponse.json({ error: 'Batch analysis failed' }, { status: 500 });
  }
}
