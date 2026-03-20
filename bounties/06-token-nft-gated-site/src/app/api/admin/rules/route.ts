// CRUD for rules
import { NextRequest, NextResponse } from 'next/server'
import { getRules, saveRules } from '../../../../lib/rules-storage'
import { GatingRule } from '../../../../lib/gating'

export async function GET() {
  const rules = await getRules()
  return NextResponse.json({ rules })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const rules = await getRules()
  const newRule: GatingRule = {
    id: String(Date.now()),
    name: body.name || 'New Rule',
    type: body.type || 'erc20',
    contractAddress: body.contractAddress || '',
    threshold: body.threshold || 1,
    tokenId: body.tokenId,
    enabled: body.enabled !== false,
  }
  rules.push(newRule)
  await saveRules(rules)
  return NextResponse.json({ rule: newRule })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const rules = await getRules()
  const idx = rules.findIndex(r => r.id === body.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  rules[idx] = { ...rules[idx], ...body }
  await saveRules(rules)
  return NextResponse.json({ rule: rules[idx] })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  let rules = await getRules()
  rules = rules.filter(r => r.id !== id)
  await saveRules(rules)
  return NextResponse.json({ success: true })
}
