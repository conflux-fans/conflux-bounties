"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { apiFetch, type PaymentChallenge } from "@/lib/api";
import { PaywallModal } from "./PaywallModal";
import { Lock, Unlock, Zap, Database, ChevronRight, Loader2 } from "lucide-react";
import { TOKEN_DECIMALS } from "@x402/shared";

interface EndpointDef {
  path: string;
  method: "GET" | "POST";
  tier: "free" | "premium";
  price: string;
  description: string;
  icon: typeof Unlock;
  color: string;
}

const DEFAULT_ENDPOINTS: EndpointDef[] = [
  {
    path: "/data/free",
    method: "GET",
    tier: "free",
    price: "Free",
    description: "Basic network metrics including TPS and active accounts",
    icon: Unlock,
    color: "emerald",
  },
  {
    path: "/data/premium",
    method: "GET",
    tier: "premium",
    price: "0.10 USDT0",
    description: "Detailed analytics with historical trends, top contracts, and gas usage",
    icon: Database,
    color: "amber",
  },
  {
    path: "/compute/simulate",
    method: "POST",
    tier: "premium",
    price: "0.50 USDT0",
    description: "Run a compute simulation with configurable iterations",
    icon: Zap,
    color: "violet",
  },
];

export function EndpointCatalog() {
  const { isConnected } = useAccount();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [results, setResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [challenge, setChallenge] = useState<PaymentChallenge | null>(null);
  const [activeEndpoint, setActiveEndpoint] = useState<string | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointDef[]>(DEFAULT_ENDPOINTS);

  // Fetch live pricing from API on mount so prices stay in sync with admin config
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
    fetch(`${apiBase}/admin/pricing`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data?.pricing) return;
        const priceMap = new Map<string, string>();
        for (const p of data.pricing) {
          const human = (Number(p.price) / 10 ** TOKEN_DECIMALS).toFixed(2);
          priceMap.set(p.endpoint, `${human} USDT0`);
        }
        setEndpoints((prev) =>
          prev.map((ep) => ({
            ...ep,
            price: ep.tier === "free" ? "Free" : (priceMap.get(ep.path) ?? ep.price),
          }))
        );
      })
      .catch(() => {}); // Fall back to hardcoded defaults
  }, []);

  async function callEndpoint(path: string, method: string, invoiceId?: string, payer?: string) {
    setLoading((l) => ({ ...l, [path]: true }));
    const res = await apiFetch(path, {
      method,
      invoiceId,
      payer,
      body: method === "POST" ? JSON.stringify({ iterations: 1000 }) : undefined,
    });
    setLoading((l) => ({ ...l, [path]: false }));

    if (res.paymentRequired) {
      setChallenge(res.paymentRequired);
      setActiveEndpoint(path);
      return;
    }

    if (res.data) {
      setResults((r) => ({ ...r, [path]: res.data }));
    }
  }

  function handlePaymentComplete(invoiceId: string, payer?: string) {
    setChallenge(null);
    if (activeEndpoint) {
      const ep = endpoints.find((e) => e.path === activeEndpoint);
      if (ep) callEndpoint(ep.path, ep.method, invoiceId, payer);
    }
  }

  const methodColors: Record<string, string> = {
    GET: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    POST: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  };

  return (
    <>
      <div className="grid gap-5 md:grid-cols-3">
        {endpoints.map((ep) => {
          const Icon = ep.icon;
          const isFree = ep.tier === "free";
          const isLocked = ep.tier === "premium" && !isConnected;
          return (
            <div
              key={ep.path}
              className={`group relative rounded-2xl border p-6 flex flex-col transition-all duration-200
                ${isFree
                  ? "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 hover:bg-emerald-500/10"
                  : "border-gray-700/50 bg-[#0F2744]/60 hover:border-conflux-teal/30 hover:bg-[#0F2744]"
                }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                  ${isFree ? "bg-emerald-500/15" : ep.color === "amber" ? "bg-amber-500/15" : "bg-violet-500/15"}`}>
                  <Icon size={20} className={
                    isFree ? "text-emerald-400" : ep.color === "amber" ? "text-amber-400" : "text-violet-400"
                  } />
                </div>
                <span className={`text-xs font-mono px-2.5 py-1 rounded-full border ${methodColors[ep.method]}`}>
                  {ep.method}
                </span>
              </div>

              {/* Path */}
              <code className="text-sm font-semibold text-white mb-2 font-mono">{ep.path}</code>

              {/* Description */}
              <p className="text-gray-400 text-sm leading-relaxed flex-1 mb-4">{ep.description}</p>

              {/* Price tag */}
              <div className="flex items-center justify-between mb-4">
                <span className={`text-sm font-medium ${isFree ? "text-emerald-400" : "text-white"}`}>
                  {ep.price}
                </span>
                {!isFree && (
                  <span className="flex items-center gap-1 text-xs text-amber-400/80">
                    <Lock size={11} /> Paywall
                  </span>
                )}
              </div>

              {/* Button */}
              <div className="relative group/btn">
                <button
                  onClick={() => callEndpoint(ep.path, ep.method)}
                  disabled={loading[ep.path] || isLocked}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                    flex items-center justify-center gap-2
                    ${isFree
                      ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20"
                      : "bg-conflux-teal/15 text-conflux-teal hover:bg-conflux-teal/25 border border-conflux-teal/20"
                    }
                    disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  {loading[ep.path] ? (
                    <><Loader2 size={14} className="animate-spin" /> Calling...</>
                  ) : isLocked ? (
                    "Connect wallet first"
                  ) : (
                    <><span>Try it</span> <ChevronRight size={14} /></>
                  )}
                </button>
                {isLocked && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg
                    bg-gray-800 border border-gray-700 text-xs text-gray-300 whitespace-nowrap
                    opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none z-10">
                    Connect your wallet to sign an ERC-3009 payment
                  </div>
                )}
              </div>

              {/* Result */}
              {results[ep.path] && (
                <div className="mt-4 rounded-xl bg-black/30 border border-gray-700/50 overflow-hidden">
                  <div className="px-3 py-1.5 bg-gray-800/50 border-b border-gray-700/50 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Response</span>
                    <button
                      onClick={() => setResults((r) => { const n = { ...r }; delete n[ep.path]; return n; })}
                      className="text-[10px] text-gray-500 hover:text-gray-300"
                    >
                      Clear
                    </button>
                  </div>
                  <pre className="text-xs text-gray-300 p-3 overflow-auto max-h-48 font-mono leading-relaxed">
                    {JSON.stringify(results[ep.path], null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {challenge && (
        <PaywallModal
          challenge={challenge}
          onClose={() => setChallenge(null)}
          onPaymentComplete={handlePaymentComplete}
        />
      )}
    </>
  );
}
