'use client';

import { useState } from 'react';

interface RuleFormData {
  name: string;
  description: string;
  contractAddress: string;
  contractType: 'ERC20' | 'ERC721' | 'ERC1155';
  chainId: number;
  minBalance: string;
  tokenId: string;
  logic: 'ALL' | 'ANY';
}

const defaultForm: RuleFormData = {
  name: '',
  description: '',
  contractAddress: '',
  contractType: 'ERC20',
  chainId: 1030,
  minBalance: '1',
  tokenId: '',
  logic: 'ALL',
};

interface Props {
  initial?: Partial<RuleFormData> & { id?: string };
  onSaved?: () => void;
}

export function GatingRuleForm({ initial, onSaved }: Props) {
  const [form, setForm] = useState<RuleFormData>({ ...defaultForm, ...initial });
  const [saving, setSaving] = useState(false);

  const isEdit = !!initial?.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const method = isEdit ? 'PUT' : 'POST';
    const body = isEdit ? { ...form, id: initial!.id } : form;

    await fetch('/api/rules', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    onSaved?.();
  }

  function update<K extends keyof RuleFormData>(key: K, value: RuleFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const inputClass = 'w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white text-sm';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-gray-900 p-6">
      <h3 className="text-lg font-semibold text-white">{isEdit ? 'Edit Rule' : 'New Gating Rule'}</h3>

      <input className={inputClass} placeholder="Rule name" value={form.name} onChange={(e) => update('name', e.target.value)} required />
      <input className={inputClass} placeholder="Description (optional)" value={form.description} onChange={(e) => update('description', e.target.value)} />
      <input className={inputClass} placeholder="Contract address (0x…)" value={form.contractAddress} onChange={(e) => update('contractAddress', e.target.value)} required />

      <div className="grid grid-cols-2 gap-4">
        <select className={inputClass} value={form.contractType} onChange={(e) => update('contractType', e.target.value as RuleFormData['contractType'])}>
          <option value="ERC20">ERC20</option>
          <option value="ERC721">ERC721</option>
          <option value="ERC1155">ERC1155</option>
        </select>
        <select className={inputClass} value={form.chainId} onChange={(e) => update('chainId', Number(e.target.value))}>
          <option value={1030}>Mainnet (1030)</option>
          <option value={71}>Testnet (71)</option>
        </select>
      </div>

      <input className={inputClass} placeholder="Min balance" value={form.minBalance} onChange={(e) => update('minBalance', e.target.value)} />

      {form.contractType === 'ERC1155' && (
        <input className={inputClass} placeholder="Token ID (ERC1155)" value={form.tokenId} onChange={(e) => update('tokenId', e.target.value)} />
      )}

      <select className={inputClass} value={form.logic} onChange={(e) => update('logic', e.target.value as 'ALL' | 'ANY')}>
        <option value="ALL">ALL rules must pass</option>
        <option value="ANY">ANY rule can pass</option>
      </select>

      <button type="submit" disabled={saving} className="rounded bg-conflux-accent px-4 py-2 text-black font-medium hover:opacity-90 disabled:opacity-50">
        {saving ? 'Saving…' : isEdit ? 'Update Rule' : 'Create Rule'}
      </button>
    </form>
  );
}
