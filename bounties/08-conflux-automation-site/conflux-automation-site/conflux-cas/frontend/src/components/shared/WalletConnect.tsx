'use client';

import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Power,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { injected, useAccount, useConnect } from 'wagmi';
import {
  EXPECTED_CHAIN_NAME,
  useNetworkSwitch,
} from '../../hooks/useNetworkSwitch';
import { useAuthContext } from '../../lib/auth-context';

// ─── Copy-to-clipboard address chip with inline status dot ───────────────────
type SignStatus = 'signed' | 'unsigned' | 'loading';

function AddressChip({
  address,
  status,
}: {
  address: string;
  status: SignStatus;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const dotEl =
    status === 'loading' ? (
      <svg
        className="h-2.5 w-2.5 animate-spin text-slate-400 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path
          d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
          strokeLinecap="round"
        />
      </svg>
    ) : status === 'signed' ? (
      <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_5px_#4ade80] flex-shrink-0" />
    ) : (
      <span className="h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_5px_#fb923c] flex-shrink-0" />
    );

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied!' : address}
      className="group flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800
                 px-2.5 py-1 transition-colors hover:border-conflux-500 hover:bg-slate-700"
    >
      {dotEl}
      <span className="font-mono text-xs text-slate-200">
        {address.slice(0, 6)}…{address.slice(-4)}
      </span>
      {/* copy / check icon */}
      {copied ? (
        <Check
          className="h-3 w-3 text-green-400 flex-shrink-0"
          strokeWidth={3}
        />
      ) : (
        <Copy className="h-3 w-3 text-slate-500 group-hover:text-conflux-400 flex-shrink-0 transition-colors" />
      )}
    </button>
  );
}

export function WalletConnect() {
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const { address, token, isLoading, error, login, logout } = useAuthContext();
  const { isWrongNetwork, isSwitching, switchError, handleSwitchNetwork } =
    useNetworkSwitch();

  if (!isConnected) {
    return (
      <button
        type="button"
        onClick={() => connect({ connector: injected() })}
        className="group flex items-center gap-2 bg-conflux-600 hover:bg-conflux-500 text-white text-sm font-semibold py-2 px-4 rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(0,120,200,0.5)] hover:shadow-[0_0_25px_-5px_rgba(0,120,200,0.7)]"
      >
        <Wallet className="h-4 w-4 group-hover:scale-110 transition-transform" />
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Address chip — dot reflects sign status, click to copy */}
      {address && (
        <AddressChip
          address={address}
          status={isLoading ? 'loading' : token ? 'signed' : 'unsigned'}
        />
      )}

      {/* Adaptive action button: wrong-network → switch | signing → disabled | unsigned → sign | signed → disconnect */}
      {isWrongNetwork ? (
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={handleSwitchNetwork}
            disabled={isSwitching}
            className="flex items-center gap-1.5 text-xs bg-amber-600/20 border border-amber-600/50 hover:bg-amber-600/30
                       disabled:opacity-50 text-amber-500 py-1.5 px-3 rounded-lg transition-colors whitespace-nowrap font-medium"
            title={`Switch wallet to ${EXPECTED_CHAIN_NAME}`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {isSwitching ? 'Switching…' : `Switch to ${EXPECTED_CHAIN_NAME}`}
          </button>
          {switchError && (
            <span className="text-xs text-red-400 max-w-[180px] text-right leading-tight">
              {switchError}
            </span>
          )}
        </div>
      ) : isLoading ? (
        <button
          type="button"
          disabled
          className="flex items-center gap-1.5 text-xs border border-slate-700/50 bg-slate-800/50 text-slate-500
                     py-1.5 px-3 rounded-lg cursor-not-allowed"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
          Signing…
        </button>
      ) : !token ? (
        <button
          type="button"
          onClick={() => void login()}
          title={error ?? 'Sign a message to authenticate'}
          className="text-xs bg-conflux-600 hover:bg-conflux-500 text-white py-1.5 px-4 rounded-lg transition-colors font-medium shadow-[0_0_15px_-5px_rgba(0,120,200,0.5)]"
        >
          Sign In
        </button>
      ) : (
        <button
          type="button"
          onClick={() => logout()}
          title="Disconnect wallet"
          className="flex items-center gap-1.5 text-xs border border-slate-700 bg-slate-800 hover:bg-red-500/10 hover:border-red-500/50
                     text-slate-400 hover:text-red-400 py-1.5 px-2.5 rounded-lg transition-colors"
        >
          <Power className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="hidden sm:inline font-medium">Disconnect</span>
        </button>
      )}
    </div>
  );
}
