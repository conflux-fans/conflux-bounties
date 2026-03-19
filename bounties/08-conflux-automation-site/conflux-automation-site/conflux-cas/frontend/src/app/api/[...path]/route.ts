/**
 * Catch-all API proxy: /api/** → backend on BACKEND_URL (default: localhost:3001)
 *
 * This replaces the next.config.cjs rewrites()-based proxy which is unreliable
 * in Next.js 14 App Router dev mode when the path starts with /api/*.
 */

import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001';

async function proxy(
  req: NextRequest,
  { params }: { params: { path: string[] } }
): Promise<NextResponse> {
  const backendPath = params.path.join('/');
  const { search } = new URL(req.url);
  const backendUrl = `${BACKEND_URL}/${backendPath}${search}`;

  // Forward the body for methods that carry one
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(backendUrl, {
      method: req.method,
      headers: req.headers,
      body: hasBody ? await req.blob() : undefined,
      // @ts-expect-error – Node.js fetch supports duplex but the type lib doesn't know
      duplex: 'half',
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Backend unreachable', detail: String(err) },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers(upstream.headers);
  // Strip hop-by-hop headers that shouldn't be forwarded
  responseHeaders.delete('transfer-encoding');

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
