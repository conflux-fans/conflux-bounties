"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useChainId,
  useConnect,
  useConnection,
  useDisconnect,
  useSignMessage,
} from "wagmi";
import { buildSiweMessage } from "@/lib/auth/siwe-message";

export function SignInPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/members";

  const { address, isConnected } = useConnection();
  const chainId = useChainId();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = useCallback(async () => {
    setError(null);
    if (!address || !chainId) {
      setError("Connect a wallet first.");
      return;
    }
    setBusy(true);
    try {
      const nonceRes = await fetch("/api/auth/nonce", { method: "POST" });
      if (!nonceRes.ok) throw new Error("Could not get nonce");
      const { nonce } = (await nonceRes.json()) as { nonce: string };

      const uri =
        typeof window !== "undefined" ? window.location.origin : "";
      const domain =
        process.env.NEXT_PUBLIC_SIWC_DOMAIN?.trim() || "localhost";
      const message = buildSiweMessage({
        domain,
        address,
        uri,
        chainId,
        nonce,
        statement: "Sign in to the Conflux gated demo.",
      });

      const signature = await signMessageAsync({ message });

      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });

      if (!loginRes.ok) {
        const j = (await loginRes.json()) as { error?: string };
        throw new Error(j.error || "Login failed");
      }

      router.push(nextPath);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }, [address, chainId, nextPath, router, signMessageAsync]);

  const primary = connectors[0];

  return (
    <div className="ui-card">
      <div className="flex items-start justify-between gap-4 border-b border-ink/[0.06] pb-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Wallet</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Use Conflux eSpace (1030) or testnet (71), then sign the SIWE
            message.
          </p>
        </div>
        <div
          className="hidden h-12 w-12 shrink-0 rounded-2xl bg-accent-soft sm:flex sm:items-center sm:justify-center"
          aria-hidden
        >
          <svg
            className="h-6 w-6 text-accent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 12a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 12m18 0v6.75A2.25 2.25 0 0 1 18.75 21H5.25A2.25 2.25 0 0 1 3 18.75V12m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 12m18 0v.75a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1-.75-.75V12"
            />
          </svg>
        </div>
      </div>

      {!isConnected ? (
        <button
          type="button"
          disabled={isConnecting || !primary}
          onClick={() => primary && connect({ connector: primary })}
          className="btn-primary mt-6 w-full"
        >
          {isConnecting ? "Connecting…" : "Connect wallet"}
        </button>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="rounded-xl border border-ink/[0.06] bg-paper/60 p-4">
            <p className="font-mono text-xs break-all text-ink">{address}</p>
            <p className="mt-2 text-xs text-ink-faint">Chain ID: {chainId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || isSigning}
              onClick={() => void signIn()}
              className="btn-primary flex-1 sm:flex-none"
            >
              {busy || isSigning ? "Signing…" : "Sign in with SIWE"}
            </button>
            <button
              type="button"
              onClick={() => disconnect()}
              className="btn-secondary flex-1 sm:flex-none"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p
          className="mt-4 rounded-xl border border-red-200/80 bg-red-50/80 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
