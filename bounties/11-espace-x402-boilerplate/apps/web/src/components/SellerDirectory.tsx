"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ExternalLink, Search, Globe, Users, RefreshCw, Filter,
  Lock, Unlock, Zap, Database, ChevronRight, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { createPublicClient, http } from "viem";
import { useAccount } from "wagmi";
import { getChainById } from "@/lib/wagmi";
import { apiFetch, type PaymentChallenge } from "@/lib/api";
import { PaywallModal } from "./PaywallModal";
import { useNetwork } from "@/components/NetworkContext";

const registryAbi = [
  {
    type: "function",
    name: "getActiveSellers",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "wallet", type: "address" },
          { name: "apiBaseUrl", type: "string" },
          { name: "description", type: "string" },
          { name: "active", type: "bool" },
          { name: "registeredAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

interface Seller {
  wallet: string;
  apiBaseUrl: string;
  description: string;
  active: boolean;
  registeredAt: bigint;
}

interface ManifestEndpoint {
  path: string;
  method: string;
  tier: "free" | "premium";
  price: string;
  priceRaw?: string;
  description: string;
  params?: Record<string, string>;
  returns?: string;
  tokenPricing?: { token: string; symbol: string; price: string; priceRaw: string }[];
}

interface ApiManifest {
  name: string;
  version: string;
  network?: {
    name: string;
    chainId: number;
    rpcUrl?: string;
  };
  payment?: {
    token: string;
    tokenSymbol: string;
    tokenDecimals: number;
    facilitator: string;
    seller: string;
    supportedTokens?: { address: string; symbol: string; decimals: number }[];
  };
  endpoints: ManifestEndpoint[];
}

interface SellerWithManifest extends Seller {
  manifest?: ApiManifest;
  manifestError?: string;
  manifestLoading?: boolean;
}

function truncateAddr(addr: string) {
  if (!addr || addr.length < 12) return addr || "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toLocaleDateString();
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  POST: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  PUT: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
};

const tierIcons: Record<string, typeof Unlock> = {
  free: Unlock,
  premium: Lock,
};

export function SellerDirectory() {
  const { isConnected } = useAccount();
  const { isTestnet, chainId, explorerUrl, contractAddress } = useNetwork();
  const [sellers, setSellers] = useState<SellerWithManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [expandedSellers, setExpandedSellers] = useState<Set<string>>(new Set());

  // Try-it state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [results, setResults] = useState<Record<string, any>>({});
  const [callLoading, setCallLoading] = useState<Record<string, boolean>>({});
  const [challenge, setChallenge] = useState<PaymentChallenge | null>(null);
  const [activeEndpoint, setActiveEndpoint] = useState<{ sellerUrl: string; path: string; method: string; params?: Record<string, string> } | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, Record<string, string>>>({});

  const fetchManifest = useCallback(async (seller: Seller): Promise<Partial<SellerWithManifest>> => {
    const base = normalizeBaseUrl(seller.apiBaseUrl);
    try {
      const res = await fetch(`${base}/x402/manifest`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { manifestError: `HTTP ${res.status}` };
      const manifest = await res.json();
      return { manifest };
    } catch {
      return { manifestError: "Manifest not available" };
    }
  }, []);

  const fetchSellers = useCallback(async () => {
    if (!contractAddress) {
      setError("No contract deployed on this network");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const chain = getChainById(chainId);
      const client = createPublicClient({
        chain: chain as Parameters<typeof createPublicClient>[0]["chain"],
        transport: http(),
      });

      const result = await client.readContract({
        address: contractAddress,
        abi: registryAbi,
        functionName: "getActiveSellers",
        args: [BigInt(0), BigInt(100)],
      });

      const rawSellers = result as unknown as Seller[];
      setSellers(rawSellers.map((s) => ({ ...s, manifestLoading: true })));

      // Fetch manifests in parallel
      const manifests = await Promise.all(rawSellers.map((s) => fetchManifest(s)));
      setSellers(rawSellers.map((s, i) => ({ ...s, ...manifests[i], manifestLoading: false })));

      // Auto-expand sellers that have manifests
      const withManifest = new Set<string>();
      manifests.forEach((m, i) => {
        if (m.manifest) withManifest.add(rawSellers[i].wallet);
      });
      setExpandedSellers(withManifest);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [fetchManifest, contractAddress, chainId]);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  const filtered = sellers
    .filter((s) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.wallet.toLowerCase().includes(q) ||
        s.apiBaseUrl.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.manifest?.endpoints.some((ep) =>
          ep.path.toLowerCase().includes(q) || ep.description.toLowerCase().includes(q)
        )
      );
    })
    .sort((a, b) => {
      if (sortBy === "newest") return Number(b.registeredAt - a.registeredAt);
      return Number(a.registeredAt - b.registeredAt);
    });

  function toggleExpanded(wallet: string) {
    setExpandedSellers((prev) => {
      const next = new Set(prev);
      if (next.has(wallet)) next.delete(wallet);
      else next.add(wallet);
      return next;
    });
  }

  // Build a unique key for each endpoint call
  function epKey(sellerUrl: string, path: string) {
    return `${sellerUrl}::${path}`;
  }

  function getParamBody(key: string, params?: Record<string, string>): string | undefined {
    if (!params || Object.keys(params).length === 0) return undefined;
    const values = paramValues[key] || {};
    const body: Record<string, unknown> = {};
    for (const [name, typeHint] of Object.entries(params)) {
      const raw = values[name]?.trim();
      if (!raw) continue;
      // Auto-coerce numbers
      if (typeHint.toLowerCase().includes("number") || typeHint.toLowerCase().includes("int")) {
        body[name] = Number(raw);
      } else if (typeHint.toLowerCase().includes("bool")) {
        body[name] = raw === "true" || raw === "1";
      } else {
        body[name] = raw;
      }
    }
    return Object.keys(body).length > 0 ? JSON.stringify(body) : undefined;
  }

  async function callEndpoint(sellerUrl: string, path: string, method: string, params?: Record<string, string>, invoiceId?: string, payer?: string) {
    const key = epKey(sellerUrl, path);
    const base = normalizeBaseUrl(sellerUrl);
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
    const isLocal = base === normalizeBaseUrl(apiBase);
    const body = method === "POST" ? getParamBody(key, params) : undefined;

    setCallLoading((l) => ({ ...l, [key]: true }));

    try {
      if (isLocal) {
        // Use our apiFetch helper for local API (handles 402 flow)
        const res = await apiFetch(path, {
          method,
          invoiceId,
          payer,
          chainId,
          body,
        });

        if (res.paymentRequired) {
          setChallenge(res.paymentRequired);
          setActiveEndpoint({ sellerUrl, path, method, params });
          setCallLoading((l) => ({ ...l, [key]: false }));
          return;
        }

        if (res.data) {
          setResults((r) => ({ ...r, [key]: res.data }));
        } else if (res.error) {
          setResults((r) => ({ ...r, [key]: { error: res.error } }));
        }
      } else {
        // External API — direct fetch
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (invoiceId) headers["x-payment-invoice-id"] = invoiceId;
        if (payer) headers["x-payment-payer"] = payer;

        const res = await fetch(`${base}${path}`, {
          method,
          headers,
          body,
        });

        if (res.status === 402) {
          const body = await res.json();
          setChallenge({
            amount: res.headers.get("x-payment-amount") || body["x-payment-amount"],
            token: res.headers.get("x-payment-token") || body["x-payment-token"],
            nonce: res.headers.get("x-payment-nonce") || body["x-payment-nonce"],
            expiry: Number(res.headers.get("x-payment-expiry") || body["x-payment-expiry"]),
            endpoint: res.headers.get("x-payment-endpoint") || body["x-payment-endpoint"],
            invoiceId: res.headers.get("x-payment-invoice-id") || body["x-payment-invoice-id"],
            description: res.headers.get("x-payment-description") || body["x-payment-description"],
            recipient: res.headers.get("x-payment-recipient") || body["x-payment-recipient"],
            verifierAddress: res.headers.get("x-payment-verifier") || body["x-payment-verifier"],
            ...(body.supportedTokens && { supportedTokens: body.supportedTokens }),
          });
          setActiveEndpoint({ sellerUrl, path, method, params });
          setCallLoading((l) => ({ ...l, [key]: false }));
          return;
        }

        const data = await res.json();
        setResults((r) => ({ ...r, [key]: data.data ?? data }));
      }
    } catch (err) {
      setResults((r) => ({ ...r, [key]: { error: err instanceof Error ? err.message : String(err) } }));
    } finally {
      setCallLoading((l) => ({ ...l, [key]: false }));
    }
  }

  function handlePaymentComplete(invoiceId: string, payer?: string) {
    setChallenge(null);
    if (activeEndpoint) {
      callEndpoint(activeEndpoint.sellerUrl, activeEndpoint.path, activeEndpoint.method, activeEndpoint.params, invoiceId, payer);
    }
  }

  async function handleTokenSwitch(tokenAddress: string) {
    if (!activeEndpoint) return;
    setChallenge(null);
    const { sellerUrl, path, method, params } = activeEndpoint;
    const key = epKey(sellerUrl, path);
    const base = normalizeBaseUrl(sellerUrl);
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
    const isLocal = base === normalizeBaseUrl(apiBase);
    const body = method === "POST" ? getParamBody(key, params) : undefined;

    if (isLocal) {
      const res = await apiFetch(path, { method, preferredToken: tokenAddress, chainId, body });
      if (res.paymentRequired) setChallenge(res.paymentRequired);
    } else {
      const headers: Record<string, string> = { "Content-Type": "application/json", "x-preferred-token": tokenAddress };
      const res = await fetch(`${base}${path}`, { method, headers, body });
      if (res.status === 402) {
        const data = await res.json();
        setChallenge({
          amount: res.headers.get("x-payment-amount") || data["x-payment-amount"],
          token: res.headers.get("x-payment-token") || data["x-payment-token"],
          nonce: res.headers.get("x-payment-nonce") || data["x-payment-nonce"],
          expiry: Number(res.headers.get("x-payment-expiry") || data["x-payment-expiry"]),
          endpoint: res.headers.get("x-payment-endpoint") || data["x-payment-endpoint"],
          invoiceId: res.headers.get("x-payment-invoice-id") || data["x-payment-invoice-id"],
          description: res.headers.get("x-payment-description") || data["x-payment-description"],
          recipient: res.headers.get("x-payment-recipient") || data["x-payment-recipient"],
          verifierAddress: res.headers.get("x-payment-verifier") || data["x-payment-verifier"],
          ...(data.supportedTokens && { supportedTokens: data.supportedTokens }),
        });
      }
    }
  }

  return (
    <>
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search by wallet, URL, endpoint, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-gray-700/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-conflux-teal/50 focus:ring-1 focus:ring-conflux-teal/30"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
                className="pl-9 pr-8 py-2 bg-white/5 border border-gray-700/50 rounded-lg text-sm text-gray-300 appearance-none focus:outline-none focus:border-conflux-teal/50 cursor-pointer"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
            <button
              onClick={fetchSellers}
              disabled={loading}
              className="px-3 py-2 bg-white/5 border border-gray-700/50 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Users size={12} />
            {sellers.length} active seller{sellers.length !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Globe size={12} />
            {isTestnet ? "Conflux eSpace Testnet (71)" : "Conflux eSpace (1030)"}
          </span>
          {searchQuery && (
            <span>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="glass-card p-8 flex flex-col items-center justify-center text-center">
            <RefreshCw size={24} className="text-conflux-teal animate-spin mb-3" />
            <p className="text-gray-400 text-sm">Loading sellers from on-chain registry...</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="glass-card p-6 text-center">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={fetchSellers} className="mt-3 text-xs text-conflux-teal hover:underline">
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && sellers.length === 0 && (
          <div className="glass-card p-8 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-conflux-teal/10 flex items-center justify-center mb-3">
              <Users size={24} className="text-conflux-teal" />
            </div>
            <h3 className="text-white font-semibold mb-1">No sellers registered yet</h3>
            <p className="text-gray-400 text-sm max-w-sm">
              Be the first to register your API. Go to the Register tab and connect your wallet.
            </p>
          </div>
        )}

        {/* No results for search */}
        {!loading && !error && sellers.length > 0 && filtered.length === 0 && (
          <div className="glass-card p-6 text-center">
            <p className="text-gray-400 text-sm">No sellers match &quot;{searchQuery}&quot;</p>
            <button onClick={() => setSearchQuery("")} className="mt-2 text-xs text-conflux-teal hover:underline">
              Clear search
            </button>
          </div>
        )}

        {/* Seller cards */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-6">
            {filtered.map((seller) => {
              const isExpanded = expandedSellers.has(seller.wallet);
              const hasManifest = !!seller.manifest;
              const endpointCount = seller.manifest?.endpoints.length || 0;

              return (
                <div
                  key={seller.wallet}
                  className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/60 overflow-hidden hover:border-conflux-teal/30 transition-colors"
                >
                  {/* Seller header */}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-conflux-teal/10 flex items-center justify-center text-conflux-teal font-bold text-sm">
                          {seller.description ? seller.description.charAt(0).toUpperCase() : "S"}
                        </div>
                        <div>
                          <h3 className="text-white font-semibold text-sm leading-tight">
                            {seller.manifest?.name || seller.description || "Unnamed API"}
                          </h3>
                          <p className="text-gray-500 text-xs font-mono">{getDomain(seller.apiBaseUrl)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasManifest && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-conflux-teal/10 text-conflux-teal border border-conflux-teal/20">
                            {endpointCount} endpoint{endpointCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      </div>
                    </div>

                    {/* Seller details row */}
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        Seller:{" "}
                        <a
                          href={`${explorerUrl}/address/${seller.wallet}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-conflux-teal hover:underline font-mono"
                        >
                          {truncateAddr(seller.wallet)} <ExternalLink size={9} className="inline" />
                        </a>
                      </span>
                      <span>Registered: {formatDate(seller.registeredAt)}</span>
                      {seller.manifest?.payment && (
                        <span className="flex items-center gap-1">
                          Facilitator:{" "}
                          <a
                            href={`${explorerUrl}/address/${seller.manifest.payment.facilitator}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-conflux-teal hover:underline font-mono"
                          >
                            {truncateAddr(seller.manifest.payment.facilitator)} <ExternalLink size={9} className="inline" />
                          </a>
                        </span>
                      )}
                      {seller.manifest?.payment?.supportedTokens && seller.manifest.payment.supportedTokens.length > 0 && (
                        <span className="flex items-center gap-1">
                          Tokens:{" "}
                          <span className="text-gray-300">
                            {seller.manifest.payment.supportedTokens.map((t) => t.symbol).join(", ")}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Expand/collapse button */}
                    <div className="flex items-center gap-2">
                      {hasManifest ? (
                        <button
                          onClick={() => toggleExpanded(seller.wallet)}
                          className="flex items-center gap-1.5 text-xs text-conflux-teal hover:text-conflux-teal/80 transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          {isExpanded ? "Hide" : "Show"} endpoints
                        </button>
                      ) : seller.manifestLoading ? (
                        <span className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Loader2 size={12} className="animate-spin" /> Loading manifest...
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">
                          No manifest at /x402/manifest
                        </span>
                      )}
                      <div className="flex-1" />
                      <a
                        href={seller.apiBaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-conflux-teal hover:underline flex items-center gap-1"
                      >
                        Visit API <ExternalLink size={11} />
                      </a>
                      <a
                        href={`${seller.apiBaseUrl.replace(/\/$/, "")}/x402/manifest`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-400 hover:underline flex items-center gap-1"
                      >
                        Visit Manifest <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>

                  {/* Expanded: endpoint cards */}
                  {isExpanded && seller.manifest && (
                    <div className="border-t border-gray-700/30 bg-black/10 p-5">
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {seller.manifest.endpoints.map((ep) => {
                          const key = epKey(seller.apiBaseUrl, ep.path);
                          const isFree = ep.tier === "free";
                          const isLocked = ep.tier === "premium" && !isConnected;
                          const TierIcon = tierIcons[ep.tier] || Database;

                          return (
                            <div
                              key={ep.path}
                              className={`rounded-xl border p-4 flex flex-col transition-all duration-200
                                ${isFree
                                  ? "border-emerald-500/20 bg-emerald-500/5"
                                  : "border-gray-700/50 bg-[#0F2744]/40"
                                }`}
                            >
                              {/* Endpoint header */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <TierIcon size={14} className={isFree ? "text-emerald-400" : "text-amber-400"} />
                                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${methodColors[ep.method] || methodColors.GET}`}>
                                    {ep.method}
                                  </span>
                                </div>
                                {!ep.tokenPricing || ep.tokenPricing.length <= 1 ? (
                                  <span className={`text-xs font-medium ${isFree ? "text-emerald-400" : "text-white"}`}>
                                    {ep.price}
                                  </span>
                                ) : (
                                  <div className="flex flex-col items-end gap-0.5">
                                    {ep.tokenPricing.map((tp) => (
                                      <span key={tp.token} className="text-[10px] font-medium text-gray-300">
                                        {tp.price}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Path */}
                              <code className="text-sm font-semibold text-white mb-1 font-mono">{ep.path}</code>

                              {/* Description */}
                              <p className="text-gray-400 text-xs leading-relaxed flex-1 mb-2">{ep.description}</p>

                              {/* Params */}
                              {ep.params && Object.keys(ep.params).length > 0 && (
                                <div className="rounded-lg bg-black/20 border border-gray-700/30 p-2 mb-2 text-[11px]">
                                  <span className="text-gray-500 uppercase tracking-wider text-[9px]">Params</span>
                                  {Object.entries(ep.params).map(([name, typeHint]) => (
                                    <div key={name} className="flex items-center gap-2 mt-1.5">
                                      <code className="text-conflux-teal shrink-0">{name}</code>
                                      <input
                                        type="text"
                                        placeholder={typeHint}
                                        value={paramValues[key]?.[name] || ""}
                                        onChange={(e) =>
                                          setParamValues((prev) => ({
                                            ...prev,
                                            [key]: { ...prev[key], [name]: e.target.value },
                                          }))
                                        }
                                        className="flex-1 min-w-0 px-2 py-1 bg-black/30 border border-gray-700/40 rounded text-[11px] text-white placeholder-gray-600 font-mono focus:outline-none focus:border-conflux-teal/50"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Try it button */}
                              <button
                                onClick={() => callEndpoint(seller.apiBaseUrl, ep.path, ep.method, ep.params)}
                                disabled={callLoading[key] || isLocked}
                                className={`w-full py-2 rounded-lg text-xs font-medium transition-all duration-200
                                  flex items-center justify-center gap-1.5
                                  ${isFree
                                    ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20"
                                    : "bg-conflux-teal/15 text-conflux-teal hover:bg-conflux-teal/25 border border-conflux-teal/20"
                                  }
                                  disabled:opacity-30 disabled:cursor-not-allowed`}
                              >
                                {callLoading[key] ? (
                                  <><Loader2 size={12} className="animate-spin" /> Calling...</>
                                ) : isLocked ? (
                                  "Connect wallet"
                                ) : (
                                  <><span>Try it</span> <ChevronRight size={12} /></>
                                )}
                              </button>

                              {/* Result */}
                              {results[key] && (
                                <div className="mt-3 rounded-lg bg-black/30 border border-gray-700/50 overflow-hidden">
                                  <div className="px-2 py-1 bg-gray-800/50 border-b border-gray-700/50 flex items-center justify-between">
                                    <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Response</span>
                                    <button
                                      onClick={() => setResults((r) => { const n = { ...r }; delete n[key]; return n; })}
                                      className="text-[9px] text-gray-500 hover:text-gray-300"
                                    >
                                      Clear
                                    </button>
                                  </div>
                                  <pre className="text-[11px] text-gray-300 p-2 overflow-auto max-h-40 font-mono leading-relaxed">
                                    {JSON.stringify(results[key], null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
