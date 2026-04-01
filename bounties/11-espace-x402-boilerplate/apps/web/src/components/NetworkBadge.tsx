"use client";

import { useChainId, useSwitchChain, useAccount } from "wagmi";

export function NetworkBadge() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const mainnet = chainId === 1030;

  const targetChainId = mainnet ? 71 : 1030;

  return (
    <button
      onClick={() => {
        if (isConnected && !isPending) {
          switchChain({ chainId: targetChainId });
        }
      }}
      disabled={!isConnected || isPending}
      title={
        !isConnected
          ? "Connect wallet to switch network"
          : isPending
            ? "Switching…"
            : `Switch to ${mainnet ? "Testnet" : "Mainnet"}`
      }
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase transition-opacity ${
        mainnet
          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
          : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
      } ${isConnected && !isPending ? "cursor-pointer hover:opacity-80" : "cursor-default opacity-70"}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          mainnet ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
        }`}
      />
      {isPending ? "Switching…" : mainnet ? "Mainnet" : "Testnet"}
      <span className="text-[10px] opacity-60">({chainId})</span>
      {isConnected && !isPending && (
        <svg
          className="w-3 h-3 opacity-60"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
          />
        </svg>
      )}
    </button>
  );
}
