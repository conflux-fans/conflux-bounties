'use client'
import { useState, useEffect } from 'react'

interface Rule { id: string; name: string; type: string; contractAddress: string; threshold: number; tokenId?: number; enabled: boolean }

export default function Admin() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', type: 'erc20', contractAddress: '', threshold: 1 })

  useEffect(() => { fetch('/api/admin/rules').then(r => r.json()).then(d => { setRules(d.rules || []); setLoading(false) }) }, [])

  const addRule = async () => {
    await fetch('/api/admin/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setForm({ name: '', type: 'erc20', contractAddress: '', threshold: 1 })
    const d = await (await fetch('/api/admin/rules')).json()
    setRules(d.rules)
  }

  const toggleRule = async (rule: Rule) => {
    await fetch('/api/admin/rules', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...rule, enabled: !rule.enabled }) })
    const d = await (await fetch('/api/admin/rules')).json()
    setRules(d.rules)
  }

  const deleteRule = async (id: string) => {
    await fetch(`/api/admin/rules?id=${id}`, { method: 'DELETE' })
    const d = await (await fetch('/api/admin/rules')).json()
    setRules(d.rules)
  }

  if (loading) return <div className="text-center py-20">Loading...</div>

  return (
    <div className="max-w-3xl mx-auto py-10">
      <h2 className="text-3xl font-bold mb-6">⚙️ Admin Console</h2>
      {/* Add Rule Form */}
      <div className="bg-slate-800 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-bold mb-4">Add Gating Rule</h3>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Rule Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-slate-700 px-3 py-2 rounded col-span-2" />
          <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="bg-slate-700 px-3 py-2 rounded">
            <option value="erc20">ERC20</option><option value="erc721">ERC721</option><option value="erc1155">ERC1155</option>
          </select>
          <input placeholder="Contract Address" value={form.contractAddress} onChange={e => setForm({...form, contractAddress: e.target.value})} className="bg-slate-700 px-3 py-2 rounded" />
          <input type="number" placeholder="Threshold" value={form.threshold} onChange={e => setForm({...form, threshold: Number(e.target.value)})} className="bg-slate-700 px-3 py-2 rounded" />
          <button onClick={addRule} className="bg-cyan-600 px-4 py-2 rounded hover:bg-cyan-500 col-span-2">Add Rule</button>
        </div>
      </div>
      {/* Rules Table */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-4">Active Rules ({rules.length})</h3>
        <div className="space-y-3">
          {rules.map(rule => (
            <div key={rule.id} className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div>
                <p className="font-mono text-sm">{rule.name}</p>
                <p className="text-xs text-slate-400">{rule.type} | {rule.contractAddress.slice(0,10)}... | threshold: {rule.threshold}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggleRule(rule)} className={`px-2 py-1 rounded text-xs ${rule.enabled ? 'bg-green-600' : 'bg-slate-600'}`}>{rule.enabled ? 'ON' : 'OFF'}</button>
                <button onClick={() => deleteRule(rule.id)} className="px-2 py-1 rounded text-xs bg-red-600">DEL</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
