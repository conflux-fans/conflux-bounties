// Simple file-based rules storage
import { promises as fs } from 'fs'
import path from 'path'
import { GatingRule } from './gating'

const RULES_FILE = path.join(process.cwd(), 'src', 'data', 'rules.json')

const defaultRules: GatingRule[] = [
  { id: '1', name: 'CFX Holder (min 1 CFX)', type: 'erc20', contractAddress: '0x0000000000000000000000000000000000000000', threshold: 1, enabled: true },
]

export async function getRules(): Promise<GatingRule[]> {
  try {
    const data = await fs.readFile(RULES_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    await fs.writeFile(RULES_FILE, JSON.stringify(defaultRules, null, 2))
    return defaultRules
  }
}

export async function saveRules(rules: GatingRule[]): Promise<void> {
  await fs.writeFile(RULES_FILE, JSON.stringify(rules, null, 2))
}

export async function getEnabledRules(): Promise<GatingRule[]> {
  return (await getRules()).filter(r => r.enabled)
}
