"use client";

import Link from "next/link";
import {
  useChainId,
  useConnect,
  useConnection,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { confluxESpace, confluxESpaceTestnet } from "@/lib/chains";

type Props = {
  /** Server session after SIWE login (httpOnly cookie + DB). */
  signedIn: boolean;
};

/**
 * Wallet connect (wagmi) ≠ signed-in session (SIWE). This header reflects both clearly.
 */
export function AppHeader({ signedIn }: Props) {
  const { address, isConnected } = useConnection();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const primary = connectors[0];
  const needsSiwe = isConnected && !signedIn;

  return (
    <header className="sticky top-0 z-40 border-b border-ink/[0.06] bg-surface/85 shadow-card-sm backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-4">
        <Link
          href="/"
          className="font-display shrink-0 text-xl font-semibold tracking-tight text-ink transition hover:text-accent"
        >
          Gated
        </Link>

        <nav className="order-3 flex flex-wrap items-center gap-1 sm:order-2 sm:flex-1 sm:justify-center">
          {!signedIn ? (
            <Link
              href="/login"
              className={`nav-pill ${!isConnected ? "nav-pill-active" : ""}`}
            >
              {isConnected ? "Sign message (SIWE)" : "Sign in"}
            </Link>
          ) : null}
          {signedIn ? (
            <>
              <Link href="/members" className="nav-pill">
                Members
              </Link>
              <Link href="/profile" className="nav-pill">
                Profile
              </Link>
              <Link href="/admin" className="nav-pill">
                Admin
              </Link>
            </>
          ) : null}
        </nav>

        <div className="order-2 flex min-w-0 flex-col gap-2 sm:order-3 sm:max-w-[min(100%,19rem)] sm:items-end">
          {!isConnected ? (
            <button
              type="button"
              disabled={isPending || !primary}
              onClick={() => primary && connect({ connector: primary })}
              className="btn-primary w-full sm:w-auto"
            >
              {isPending ? "Connecting…" : "Connect wallet"}
            </button>
          ) : (
            <div className="ui-card-tight w-full sm:min-w-[14rem]">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="truncate font-mono text-[11px] text-ink-muted"
                  title={address}
                >
                  {address?.slice(0, 6)}…{address?.slice(-4)}
                </span>
                {signedIn ? (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
                    Live
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
                    No session
                  </span>
                )}
              </div>
              {needsSiwe ? (
                <p className="mt-2 text-right text-[11px] leading-snug text-ink-muted">
                  Wallet ready —{" "}
                  <Link href="/login" className="font-semibold text-accent hover:underline">
                    complete SIWE
                  </Link>
                </p>
              ) : null}
              <div className="mt-2.5 flex flex-wrap justify-end gap-1.5">
                <button
                  type="button"
                  disabled={chainId === confluxESpace.id || isSwitching}
                  onClick={() => switchChain({ chainId: confluxESpace.id })}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                    chainId === confluxESpace.id
                      ? "border-accent/40 bg-accent-soft text-accent"
                      : "border-ink/10 text-ink-muted hover:border-accent/20 hover:bg-accent-soft/40"
                  } disabled:opacity-40`}
                >
                  eSpace
                </button>
                <button
                  type="button"
                  disabled={chainId === confluxESpaceTestnet.id || isSwitching}
                  onClick={() => switchChain({ chainId: confluxESpaceTestnet.id })}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                    chainId === confluxESpaceTestnet.id
                      ? "border-accent/40 bg-accent-soft text-accent"
                      : "border-ink/10 text-ink-muted hover:border-accent/20 hover:bg-accent-soft/40"
                  } disabled:opacity-40`}
                >
                  Testnet
                </button>
                <button
                  type="button"
                  onClick={() => disconnect()}
                  className="text-[11px] font-medium text-ink-faint underline decoration-ink/20 underline-offset-2 transition hover:text-ink"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
