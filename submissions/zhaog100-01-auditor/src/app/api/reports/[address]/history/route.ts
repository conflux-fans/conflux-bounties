import { NextRequest, NextResponse } from 'next/server';
import { normalizeAddress, isValidEVMAddress } from '@/lib/utils';
import prisma from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address: rawAddress } = await params;
  const address = normalizeAddress(rawAddress);

  if (!isValidEVMAddress(address)) {
    return NextResponse.json({ error: 'Invalid address format' }, { status: 400 });
  }

  const contract = await prisma.contract.findUnique({
    where: { address },
    include: {
      auditReports: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!contract) {
    return NextResponse.json({ error: 'No audit history found' }, { status: 404 });
  }

  return NextResponse.json({
    address: contract.address,
    name: contract.name,
    reports: contract.auditReports.map(r => ({
      id: r.id,
      engine: r.analysisEngine,
      summary: r.summary,
      severityScore: r.severityScore,
      status: r.status,
      createdAt: r.createdAt,
    })),
  });
}
