import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'conflux-gated-secret-key-2024')

// Simple rate limiter per IP
const limits = new Map<string, { count: number; reset: number }>()
function rateLimit(ip: string): boolean {
  const now = Date.now()
  const e = limits.get(ip)
  if (!e || now > e.reset) { limits.set(ip, { count: 1, reset: now + 60000 }); return true }
  if (e.count > 30) return false
  e.count++
  return true
}

export async function middleware(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  // Only protect /protected routes
  if (!request.nextUrl.pathname.startsWith('/protected')) return NextResponse.next()

  const token = request.cookies.get('gated-token')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/?error=login_required', request.url))
  }

  try {
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/?error=session_expired', request.url))
  }
}

export const config = { matcher: ['/protected/:path*', '/api/gating/:path*'] }
