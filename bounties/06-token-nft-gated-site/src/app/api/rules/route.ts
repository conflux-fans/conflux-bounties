import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

async function requireAdmin() {
  const session = await getSession();
  // In production, check session.isAdmin. For boilerplate, admin pages are env-gated.
  return !!session;
}

export async function GET() {
  const rules = await prisma.gatingRule.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const body = await request.json();
  const rule = await prisma.gatingRule.create({
    data: {
      name: body.name,
      description: body.description || null,
      contractAddress: body.contractAddress,
      contractType: body.contractType,
      chainId: body.chainId,
      minBalance: body.minBalance ?? '1',
      tokenId: body.tokenId || null,
      logic: body.logic ?? 'ALL',
    },
  });
  return NextResponse.json({ rule }, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { id, ...data } = body;
  const rule = await prisma.gatingRule.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || null,
      contractAddress: data.contractAddress,
      contractType: data.contractType,
      chainId: data.chainId,
      minBalance: data.minBalance ?? '1',
      tokenId: data.tokenId || null,
      logic: data.logic ?? 'ALL',
      isActive: data.isActive ?? true,
    },
  });
  return NextResponse.json({ rule });
}

export async function DELETE(request: Request) {
  const body = await request.json();
  await prisma.gatingRule.delete({ where: { id: body.id } });
  return NextResponse.json({ success: true });
}
