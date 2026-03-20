import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'conflux-gated-secret-key-2024')

export async function POST(req: NextRequest) {
  try {
    const { address, message, signature } = await req.json()
    if (!address || !message || !signature) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Verify signature (SIWE-style)
    const { ethers } = await import('ethers')
    try {
      const recovered = ethers.verifyMessage(message, signature)
      if (recovered.toLowerCase() !== address.toLowerCase()) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } catch {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 })
    }

    // Create JWT
    const token = await new SignJWT({ address, role: 'user' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret)

    const res = NextResponse.json({ success: true, address })
    res.cookies.set('gated-token', token, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 86400 })
    return res
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
