"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { apiFetch, type PaymentChallenge } from "@/lib/api";
import { PaywallModal } from "./PaywallModal";
import { Lock, Unlock, Zap, Database, ChevronRight, Loader2, ExternalLink, BoltIcon, Clock, Shield } from "lucide-react";
import { TOKEN_DECIMALS } from "@x402/shared";
import { useNetwork } from "@/components/NetworkContext";

interface EndpointDef {
  path: string;
  method: "GET" | "POST";
  tier: "free" | "premium";
  price: string;
  description: string;
  icon: typeof Unlock;
  color: string;
  escrowHours: number | null; // null = free endpoint, 0 = no escrow, >0 = hours
  sellerOverride?: string; // optional per-endpoint seller address
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
    escrowHours: null,
  },
  {
    path: "/data/instant",
    method: "GET",
    tier: "premium",
    price: "0.01 USDT0",
    description: "Quick price and network lookup, designed for no-escrow sellers",
    icon: BoltIcon,
    color: "cyan",
    escrowHours: 0,
  },
  {
    path: "/data/premium",
    method: "GET",
    tier: "premium",
    price: "0.10 USDT0",
    description: "Detailed analytics with historical trends, top contracts, and gas usage",
    icon: Database,
    color: "amber",
    escrowHours: 1,
  },
  {
    path: "/compute/simulate",
    method: "POST",
    tier: "premium",
    price: "0.50 USDT0",
    description: "Run a compute simulation with configurable iterations",
    icon: Zap,
    color: "violet",
    escrowHours: 24,
  },
];

function truncateAddr(addr: string) {
  if (!addr || addr.length < 12) return addr || "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  emerald: { bg: "bg-emerald-500/5", text: "text-emerald-400", border: "border-emerald-500/20", iconBg: "bg-emerald-500/15" },
  cyan:    { bg: "bg-cyan-500/5",    text: "text-cyan-400",    border: "border-cyan-500/20",    iconBg: "bg-cyan-500/15" },
  amber:   { bg: "bg-amber-500/5",   text: "text-amber-400",   border: "border-amber-500/20",   iconBg: "bg-amber-500/15" },
  violet:  { bg: "bg-violet-500/5",  text: "text-violet-400",  border: "border-violet-500/20",  iconBg: "bg-violet-500/15" },
};

export function EndpointCatalog() {
  const { isConnected } = useAccount();
  const { isTestnet, chainName, chainId, explorerUrl, paymentToken, serviceWallet: sellerAddress, contractAddress: contractAddr } = useNetwork();
  const contractAddress = contractAddr || "";
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
      chainId,
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

  async function handleTokenSwitch(tokenAddress: string) {
    if (!activeEndpoint) return;
    const ep = endpoints.find((e) => e.path === activeEndpoint);
    if (!ep) return;
    setChallenge(null);
    const res = await apiFetch(ep.path, {
      method: ep.method,
      preferredToken: tokenAddress,
      chainId,
      body: ep.method === "POST" ? JSON.stringify({ iterations: 1000 }) : undefined,
    });
    if (res.paymentRequired) {
      setChallenge(res.paymentRequired);
    }
  }

  const methodColors: Record<string, string> = {
    GET: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    POST: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  };

  function escrowLabel(hours: number | null | undefined): string {
    if (hours == null) return "";
    if (hours === 0) return "No escrow";
    if (hours === 1) return "1 hour escrow";
    return `${hours}h escrow`;
  }

  return (
    <>
      {/* Top row: free + instant (wider cards) */}
      <div className="grid gap-4 md:grid-cols-2 mb-4">
        {endpoints.filter(ep => ep.tier === "free").map((ep) => {
          const Icon = ep.icon;
          const isFree = ep.tier === "free";
          const isLocked = ep.tier === "premium" && !isConnected;
          const colors = COLOR_MAP[ep.color] || COLOR_MAP.amber;

          return (
            <div
              key={ep.path}
              className={`group relative rounded-2xl border p-5 flex flex-col transition-all duration-200
                ${isFree
                  ? "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40"
                  : "border-gray-700/50 bg-[#0F2744]/60 hover:border-conflux-teal/30"
                }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors.iconBg}`}>
                  <Icon size={18} className={colors.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-semibold text-white font-mono">{ep.path}</code>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${methodColors[ep.method]}`}>
                      {ep.method}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs mt-0.5 truncate">{ep.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-auto">
                {/* Price + escrow badges */}
                <div className="flex items-center gap-2 flex-1">
                  <span className={`text-sm font-semibold ${isFree ? "text-emerald-400" : "text-white"}`}>
                    {ep.price}
                  </span>
                  {!isFree && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                      <Lock size={9} /> Paywall
                    </span>
                  )}
                  {ep.escrowHours !== null && (
                    <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                      ep.escrowHours === 0
                        ? "text-cyan-400/80 bg-cyan-500/10"
                        : "text-gray-400/80 bg-gray-500/10"
                    }`}>
                      {ep.escrowHours === 0 ? <BoltIcon size={9} /> : <Clock size={9} />}
                      {escrowLabel(ep.escrowHours)}
                    </span>
                  )}
                </div>

                {/* CTA */}
                <button
                  onClick={() => callEndpoint(ep.path, ep.method)}
                  disabled={loading[ep.path] || isLocked}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-all
                    flex items-center gap-1.5 shrink-0
                    ${isFree
                      ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20"
                      : "bg-conflux-teal/15 text-conflux-teal hover:bg-conflux-teal/25 border border-conflux-teal/20"
                    }
                    disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  {loading[ep.path] ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : isLocked ? (
                    "Connect wallet"
                  ) : (
                    <><span>Try it</span> <ChevronRight size={12} /></>
                  )}
                </button>
              </div>

              {/* Result */}
              {results[ep.path] && (
                <div className="mt-3 rounded-lg bg-black/30 border border-gray-700/50 overflow-hidden">
                  <div className="px-3 py-1 bg-gray-800/50 border-b border-gray-700/50 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Response</span>
                    <button
                      onClick={() => setResults((r) => { const n = { ...r }; delete n[ep.path]; return n; })}
                      className="text-[10px] text-gray-500 hover:text-gray-300"
                    >
                      Clear
                    </button>
                  </div>
                  <pre className="text-xs text-gray-300 p-3 overflow-auto max-h-40 font-mono leading-relaxed">
                    {JSON.stringify(results[ep.path], null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom row: premium endpoints (with full payment details) */}
      <div className="grid gap-4 md:grid-cols-2">
        {endpoints.filter(ep => ep.tier === "premium").map((ep) => {
          const Icon = ep.icon;
          const isLocked = !isConnected;
          const colors = COLOR_MAP[ep.color] || COLOR_MAP.amber;

          return (
            <div
              key={ep.path}
              className="group relative rounded-2xl border border-gray-700/50 bg-[#0F2744]/60 hover:border-conflux-teal/30 p-5 flex flex-col transition-all duration-200"
            >
              {/* Header row */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors.iconBg}`}>
                  <Icon size={18} className={colors.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-semibold text-white font-mono">{ep.path}</code>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${methodColors[ep.method]}`}>
                      {ep.method}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs mt-0.5">{ep.description}</p>
                </div>
              </div>

              {/* Price + badges row */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base font-semibold text-white">{ep.price}</span>
                <span className="flex items-center gap-1 text-[10px] text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                  <Lock size={9} /> Paywall
                </span>
                <span className="flex items-center gap-1 text-[10px] text-gray-400/80 bg-gray-500/10 px-1.5 py-0.5 rounded-full">
                  <Shield size={9} /> {escrowLabel(ep.escrowHours)}
                </span>
              </div>

              {/* Compact payment details */}
              <div className="rounded-lg bg-black/20 border border-gray-700/30 px-3 py-2 mb-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Network</span>
                  <span className="text-gray-300 flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${isTestnet ? "bg-amber-400" : "bg-emerald-400"}`} />
                    {chainId}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Token</span>
                  {paymentToken ? (
                    <a href={`${explorerUrl}/token/${paymentToken}`} target="_blank" rel="noopener noreferrer"
                      className="text-conflux-teal hover:underline font-mono flex items-center gap-0.5">
                      {truncateAddr(paymentToken)} <ExternalLink size={8} />
                    </a>
                  ) : <span className="text-gray-500">—</span>}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Seller</span>
                  {(ep.sellerOverride || sellerAddress) ? (
                    <a href={`${explorerUrl}/address/${ep.sellerOverride || sellerAddress}`} target="_blank" rel="noopener noreferrer"
                      className="text-conflux-teal hover:underline font-mono flex items-center gap-0.5">
                      {truncateAddr(ep.sellerOverride || sellerAddress)} <ExternalLink size={8} />
                    </a>
                  ) : <span className="text-gray-500">—</span>}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Facilitator</span>
                  {contractAddress ? (
                    <a href={`${explorerUrl}/address/${contractAddress}`} target="_blank" rel="noopener noreferrer"
                      className="text-conflux-teal hover:underline font-mono flex items-center gap-0.5">
                      {truncateAddr(contractAddress)} <ExternalLink size={8} />
                    </a>
                  ) : <span className="text-gray-500">—</span>}
                </div>
              </div>

              {/* CTA */}
              <div className="relative group/btn mt-auto">
                <button
                  onClick={() => callEndpoint(ep.path, ep.method)}
                  disabled={loading[ep.path] || isLocked}
                  className="w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                    flex items-center justify-center gap-2
                    bg-conflux-teal/15 text-conflux-teal hover:bg-conflux-teal/25 border border-conflux-teal/20
                    disabled:opacity-30 disabled:cursor-not-allowed"
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
                <div className="mt-3 rounded-lg bg-black/30 border border-gray-700/50 overflow-hidden">
                  <div className="px-3 py-1 bg-gray-800/50 border-b border-gray-700/50 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Response</span>
                    <button
                      onClick={() => setResults((r) => { const n = { ...r }; delete n[ep.path]; return n; })}
                      className="text-[10px] text-gray-500 hover:text-gray-300"
                    >
                      Clear
                    </button>
                  </div>
                  <pre className="text-xs text-gray-300 p-3 overflow-auto max-h-40 font-mono leading-relaxed">
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
          onTokenSwitch={handleTokenSwitch}
        />
      )}
    </>
  );
}
