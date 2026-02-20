import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { evaluateRules } from '@/lib/gating';
import { getSignedUrl } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Check gating rules
  const rules = await prisma.gatingRule.findMany({ where: { isActive: true } });

  if (rules.length > 0) {
    const logic = (rules[0]?.logic as 'ALL' | 'ANY') ?? 'ALL';
    const { granted, results } = await evaluateRules(session.address, rules, logic);

    await prisma.accessLog.create({
      data: {
        address: session.address,
        path: `/api/files/${params.id}`,
        granted,
        reason: granted ? 'Rules passed' : `Failed: ${results.filter((r) => !r.passed).map((r) => r.contractAddress).join(', ')}`,
        ipAddress: ip,
        ruleId: rules[0]?.id,
      },
    });

    if (!granted) {
      return NextResponse.json({ error: 'Access denied — token requirements not met' }, { status: 403 });
    }
  }

  // Generate signed URL from Supabase storage
  const signedUrl = await getSignedUrl(`${params.id}`);

  if (signedUrl) {
    return NextResponse.redirect(signedUrl);
  }

  // Fallback: return placeholder if Supabase is not configured
  await prisma.accessLog.create({
    data: {
      address: session.address,
      path: `/api/files/${params.id}`,
      granted: true,
      reason: 'File served (demo mode)',
      ipAddress: ip,
    },
  });

  return NextResponse.json({
    message: 'File access granted',
    fileId: params.id,
    note: 'Configure SUPABASE_URL and SUPABASE_SERVICE_KEY for actual file storage.',
  });
}
