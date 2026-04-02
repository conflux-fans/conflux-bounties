"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { apiFetch, getAdminSession, setAdminSession, onSessionChange, requestAdminChallenge, verifyAdminSignature } from "@/lib/api";
import { BarChart3, Key, DollarSign, Download, Plus, Bot, Pause, Play, MessageSquare, Fuel, AlertTriangle, ShieldAlert, Check, X, Copy, ToggleLeft, ToggleRight, Lock, Unlock, Timer, ExternalLink, Wallet } from "lucide-react";
import AgentChat from "@/components/AgentChat";
import { Navbar } from "@/components/Navbar";
import { fetchDisputes, resolveDispute, adminHeaders } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
const ADMIN_WALLETS = [
  process.env.NEXT_PUBLIC_SERVICE_WALLET_ADDRESS,
  process.env.NEXT_PUBLIC_SERVICE_WALLET_ADDRESS_2,
].filter(Boolean).map(a => a!.toLowerCase());

function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if connected wallet is a seller/admin wallet
  const isAdminWallet = isConnected && !!address && ADMIN_WALLETS.includes(address.toLowerCase());

  // Clear session when wallet disconnects or changes
  useEffect(() => {
    if (!isConnected || !isAdminWallet) {
      setAdminSession(null);
      setIsAuthenticated(false);
    }
  }, [isConnected, isAdminWallet]);

  const authenticate = useCallback(async () => {
    if (!address) return;
    setIsAuthenticating(true);
    setAuthError("");

    try {
      // 1. Request challenge nonce
      const challenge = await requestAdminChallenge(address);
      if ("error" in challenge) {
        setAuthError(challenge.error);
        setIsAuthenticating(false);
        return;
      }

      // 2. Sign the challenge message with the wallet
      const signature = await signMessageAsync({ message: challenge.message });

      // 3. Submit signature to get session token
      const result = await verifyAdminSignature(address, signature);
      if ("error" in result) {
        setAuthError(result.error);
        setIsAuthenticating(false);
        return;
      }

      setAdminSession(result.token);
      setIsAuthenticated(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      // User rejected the signature request
      if (msg.includes("User rejected") || msg.includes("denied")) {
        setAuthError("Signature request was rejected");
      } else {
        setAuthError(msg);
      }
    }
    setIsAuthenticating(false);
  }, [address, signMessageAsync]);

  if (!isConnected) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="max-w-md mx-auto px-6 py-20 text-center">
          <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/60 p-10">
            <Wallet className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-3">Admin Authentication</h2>
            <p className="text-gray-400 text-sm mb-6">
              Connect the seller wallet to access the admin dashboard.
            </p>
            <ConnectKitButton />
          </div>
        </main>
      </div>
    );
  }

  if (!isAdminWallet) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="max-w-md mx-auto px-6 py-20 text-center">
          <div className="rounded-2xl border border-red-700/50 bg-[#0F2744]/60 p-10">
            <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-3">Not Authorized</h2>
            <p className="text-gray-400 text-sm mb-2">
              Connected wallet is not the seller admin.
            </p>
            <p className="text-gray-500 text-xs font-mono mb-6 break-all">
              {address}
            </p>
            <ConnectKitButton />
          </div>
        </main>
      </div>
    );
  }

  if (!isAuthenticated || !getAdminSession()) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="max-w-md mx-auto px-6 py-20 text-center">
          <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/60 p-10">
            <Lock className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-3">Sign to Continue</h2>
            <p className="text-gray-400 text-sm mb-6">
              Sign a message with your wallet to authenticate as the seller admin.
            </p>
            {authError && (
              <p className="text-red-400 text-sm mb-4">{authError}</p>
            )}
            <button
              onClick={authenticate}
              disabled={isAuthenticating}
              className="px-6 py-2.5 rounded-lg bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
            >
              {isAuthenticating ? "Signing..." : "Sign Message"}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}

export default function AdminPage() {
  const queryClient = useQueryClient();

  // ─── Add Endpoint form state ───
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEndpoint, setNewEndpoint] = useState({ path: "", price: "", description: "", escrow_duration: "" });
  const [addStatus, setAddStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // ─── Dispute resolution state ───
  const [resolveNotes, setResolveNotes] = useState<Record<string, string>>({});
  const [resolveLoading, setResolveLoading] = useState<string | null>(null);
  const [resolveResult, setResolveResult] = useState<{ id: string; type: "success" | "error"; msg: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ id: string; action: "approved" | "rejected"; invoiceId: string } | null>(null);

  // ─── API Key management state ───
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [newKey, setNewKey] = useState({ label: "", ownerId: "", rateLimit: "60" });
  const [keyStatus, setKeyStatus] = useState<{ type: "success" | "error"; msg: string; key?: string } | null>(null);
  const [keyToggleLoading, setKeyToggleLoading] = useState<string | null>(null);

  // ─── Agent control state ───
  const [agentAddress, setAgentAddress] = useState("");
  const [agentStatus, setAgentStatus] = useState<{ paused: boolean; reason?: string; address?: string } | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [pauseReason, setPauseReason] = useState("");

  const handleResolveDispute = async (id: string, resolution: "approved" | "rejected", note?: string) => {
    setResolveLoading(id);
    setResolveResult(null);
    setConfirmModal(null);
    try {
      const res = await resolveDispute(id, resolution, note);
      if (res.error) {
        setResolveResult({ id, type: "error", msg: res.error + (res.details ? `: ${res.details}` : "") });
      } else {
        setResolveResult({
          id,
          type: "success",
          msg: resolution === "approved"
            ? `Refund issued on-chain${res.refundTxHash ? ` (tx: ${res.refundTxHash.slice(0, 10)}...)` : ""}`
            : "Dispute rejected",
        });
        queryClient.invalidateQueries({ queryKey: ["disputes"] });
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
      }
    } catch (err) {
      setResolveResult({ id, type: "error", msg: "Failed to reach API" });
    }
    setResolveLoading(null);
  };

  // ─── Reactive session tracking ───
  const [sessionVersion, setSessionVersion] = useState(0);
  useEffect(() => {
    return onSessionChange(() => setSessionVersion((v) => v + 1));
  }, []);
  const hasSession = !!getAdminSession();

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => apiFetch("/admin/analytics"),
    refetchInterval: 15000,
    enabled: hasSession,
  });

  const { data: pricing, isLoading: pricingLoading } = useQuery({
    queryKey: ["pricing"],
    queryFn: () => apiFetch("/admin/pricing"),
    enabled: hasSession,
  });

  const { data: facilitator } = useQuery({
    queryKey: ["facilitator"],
    queryFn: () => apiFetch("/admin/facilitator"),
    refetchInterval: 30000,
    enabled: hasSession,
  });

  const { data: disputesData } = useQuery({
    queryKey: ["disputes"],
    queryFn: () => fetchDisputes(),
    refetchInterval: 15000,
    enabled: hasSession,
  });

  const { data: apiKeysData } = useQuery({
    queryKey: ["apiKeys"],
    queryFn: () => apiFetch("/admin/keys"),
    refetchInterval: 15000,
    enabled: hasSession,
  });

  // ─── Escrow management ───
  const [releaseLoading, setReleaseLoading] = useState<string | null>(null);
  const [releaseResult, setReleaseResult] = useState<{ id: string; type: "success" | "error"; msg: string } | null>(null);
  const [releaseModal, setReleaseModal] = useState<{ id: string; endpoint: string; amount: string; token?: string; payer?: string; escrowReleased?: boolean } | null>(null);

  const { data: escrowData } = useQuery({
    queryKey: ["escrow-invoices"],
    queryFn: () => apiFetch<{ invoices: Array<{ id: string; endpoint: string; amount: string; token?: string; payer?: string; tx_hash?: string; created_at: string; paid_at?: string; release_at?: string; escrow_remaining_ms?: number; escrow_released?: boolean }> }>("/invoices?status=paid"),
    refetchInterval: 15000,
    enabled: hasSession,
  });

  const escrowInvoices = (escrowData?.data as { invoices: Array<{ id: string; endpoint: string; amount: string; token?: string; payer?: string; tx_hash?: string; created_at: string; paid_at?: string; release_at?: string; escrow_remaining_ms?: number; escrow_released?: boolean }> })?.invoices ?? [];

  const escrowTotal = escrowInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);

  function escrowTokenSymbol(address?: string): string {
    if (!address) return "USDT0";
    const known: Record<string, string> = {
      "0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff": "USDT0",
      "0x70bfd7f7eadf9b9827541272589a6b2bb760ae2e": "CNHT0",
      "0x15964435f2d3e500407e234b750bc2d4027996cd": "USDT0",
      "0x91de8a02c4e85b4b7cab8c13f71a5272e4ef9b11": "USDT0",
    };
    return known[address.toLowerCase()] ?? "USDT0";
  }

  function formatTimeRemaining(ms: number): string {
    if (ms <= 0) return "Ready";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return "<1m";
  }

  const handleRelease = async (invoiceId: string) => {
    setReleaseLoading(invoiceId);
    setReleaseResult(null);
    try {
      const res = await fetch(`${API_BASE}/invoices/${invoiceId}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
      });
      const data = await res.json();
      if (data.invoice?.status === "released") {
        setReleaseResult({ id: invoiceId, type: "success", msg: `Released${data.invoice.tx_hash ? ` (tx: ${data.invoice.tx_hash.slice(0, 10)}...)` : ""}` });
        queryClient.invalidateQueries({ queryKey: ["escrow-invoices"] });
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
      } else {
        setReleaseResult({ id: invoiceId, type: "error", msg: data.error || "Release failed" });
      }
    } catch {
      setReleaseResult({ id: invoiceId, type: "error", msg: "Could not reach API" });
    }
    setReleaseLoading(null);
  };

  const apiKeys = (apiKeysData?.data as { keys: Array<{
    id: string;
    label: string;
    owner_id: string;
    rate_limit: number;
    enabled: boolean;
    created_at: string;
  }> })?.keys ?? [];

  const disputes = (disputesData as { disputes: Array<{
    id: string;
    invoice_id: string;
    requester: string;
    reason: string;
    status: string;
    admin_note?: string;
    created_at: string;
    resolved_at?: string;
  }> })?.disputes ?? [];

  const gasInfo = facilitator?.data as {
    address: string;
    balanceCfx: string;
    lowBalance: boolean;
  } | undefined;

  const stats = analytics?.data as {
    totalRequests: number;
    totalRevenue: string;
    endpointStats: Array<{
      endpoint: string;
      requests: number;
      successful: number;
      avg_response_ms: number;
    }>;
  } | undefined;

  const prices = (pricing?.data as { pricing: Array<{
    endpoint: string;
    price: string;
    tier: string;
    description: string;
    escrow_duration?: number;
  }> })?.pricing ?? [];

  const statCards = [
    {
      label: "Total Requests",
      value: stats?.totalRequests ?? "—",
      icon: BarChart3,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Total Revenue",
      value: stats?.totalRevenue
        ? (Number(stats.totalRevenue) / 1e6).toFixed(2) + " USDT0"
        : "—",
      icon: DollarSign,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Priced Endpoints",
      value: prices.length,
      icon: Key,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <AdminAuthGate>
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Summary cards */}
        <div className="grid gap-5 md:grid-cols-3 mb-12">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/60 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-400">{card.label}</span>
                  <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                    <Icon size={16} className={card.color} />
                  </div>
                </div>
                {analyticsLoading && card.value === "—" ? (
                  <div className="h-9 w-24 bg-gray-700/50 rounded-lg animate-pulse" />
                ) : (
                  <p className="text-3xl font-bold text-white">{card.value}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Gas Monitor */}
        {gasInfo && (
          <div className={`rounded-2xl border p-5 mb-12 flex items-center gap-4 ${
            gasInfo.lowBalance
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-gray-700/50 bg-[#0F2744]/60"
          }`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              gasInfo.lowBalance ? "bg-amber-500/15" : "bg-emerald-500/10"
            }`}>
              <Fuel size={18} className={gasInfo.lowBalance ? "text-amber-400" : "text-emerald-400"} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Facilitator Gas Balance</span>
                {gasInfo.lowBalance && (
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <AlertTriangle size={12} /> Low balance
                  </span>
                )}
              </div>
              <p className="text-xl font-bold text-white font-mono">{gasInfo.balanceCfx} <span className="text-sm text-gray-400 font-sans">CFX</span></p>
            </div>
            <code className="text-xs text-gray-500 font-mono hidden md:block">
              {gasInfo.address?.slice(0, 6)}...{gasInfo.address?.slice(-4)}
            </code>
          </div>
        )}

        {/* Escrow Management */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-amber-500 rounded-full" />
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Lock size={18} className="text-amber-400" /> Escrowed Funds
              </h2>
              {escrowInvoices.length > 0 && (
                <span className="text-xs bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-medium">
                  {escrowInvoices.length} active
                </span>
              )}
            </div>
            {escrowTotal > 0 && (
              <div className="text-right">
                <span className="text-xs text-gray-400">Total escrowed</span>
                <p className="font-mono text-lg font-bold text-amber-400">{(escrowTotal / 1e6).toFixed(2)} <span className="text-sm text-gray-400 font-sans">tokens</span></p>
              </div>
            )}
          </div>

          {escrowInvoices.length === 0 ? (
            <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/40 p-8 text-center">
              <Unlock size={24} className="text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No funds currently in escrow</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/40 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700/50">
                    <th className="text-left py-3 px-5 font-medium">Endpoint</th>
                    <th className="text-right py-3 px-5 font-medium">Amount</th>
                    <th className="text-left py-3 px-5 font-medium">Payer</th>
                    <th className="text-left py-3 px-5 font-medium">Tx Hash</th>
                    <th className="text-center py-3 px-5 font-medium">Time Left</th>
                    <th className="text-left py-3 px-5 font-medium">Paid At</th>
                    <th className="text-center py-3 px-5 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {escrowInvoices.map((inv) => {
                    const symbol = escrowTokenSymbol(inv.token);
                    const remaining = inv.escrow_remaining_ms ?? 0;
                    const canRelease = inv.escrow_released || remaining <= 0;
                    return (
                      <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-5">
                          <code className="text-xs font-mono text-gray-300 bg-gray-800/50 px-2 py-0.5 rounded">
                            {inv.endpoint}
                          </code>
                        </td>
                        <td className="py-3 px-5 text-right">
                          <span className="font-mono text-white">{(Number(inv.amount) / 1e6).toFixed(2)}</span>
                          <span className="text-gray-500 text-xs ml-1">{symbol}</span>
                        </td>
                        <td className="py-3 px-5 font-mono text-xs text-gray-400">
                          {inv.payer ? `${inv.payer.slice(0, 6)}...${inv.payer.slice(-4)}` : "—"}
                        </td>
                        <td className="py-3 px-5 font-mono text-xs">
                          {inv.tx_hash ? (
                            <a
                              href={`https://evm.confluxscan.io/tx/${inv.tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-conflux-teal hover:text-conflux-teal/80 transition-colors"
                            >
                              {inv.tx_hash.slice(0, 8)}...{inv.tx_hash.slice(-6)}
                              <ExternalLink size={10} />
                            </a>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-5 text-center">
                          {canRelease ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                              <Unlock size={10} /> Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                              <Timer size={10} /> {formatTimeRemaining(remaining)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-5 text-gray-400 text-xs">
                          {inv.paid_at ? new Date(inv.paid_at).toLocaleString() : "—"}
                        </td>
                        <td className="py-3 px-5 text-center">
                          <button
                            onClick={() => setReleaseModal({ id: inv.id, endpoint: inv.endpoint, amount: inv.amount, token: inv.token, payer: inv.payer, escrowReleased: canRelease })}
                            disabled={releaseLoading === inv.id}
                            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors border ${
                              canRelease
                                ? "text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20"
                                : "text-amber-400 hover:bg-amber-500/10 border-amber-500/20"
                            } disabled:opacity-50`}
                            title={canRelease ? "Release funds to seller" : "Force release (escrow period not complete)"}
                          >
                            {releaseLoading === inv.id ? "..." : <><Unlock size={12} /> Release</>}
                          </button>
                          {releaseResult?.id === inv.id && (
                            <p className={`text-[10px] mt-1 ${releaseResult.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                              {releaseResult.msg}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pricing table */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-conflux-teal rounded-full" />
              <h2 className="text-lg font-semibold text-white">Endpoint Pricing</h2>
            </div>
            <button
              onClick={() => { setShowAddForm(!showAddForm); setAddStatus(null); }}
              className="flex items-center gap-1.5 text-sm text-conflux-teal hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 border border-conflux-teal/30"
            >
              <Plus size={14} /> Add Endpoint
            </button>
          </div>

          {/* Add endpoint form */}
          {showAddForm && (
            <div className="rounded-2xl border border-conflux-teal/20 bg-[#0F2744]/60 p-5 mb-5">
              <div className="grid gap-4 md:grid-cols-5">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Endpoint Path</label>
                  <input
                    type="text"
                    placeholder="/api/my-endpoint"
                    value={newEndpoint.path}
                    onChange={(e) => setNewEndpoint({ ...newEndpoint, path: e.target.value })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-conflux-teal"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Price (USDT0)</label>
                  <input
                    type="number"
                    placeholder="0.10"
                    step="0.01"
                    min="0.01"
                    value={newEndpoint.price}
                    onChange={(e) => setNewEndpoint({ ...newEndpoint, price: e.target.value })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-conflux-teal"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="What this endpoint does"
                    value={newEndpoint.description}
                    onChange={(e) => setNewEndpoint({ ...newEndpoint, description: e.target.value })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-conflux-teal"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Escrow (seconds)</label>
                  <input
                    type="number"
                    placeholder="0"
                    step="1"
                    min="0"
                    max="2592000"
                    value={newEndpoint.escrow_duration}
                    onChange={(e) => setNewEndpoint({ ...newEndpoint, escrow_duration: e.target.value })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-conflux-teal"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={async () => {
                      setAddStatus(null);
                      if (!newEndpoint.path.startsWith("/")) {
                        setAddStatus({ type: "error", msg: "Path must start with /" });
                        return;
                      }
                      const priceNum = parseFloat(newEndpoint.price);
                      if (!priceNum || priceNum <= 0) {
                        setAddStatus({ type: "error", msg: "Price must be > 0" });
                        return;
                      }
                      const priceUnits = String(Math.round(priceNum * 1e6));
                      const escrowSec = newEndpoint.escrow_duration ? parseInt(newEndpoint.escrow_duration) : 0;
                      try {
                        const res = await fetch(`${API_BASE}/admin/pricing${newEndpoint.path}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json", ...adminHeaders() },
                          body: JSON.stringify({ price: priceUnits, description: newEndpoint.description, tier: "premium", escrow_duration: escrowSec }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setAddStatus({ type: "success", msg: `Added ${newEndpoint.path}` });
                          setNewEndpoint({ path: "", price: "", description: "", escrow_duration: "" });
                          queryClient.invalidateQueries({ queryKey: ["pricing"] });
                        } else {
                          setAddStatus({ type: "error", msg: data.error || "Failed" });
                        }
                      } catch {
                        setAddStatus({ type: "error", msg: "Could not reach API" });
                      }
                    }}
                    className="w-full px-4 py-2 rounded-lg bg-conflux-teal/15 text-conflux-teal text-sm font-medium hover:bg-conflux-teal/25 transition-colors border border-conflux-teal/20"
                  >
                    Save
                  </button>
                </div>
              </div>
              {addStatus && (
                <p className={`text-xs mt-3 ${addStatus.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                  {addStatus.msg}
                </p>
              )}
            </div>
          )}
          <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/40 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700/50">
                  <th className="text-left py-3 px-5 font-medium">Endpoint</th>
                  <th className="text-right py-3 px-5 font-medium">Price</th>
                  <th className="text-right py-3 px-5 font-medium">Escrow</th>
                  <th className="text-left py-3 px-5 font-medium">Tier</th>
                  <th className="text-left py-3 px-5 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {pricingLoading && prices.length === 0 && (
                  <>
                    {[1, 2].map((i) => (
                      <tr key={i}>
                        <td className="py-3 px-5"><div className="h-5 w-32 bg-gray-700/50 rounded animate-pulse" /></td>
                        <td className="py-3 px-5 text-right"><div className="h-5 w-16 bg-gray-700/50 rounded animate-pulse ml-auto" /></td>
                        <td className="py-3 px-5 text-right"><div className="h-5 w-12 bg-gray-700/50 rounded animate-pulse ml-auto" /></td>
                        <td className="py-3 px-5"><div className="h-5 w-16 bg-gray-700/50 rounded-full animate-pulse" /></td>
                        <td className="py-3 px-5"><div className="h-5 w-48 bg-gray-700/50 rounded animate-pulse" /></td>
                      </tr>
                    ))}
                  </>
                )}
                {prices.map((p) => (
                  <tr key={p.endpoint} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-5">
                      <code className="text-xs font-mono text-gray-300 bg-gray-800/50 px-2 py-0.5 rounded">
                        {p.endpoint}
                      </code>
                    </td>
                    <td className="py-3 px-5 text-right">
                      <span className="font-mono text-white">{(Number(p.price) / 1e6).toFixed(2)}</span>
                      <span className="text-gray-500 text-xs ml-1">USDT0</span>
                    </td>
                    <td className="py-3 px-5 text-right">
                      <span className="font-mono text-white">
                        {p.escrow_duration === 0 ? "instant" : p.escrow_duration != null
                          ? p.escrow_duration >= 3600 ? `${(p.escrow_duration / 3600).toFixed(0)}h` : `${p.escrow_duration}s`
                          : "default"}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        p.tier === "premium"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-emerald-500/10 text-emerald-400"
                      }`}>
                        {p.tier}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-gray-400">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Endpoint stats */}
        {stats?.endpointStats && stats.endpointStats.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-5">
              <div className="w-1 h-6 bg-conflux-teal rounded-full" />
              <h2 className="text-lg font-semibold text-white">Endpoint Usage</h2>
            </div>
            <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/40 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700/50">
                    <th className="text-left py-3 px-5 font-medium">Endpoint</th>
                    <th className="text-right py-3 px-5 font-medium">Requests</th>
                    <th className="text-right py-3 px-5 font-medium">Successful</th>
                    <th className="text-right py-3 px-5 font-medium">Avg Response</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {stats.endpointStats.map((s) => (
                    <tr key={s.endpoint} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-5">
                        <code className="text-xs font-mono text-gray-300 bg-gray-800/50 px-2 py-0.5 rounded">
                          {s.endpoint}
                        </code>
                      </td>
                      <td className="py-3 px-5 text-right font-mono text-white">{s.requests}</td>
                      <td className="py-3 px-5 text-right font-mono text-emerald-400">{s.successful}</td>
                      <td className="py-3 px-5 text-right font-mono text-gray-400">{Math.round(s.avg_response_ms)}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* API Key Management */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-conflux-teal rounded-full" />
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Key size={18} className="text-conflux-teal" /> API Keys
              </h2>
              <span className="text-xs text-gray-500">{apiKeys.length} key{apiKeys.length !== 1 ? "s" : ""}</span>
            </div>
            <button
              onClick={() => { setShowKeyForm(!showKeyForm); setKeyStatus(null); }}
              className="flex items-center gap-1.5 text-sm text-conflux-teal hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 border border-conflux-teal/30"
            >
              <Plus size={14} /> New Key
            </button>
          </div>

          {showKeyForm && (
            <div className="rounded-2xl border border-conflux-teal/20 bg-[#0F2744]/60 p-5 mb-5">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Label</label>
                  <input
                    type="text"
                    placeholder="e.g. mobile-app"
                    value={newKey.label}
                    onChange={(e) => setNewKey({ ...newKey, label: e.target.value })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-conflux-teal"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Owner ID (optional)</label>
                  <input
                    type="text"
                    placeholder="user or team id"
                    value={newKey.ownerId}
                    onChange={(e) => setNewKey({ ...newKey, ownerId: e.target.value })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-conflux-teal"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Rate Limit (req/min)</label>
                  <input
                    type="number"
                    placeholder="60"
                    min="1"
                    value={newKey.rateLimit}
                    onChange={(e) => setNewKey({ ...newKey, rateLimit: e.target.value })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-conflux-teal"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={async () => {
                      setKeyStatus(null);
                      if (!newKey.label.trim()) {
                        setKeyStatus({ type: "error", msg: "Label is required" });
                        return;
                      }
                      try {
                        const res = await fetch(`${API_BASE}/admin/keys`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", ...adminHeaders() },
                          body: JSON.stringify({ label: newKey.label, ownerId: newKey.ownerId || undefined, rateLimit: parseInt(newKey.rateLimit) || 60 }),
                        });
                        const data = await res.json();
                        if (data.apiKey) {
                          setKeyStatus({ type: "success", msg: "Key created — copy it now, it won't be shown again.", key: data.apiKey.key });
                          setNewKey({ label: "", ownerId: "", rateLimit: "60" });
                          queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
                        } else {
                          setKeyStatus({ type: "error", msg: data.error || "Failed to create key" });
                        }
                      } catch {
                        setKeyStatus({ type: "error", msg: "Could not reach API" });
                      }
                    }}
                    className="w-full px-4 py-2 rounded-lg bg-conflux-teal/15 text-conflux-teal text-sm font-medium hover:bg-conflux-teal/25 transition-colors border border-conflux-teal/20"
                  >
                    Generate
                  </button>
                </div>
              </div>
              {keyStatus && (
                <div className={`mt-3 ${keyStatus.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                  <p className="text-xs">{keyStatus.msg}</p>
                  {keyStatus.key && (
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-xs font-mono bg-gray-800/80 px-3 py-1.5 rounded-lg text-white select-all break-all">
                        {keyStatus.key}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(keyStatus.key!)}
                        className="text-gray-400 hover:text-white transition-colors p-1"
                        title="Copy to clipboard"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/40 overflow-hidden">
            {apiKeys.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 text-sm">No API keys created yet</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700/50">
                    <th className="text-left py-3 px-5 font-medium">Label</th>
                    <th className="text-left py-3 px-5 font-medium">Owner</th>
                    <th className="text-right py-3 px-5 font-medium">Rate Limit</th>
                    <th className="text-center py-3 px-5 font-medium">Status</th>
                    <th className="text-left py-3 px-5 font-medium">Created</th>
                    <th className="text-center py-3 px-5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {apiKeys.map((k) => (
                    <tr key={k.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-5">
                        <span className="text-white font-medium">{k.label || "—"}</span>
                        <code className="block text-[10px] text-gray-600 font-mono mt-0.5">{k.id.slice(0, 8)}...</code>
                      </td>
                      <td className="py-3 px-5 text-gray-400 text-xs">{k.owner_id || "—"}</td>
                      <td className="py-3 px-5 text-right font-mono text-white">{k.rate_limit}<span className="text-gray-500 text-xs ml-1">/min</span></td>
                      <td className="py-3 px-5 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                          k.enabled ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                        }`}>
                          {k.enabled ? <Check size={10} /> : <X size={10} />}
                          {k.enabled ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-gray-400 text-xs">
                        {new Date(k.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-5 text-center">
                        <button
                          disabled={keyToggleLoading === k.id}
                          onClick={async () => {
                            setKeyToggleLoading(k.id);
                            try {
                              await fetch(`${API_BASE}/admin/keys/${k.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", ...adminHeaders() },
                                body: JSON.stringify({ enabled: !k.enabled }),
                              });
                              queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
                            } catch { /* ignore */ }
                            setKeyToggleLoading(null);
                          }}
                          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                            k.enabled
                              ? "text-red-400 hover:bg-red-500/10 border border-red-500/20"
                              : "text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20"
                          }`}
                          title={k.enabled ? "Disable this key" : "Enable this key"}
                        >
                          {k.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          {keyToggleLoading === k.id ? "..." : k.enabled ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Disputes */}
        <div className="mt-12">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-6 bg-amber-500 rounded-full" />
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <ShieldAlert size={18} className="text-amber-400" /> Disputes
            </h2>
            {disputes.filter((d) => d.status === "open").length > 0 && (
              <span className="text-xs bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-medium">
                {disputes.filter((d) => d.status === "open").length} open
              </span>
            )}
          </div>
          {disputes.length === 0 ? (
            <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/40 p-8 text-center">
              <p className="text-gray-500 text-sm">No disputes filed yet</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/40 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700/50">
                    <th className="text-left py-3 px-5 font-medium">Status</th>
                    <th className="text-left py-3 px-5 font-medium">Invoice</th>
                    <th className="text-left py-3 px-5 font-medium">Requester</th>
                    <th className="text-left py-3 px-5 font-medium">Reason</th>
                    <th className="text-left py-3 px-5 font-medium">Filed</th>
                    <th className="text-left py-3 px-5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {disputes.map((d) => (
                    <tr key={d.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                          d.status === "open"
                            ? "bg-amber-500/10 text-amber-400"
                            : d.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}>
                          {d.status === "open" ? <AlertTriangle size={12} /> : d.status === "approved" ? <Check size={12} /> : <X size={12} />}
                          {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <code className="text-xs font-mono text-gray-300 bg-gray-800/50 px-2 py-0.5 rounded">
                          {d.invoice_id.slice(0, 8)}...
                        </code>
                      </td>
                      <td className="py-3 px-5 font-mono text-xs text-gray-400">
                        {d.requester.slice(0, 6)}...{d.requester.slice(-4)}
                      </td>
                      <td className="py-3 px-5 text-gray-300 text-xs max-w-[200px] truncate" title={d.reason}>
                        {d.reason}
                      </td>
                      <td className="py-3 px-5 text-gray-400 text-xs">
                        {new Date(d.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-5">
                        {d.status === "open" ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Note (optional)"
                              value={resolveNotes[d.id] || ""}
                              onChange={(e) => setResolveNotes({ ...resolveNotes, [d.id]: e.target.value })}
                              className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500/50 w-28"
                            />
                            <button
                              disabled={resolveLoading === d.id}
                              onClick={() => setConfirmModal({ id: d.id, action: "approved", invoiceId: d.invoice_id })}
                              className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded hover:bg-emerald-500/10 transition-colors"
                              title="Approve and refund on-chain"
                            >
                              <Check size={12} /> Refund
                            </button>
                            <button
                              disabled={resolveLoading === d.id}
                              onClick={() => setConfirmModal({ id: d.id, action: "rejected", invoiceId: d.invoice_id })}
                              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                              title="Reject dispute"
                            >
                              <X size={12} /> Reject
                            </button>
                            {resolveResult?.id === d.id && (
                              <span className={`text-xs ${resolveResult.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                                {resolveResult.msg}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">{d.admin_note || "—"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Agent Chat */}
        <div className="mt-12">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-6 bg-violet-500 rounded-full" />
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <MessageSquare size={18} className="text-violet-400" /> Agent Chat
            </h2>
          </div>
          <AgentChat />
        </div>

        {/* Agent Controls */}
        <div className="mt-12">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-6 bg-violet-500 rounded-full" />
            <h2 className="text-lg font-semibold text-white">Agent Controls</h2>
          </div>
          <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/40 p-6">
            <p className="text-xs text-gray-400 mb-4">
              Look up an AI agent by wallet address to check its status or pause/resume its spending.
            </p>
            <div className="flex items-center gap-3 mb-4">
              <Bot size={16} className="text-violet-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="0x... agent wallet address"
                value={agentAddress}
                onChange={(e) => setAgentAddress(e.target.value)}
                className="flex-1 bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-violet-500"
              />
              <button
                onClick={async () => {
                  if (!agentAddress) return;
                  setAgentLoading(true);
                  setAgentStatus(null);
                  try {
                    const res = await fetch(`${API_BASE}/admin/agent/${agentAddress}/status`, { headers: adminHeaders() });
                    const data = await res.json();
                    setAgentStatus(data);
                  } catch {
                    setAgentStatus(null);
                  }
                  setAgentLoading(false);
                }}
                disabled={agentLoading || !agentAddress}
                className="px-4 py-2 rounded-lg bg-violet-500/15 text-violet-400 text-sm font-medium hover:bg-violet-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-violet-500/20"
              >
                {agentLoading ? "Loading..." : "Look up"}
              </button>
            </div>

            {agentStatus && (
              <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${agentStatus.paused ? "bg-red-400" : "bg-emerald-400"}`} />
                    <span className="text-sm text-white font-medium">
                      {agentStatus.paused ? "Paused" : "Active"}
                    </span>
                    <code className="text-xs text-gray-500 font-mono">
                      {agentStatus.address?.slice(0, 6)}...{agentStatus.address?.slice(-4)}
                    </code>
                  </div>
                </div>
                {agentStatus.paused && agentStatus.reason && (
                  <p className="text-xs text-gray-400 mb-3">Reason: {agentStatus.reason}</p>
                )}
                <div className="flex items-center gap-3">
                  {agentStatus.paused ? (
                    <button
                      onClick={async () => {
                        setAgentLoading(true);
                        await fetch(`${API_BASE}/admin/agent/${agentAddress}/resume`, { method: "POST", headers: adminHeaders() });
                        const res = await fetch(`${API_BASE}/admin/agent/${agentAddress}/status`, { headers: adminHeaders() });
                        setAgentStatus(await res.json());
                        setAgentLoading(false);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-sm hover:bg-emerald-500/25 transition-colors border border-emerald-500/20"
                    >
                      <Play size={14} /> Resume
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Pause reason (optional)"
                        value={pauseReason}
                        onChange={(e) => setPauseReason(e.target.value)}
                        className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-red-500/50 w-56"
                      />
                      <button
                        onClick={async () => {
                          setAgentLoading(true);
                          await fetch(`${API_BASE}/admin/agent/${agentAddress}/pause`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", ...adminHeaders() },
                            body: JSON.stringify({ reason: pauseReason || undefined }),
                          });
                          const res = await fetch(`${API_BASE}/admin/agent/${agentAddress}/status`, { headers: adminHeaders() });
                          setAgentStatus(await res.json());
                          setPauseReason("");
                          setAgentLoading(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-sm hover:bg-red-500/25 transition-colors border border-red-500/20"
                      >
                        <Pause size={14} /> Pause
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ─── Release Confirmation Modal ─── */}
      {releaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0F2744] border border-gray-700/50 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <Unlock size={20} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Release Escrowed Funds</h3>
                <p className="text-xs text-gray-400">
                  This sends an on-chain transaction to release tokens from the escrow contract to the seller wallet.
                </p>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3 mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Endpoint</span>
                <code className="text-white font-mono">{releaseModal.endpoint}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Amount</span>
                <span className="text-white font-mono">{(Number(releaseModal.amount) / 1e6).toFixed(2)} {escrowTokenSymbol(releaseModal.token)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Payer</span>
                <span className="text-white font-mono">{releaseModal.payer ? `${releaseModal.payer.slice(0, 6)}...${releaseModal.payer.slice(-4)}` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Signed by</span>
                <span className="text-gray-300">Facilitator wallet (server-side)</span>
              </div>
            </div>

            {!releaseModal.escrowReleased && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg p-2.5 mb-4">
                <AlertTriangle size={14} className="flex-shrink-0" />
                <span>The escrow period has not passed yet. The smart contract will reject this release. There is no admin bypass for the escrow period, it protects buyers.</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-800/30 rounded-lg p-2.5 mb-4">
              <Lock size={14} className="flex-shrink-0 text-gray-500" />
              <span>The facilitator wallet (SERVICE_WALLET_KEY) signs this transaction server-side. No browser wallet signature is needed.</span>
            </div>

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setReleaseModal(null)}
                disabled={releaseLoading === releaseModal.id}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => { handleRelease(releaseModal.id); setReleaseModal(null); }}
                disabled={releaseLoading === releaseModal.id || !releaseModal.escrowReleased}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30"
              >
                {releaseLoading === releaseModal.id ? "Releasing..." : !releaseModal.escrowReleased ? "Escrow Active" : "Confirm Release"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Dispute Confirmation Modal ─── */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0F2744] border border-gray-700/50 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              {confirmModal.action === "approved" ? (
                <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <Check size={20} className="text-emerald-400" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center">
                  <X size={20} className="text-red-400" />
                </div>
              )}
              <div>
                <h3 className="text-white font-semibold">
                  {confirmModal.action === "approved" ? "Confirm On-Chain Refund" : "Reject Dispute"}
                </h3>
                <p className="text-xs text-gray-400">
                  {confirmModal.action === "approved"
                    ? "This will send an on-chain transaction to refund the escrowed tokens to the payer."
                    : "This will reject the dispute. No refund will be issued."}
                </p>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3 mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Dispute ID</span>
                <span className="text-white font-mono">{confirmModal.id.slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Invoice</span>
                <span className="text-white font-mono">{confirmModal.invoiceId.slice(0, 12)}...</span>
              </div>
              {confirmModal.action === "approved" && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Action</span>
                  <span className="text-emerald-400">Refund tokens to payer</span>
                </div>
              )}
            </div>

            {confirmModal.action === "approved" && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg p-2.5 mb-4">
                <AlertTriangle size={14} className="flex-shrink-0" />
                <span>The service wallet will send a refund transaction. This cannot be undone.</span>
              </div>
            )}

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setConfirmModal(null)}
                disabled={resolveLoading === confirmModal.id}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResolveDispute(confirmModal.id, confirmModal.action, resolveNotes[confirmModal.id])}
                disabled={resolveLoading === confirmModal.id}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                  confirmModal.action === "approved"
                    ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30"
                    : "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                }`}
              >
                {resolveLoading === confirmModal.id
                  ? "Processing..."
                  : confirmModal.action === "approved"
                    ? "Confirm Refund"
                    : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AdminAuthGate>
  );
}
