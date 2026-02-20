'use client';

import { useEffect, useState } from 'react';
import { GatingRuleForm } from '@/components/GatingRuleForm';

interface Rule {
  id: string;
  name: string;
  contractAddress: string;
  contractType: string;
  chainId: number;
  minBalance: string;
  tokenId: string | null;
  logic: string;
  isActive: boolean;
}

export default function AdminPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [showForm, setShowForm] = useState(false);

  async function loadRules() {
    const res = await fetch('/api/rules');
    const data = await res.json();
    setRules(data.rules ?? []);
  }

  useEffect(() => { loadRules(); }, []);

  async function deleteRule(id: string) {
    await fetch('/api/rules', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    loadRules();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin — Gating Rules</h1>
        <div className="flex gap-3">
          <a href="/admin/logs" className="rounded border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:text-white">
            View Logs
          </a>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded bg-conflux-accent px-4 py-2 text-sm font-medium text-black"
          >
            {showForm ? 'Cancel' : '+ New Rule'}
          </button>
        </div>
      </div>

      {showForm && (
        <GatingRuleForm onSaved={() => { setShowForm(false); loadRules(); }} />
      )}

      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between rounded-lg border border-gray-700 p-4">
            <div>
              <p className="font-medium">{rule.name}</p>
              <p className="text-sm text-gray-500">
                {rule.contractType} · Chain {rule.chainId} · Min: {rule.minBalance}
                {rule.tokenId ? ` · Token #${rule.tokenId}` : ''}
              </p>
              <p className="text-xs text-gray-600 font-mono">{rule.contractAddress}</p>
            </div>
            <div className="flex gap-2">
              <span className={`text-xs px-2 py-1 rounded ${rule.isActive ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
                {rule.isActive ? 'Active' : 'Inactive'}
              </span>
              <button onClick={() => deleteRule(rule.id)} className="text-red-400 text-sm hover:text-red-300">
                Delete
              </button>
            </div>
          </div>
        ))}
        {rules.length === 0 && <p className="text-gray-500">No rules configured yet.</p>}
      </div>
    </div>
  );
}
