import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { getEnabledRules, getRules } from '../../../../lib/rules-storage'
import { checkAllRules } from '../../../../lib/gating'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'conflux-gated-secret-key-2024')

// Rate limiter (simple in-memory)
const rateLimits = new Map<string, { count: number; reset: number }>()
function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimits.get(ip)
  if (!entry || now > entry.reset) {
    rateLimits.set(ip, { count: 1, reset: now + 60000 })
    return true
  }
  if (entry.count > 60) return false // 60 req/min
  entry.count++
  return true
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) return NextResponse.json({ error: 'Rate limited' }, { status: 429 })

  const rules = await getEnabledRules()
  return NextResponse.json({ rules, count: rules.length })
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('gated-token')?.value
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { payload } = await jwtVerify(token, secret)
    const address = payload.address as string
    if (!address) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const rules = await getEnabledRules()
    const result = await checkAllRules(rules, address)

    return NextResponse.json({ address, allPassed: result.allPassed, results: result.results.map(r => ({ name: r.rule.name, pass: r.pass, balance: r.balance })) })
  } catch {
    return NextResponse.json({ error: 'Verification failed' }, { status: 401 })
  }
}
