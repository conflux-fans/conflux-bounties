'use client';

import { RefreshCcw, X } from 'lucide-react';
import { useState } from 'react';
import { parseUnits } from 'viem';
import { usePublicClient, useWriteContract } from 'wagmi';
import { CFX_NATIVE_ADDRESS, wcfxAddress } from '../../hooks/usePoolTokens';
import { useAuthContext } from '../../lib/auth-context';
import { WCFX_ABI } from '../../lib/contracts';
import { usePoolsContext } from '../../lib/pools-context';

function fmtBalance(val: string) {
  const n = parseFloat(val);
  if (Number.isNaN(n) || n === 0) return '0.00';
  if (n < 0.0001) return '<0.0001';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function WcfxWrapModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { address } = useAuthContext();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const { tokens, refresh } = usePoolsContext();

  const [wcfxPanelTab, setWcfxPanelTab] = useState<'wrap' | 'unwrap'>('wrap');
  const [wrapInput, setWrapInput] = useState('');
  const [unwrapInput, setUnwrapInput] = useState('');
  const [wrapping, setWrapping] = useState(false);
  const [wrapError, setWrapError] = useState<string | null>(null);
  const [wrapSuccess, setWrapSuccess] = useState<string | null>(null);

  if (!open) return null;

  // Resolve wCFX using the app's network selection (wcfxAddress() uses
  // NEXT_PUBLIC_NETWORK or sensible default) so the modal matches the
  // token list produced by `usePoolTokens`.
  const wcfxAddr = wcfxAddress();
  const wcfxInfo = tokens.find(
    (t) => t.address.toLowerCase() === wcfxAddr.toLowerCase()
  );
  const cfxInfo = tokens.find(
    (t) => t.address.toLowerCase() === CFX_NATIVE_ADDRESS.toLowerCase()
  );

  async function handleWrap() {
    setWrapError(null);
    setWrapSuccess(null);
    if (!address || !publicClient) return;
    setWrapping(true);
    try {
      const amount = parseUnits(wrapInput.trim() || '0', 18);
      if (amount <= 0n) {
        setWrapError('Enter an amount.');
        return;
      }
      const feeData = await publicClient.estimateFeesPerGas();
      const mfpg = (feeData.maxFeePerGas * 120n) / 100n;
      const mpfpg = (feeData.maxPriorityFeePerGas * 120n) / 100n;
      const gas = await publicClient.estimateContractGas({
        address: wcfxAddr as `0x${string}`,
        abi: WCFX_ABI,
        functionName: 'deposit',
        value: amount,
        account: address as `0x${string}`,
      });
      const hash = await writeContractAsync({
        address: wcfxAddr as `0x${string}`,
        abi: WCFX_ABI,
        functionName: 'deposit',
        value: amount,
        gas: (gas * 130n) / 100n,
        maxFeePerGas: mfpg,
        maxPriorityFeePerGas: mpfpg,
      });
      await publicClient.waitForTransactionReceipt({
        hash,
        pollingInterval: 2_000,
        timeout: 120_000,
      });
      setWrapSuccess(`${wrapInput} CFX wrapped to wCFX.`);
      setWrapInput('');
      refresh();
    } catch (e: unknown) {
      setWrapError((e as Error).message ?? 'Wrap failed.');
    } finally {
      setWrapping(false);
    }
  }

  async function handleUnwrap() {
    setWrapError(null);
    setWrapSuccess(null);
    if (!address || !publicClient) return;
    setWrapping(true);
    try {
      const amount = parseUnits(unwrapInput.trim() || '0', 18);
      if (amount <= 0n) {
        setWrapError('Enter an amount.');
        return;
      }
      const feeData = await publicClient.estimateFeesPerGas();
      const mfpg = (feeData.maxFeePerGas * 120n) / 100n;
      const mpfpg = (feeData.maxPriorityFeePerGas * 120n) / 100n;
      const gas = await publicClient.estimateContractGas({
        address: wcfxAddr as `0x${string}`,
        abi: WCFX_ABI,
        functionName: 'withdraw',
        args: [amount],
        account: address as `0x${string}`,
      });
      const hash = await writeContractAsync({
        address: wcfxAddr as `0x${string}`,
        abi: WCFX_ABI,
        functionName: 'withdraw',
        args: [amount],
        gas: (gas * 130n) / 100n,
        maxFeePerGas: mfpg,
        maxPriorityFeePerGas: mpfpg,
      });
      await publicClient.waitForTransactionReceipt({
        hash,
        pollingInterval: 2_000,
        timeout: 120_000,
      });
      setWrapSuccess(`${unwrapInput} wCFX unwrapped to CFX.`);
      setUnwrapInput('');
      refresh();
    } catch (e: unknown) {
      setWrapError((e as Error).message ?? 'Unwrap failed.');
    } finally {
      setWrapping(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-label="Wrap CFX"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm ${wrapping ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={wrapping ? undefined : onClose}
      />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden animate-modal-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-800/50">
          <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            <RefreshCcw className="w-5 h-5 text-conflux-400" /> Convert CFX
          </h2>
          <button
            type="button"
            onClick={wrapping ? undefined : onClose}
            disabled={wrapping}
            className={`p-1 rounded-lg transition-colors ${wrapping ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            {(['wrap', 'unwrap'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setWcfxPanelTab(tab)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  wcfxPanelTab === tab
                    ? 'bg-conflux-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab === 'wrap' ? 'Wrap (CFX → wCFX)' : 'Unwrap (wCFX → CFX)'}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Amount</span>
              <span className="text-slate-500 font-medium">
                Available:{' '}
                <span
                  className={
                    wcfxPanelTab === 'wrap' ? 'text-white' : 'text-conflux-400'
                  }
                >
                  {wcfxPanelTab === 'wrap'
                    ? `${fmtBalance(cfxInfo?.balanceFormatted ?? '0') || '0'} CFX`
                    : `${fmtBalance(wcfxInfo?.balanceFormatted ?? '0') || '0'} wCFX`}
                </span>
              </span>
            </div>

            <div className="flex gap-3">
              <input
                type="number"
                min="0"
                step="any"
                value={wcfxPanelTab === 'wrap' ? wrapInput : unwrapInput}
                onChange={(e) =>
                  wcfxPanelTab === 'wrap'
                    ? setWrapInput(e.target.value)
                    : setUnwrapInput(e.target.value)
                }
                placeholder="0.0"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-conflux-500 focus:border-conflux-500 transition-all"
              />
              <button
                type="button"
                onClick={() =>
                  wcfxPanelTab === 'wrap'
                    ? setWrapInput(cfxInfo?.balanceFormatted ?? '0')
                    : setUnwrapInput(wcfxInfo?.balanceFormatted ?? '0')
                }
                className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-semibold hover:bg-slate-700 hover:text-white transition-colors uppercase tracking-widest text-sm"
              >
                Max
              </button>
            </div>
          </div>

          {wrapError && (
            <div className="p-3 bg-red-950/50 border border-red-900/50 rounded-lg text-sm text-red-400 break-words">
              {wrapError}
            </div>
          )}
          {wrapSuccess && (
            <div className="p-3 bg-green-950/50 border border-green-900/50 rounded-lg text-sm text-green-400">
              {wrapSuccess}
            </div>
          )}

          <button
            type="button"
            disabled={wrapping}
            onClick={wcfxPanelTab === 'wrap' ? handleWrap : handleUnwrap}
            className="w-full relative overflow-hidden bg-conflux-600 hover:bg-conflux-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(0,120,200,0.4)] disabled:shadow-none uppercase tracking-wide"
          >
            {wrapping ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5 text-white/50"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Waiting for confirmation...
              </span>
            ) : wcfxPanelTab === 'wrap' ? (
              `Wrap CFX`
            ) : (
              `Unwrap wCFX`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
