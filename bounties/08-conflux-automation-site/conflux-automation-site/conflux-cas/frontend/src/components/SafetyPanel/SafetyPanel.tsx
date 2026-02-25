'use client';

import type { SafetyConfig } from '@conflux-cas/shared';
import { useState } from 'react';

interface SafetyPanelProps {
  config: SafetyConfig;
  onUpdate?: (patch: Partial<SafetyConfig>) => Promise<void>;
}

export function SafetyPanel({ config, onUpdate }: SafetyPanelProps) {
  const [localConfig, setLocalConfig] = useState<SafetyConfig>(config);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!onUpdate) return;
    setSaving(true);
    try {
      await onUpdate(localConfig);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md space-y-5">
      <div className="rounded-xl border border-orange-800 bg-orange-950/40 p-4">
        <p className="text-orange-300 text-sm font-semibold">
          ⚠ Safety Controls
        </p>
        <p className="text-orange-200/60 text-xs mt-1">
          These limits are enforced off-chain by the execution worker before any
          transaction is submitted.
        </p>
      </div>

      {/* Global Pause */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Global Pause</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Immediately halts all job execution
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setLocalConfig((c) => ({ ...c, globalPause: !c.globalPause }))
          }
          className={`relative w-12 h-6 rounded-full transition-colors ${
            localConfig.globalPause ? 'bg-red-600' : 'bg-slate-600'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              localConfig.globalPause ? 'translate-x-6' : ''
            }`}
          />
        </button>
      </div>

      {/* Max Swap USD */}
      <div>
        <label
          htmlFor="safety-max-swap-usd"
          className="block text-sm text-slate-400 mb-1"
        >
          Max Swap Value (USD): ${localConfig.maxSwapUsd.toLocaleString()}
        </label>
        <input
          id="safety-max-swap-usd"
          type="range"
          min="100"
          max="100000"
          step="100"
          value={localConfig.maxSwapUsd}
          onChange={(e) =>
            setLocalConfig((c) => ({
              ...c,
              maxSwapUsd: parseInt(e.target.value, 10),
            }))
          }
          className="w-full accent-orange-500"
        />
      </div>

      {/* Max Slippage */}
      <div>
        <label
          htmlFor="safety-max-slippage"
          className="block text-sm text-slate-400 mb-1"
        >
          Max Slippage: {(localConfig.maxSlippageBps / 100).toFixed(1)}%
        </label>
        <input
          id="safety-max-slippage"
          type="range"
          min="10"
          max="500"
          step="10"
          value={localConfig.maxSlippageBps}
          onChange={(e) =>
            setLocalConfig((c) => ({
              ...c,
              maxSlippageBps: parseInt(e.target.value, 10),
            }))
          }
          className="w-full accent-orange-500"
        />
      </div>

      {/* Max Retries */}
      <div>
        <label
          htmlFor="safety-max-retries"
          className="block text-sm text-slate-400 mb-1"
        >
          Max Retries: {localConfig.maxRetries}
        </label>
        <input
          id="safety-max-retries"
          type="range"
          min="1"
          max="20"
          value={localConfig.maxRetries}
          onChange={(e) =>
            setLocalConfig((c) => ({
              ...c,
              maxRetries: parseInt(e.target.value, 10),
            }))
          }
          className="w-full accent-orange-500"
        />
      </div>

      {onUpdate && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2 rounded-xl transition-colors"
        >
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Safety Settings'}
        </button>
      )}
    </div>
  );
}
