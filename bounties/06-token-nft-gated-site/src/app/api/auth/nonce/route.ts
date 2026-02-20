import { NextResponse } from 'next/server';
import { generateNonce } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = await checkRateLimit(`nonce:${ip}`);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  const nonce = generateNonce();
  return NextResponse.json({ nonce });
}
