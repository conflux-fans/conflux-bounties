import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const logs = await prisma.accessLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { rule: { select: { name: true } } },
  });
  return NextResponse.json({ logs });
}
