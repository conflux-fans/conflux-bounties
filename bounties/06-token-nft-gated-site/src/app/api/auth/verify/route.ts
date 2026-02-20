import { NextResponse } from 'next/server';
import { parseSiwcMessage, verifySiwcSignature } from '@/lib/auth';
import { createSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = await checkRateLimit(`verify:${ip}`);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  const body = await request.json();
  const { message, signature, address } = body as {
    message: string;
    signature: string;
    address: string;
  };

  if (!message || !signature || !address) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Parse and validate message
  const parsed = parseSiwcMessage(message);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid SIWC message' }, { status: 400 });
  }

  if (parsed.address.toLowerCase() !== address.toLowerCase()) {
    return NextResponse.json({ error: 'Address mismatch' }, { status: 400 });
  }

  // Check message freshness (5 min)
  const issuedAt = new Date(parsed.issuedAt);
  if (Date.now() - issuedAt.getTime() > 5 * 60 * 1000) {
    return NextResponse.json({ error: 'Message expired' }, { status: 400 });
  }

  // Verify signature
  const valid = await verifySiwcSignature(message, signature as `0x${string}`, address);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Store session in DB
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      address: parsed.address,
      chainId: parsed.chainId,
      nonce: parsed.nonce,
      issuedAt,
      expiresAt,
    },
  });

  // Create cookie session
  await createSession({ address: parsed.address, chainId: parsed.chainId });

  // Log access
  await prisma.accessLog.create({
    data: {
      address: parsed.address,
      path: '/api/auth/verify',
      granted: true,
      reason: 'SIWC login successful',
      ipAddress: ip,
    },
  });

  return NextResponse.json({ success: true, address: parsed.address });
}
