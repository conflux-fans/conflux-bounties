"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { ArrowLeft, BarChart3, Key, DollarSign, Download, Plus, Bot, Pause, Play, MessageSquare, Fuel, AlertTriangle, ShieldAlert, Check, X } from "lucide-react";
import AgentChat from "@/components/AgentChat";
import { NetworkBadge } from "@/components/NetworkBadge";
import { fetchDisputes, resolveDispute, adminHeaders } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export default function AdminPage() {
  const queryClient = useQueryClient();

  // ─── Add Endpoint form state ───
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEndpoint, setNewEndpoint] = useState({ path: "", price: "", description: "" });
  const [addStatus, setAddStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // ─── Dispute resolution state ───
  const [resolveNotes, setResolveNotes] = useState<Record<string, string>>({});
  const [resolveLoading, setResolveLoading] = useState<string | null>(null);

  // ─── Agent control state ───
  const [agentAddress, setAgentAddress] = useState("");
  const [agentStatus, setAgentStatus] = useState<{ paused: boolean; reason?: string; address?: string } | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [pauseReason, setPauseReason] = useState("");

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => apiFetch("/admin/analytics"),
    refetchInterval: 15000,
  });

  const { data: pricing, isLoading: pricingLoading } = useQuery({
    queryKey: ["pricing"],
    queryFn: () => apiFetch("/admin/pricing"),
  });

  const { data: facilitator } = useQuery({
    queryKey: ["facilitator"],
    queryFn: () => apiFetch("/admin/facilitator"),
    refetchInterval: 30000,
  });

  const { data: disputesData } = useQuery({
    queryKey: ["disputes"],
    queryFn: () => fetchDisputes(),
    refetchInterval: 15000,
  });

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
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 glass">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors px-2 py-1 -ml-2 rounded-lg hover:bg-white/5"
          >
            <ArrowLeft size={16} /> Back
          </Link>
          <div className="h-5 w-px bg-gray-700" />
          <h1 className="text-lg font-bold text-white">Admin Dashboard</h1>
          <div className="flex-1" />
          <NetworkBadge />
          <a
            href={`${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000"}/admin/analytics/export`}
            download
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 border border-gray-700/50"
          >
            <Download size={14} /> Export CSV
          </a>
        </div>
      </header>

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
              <div className="grid gap-4 md:grid-cols-4">
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
                      try {
                        const res = await fetch(`${API_BASE}/admin/pricing${newEndpoint.path}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json", ...adminHeaders() },
                          body: JSON.stringify({ price: priceUnits, description: newEndpoint.description, tier: "premium" }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setAddStatus({ type: "success", msg: `Added ${newEndpoint.path}` });
                          setNewEndpoint({ path: "", price: "", description: "" });
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
                              onClick={async () => {
                                setResolveLoading(d.id);
                                await resolveDispute(d.id, "approved", resolveNotes[d.id]);
                                queryClient.invalidateQueries({ queryKey: ["disputes"] });
                                queryClient.invalidateQueries({ queryKey: ["invoices"] });
                                queryClient.invalidateQueries({ queryKey: ["analytics"] });
                                setResolveLoading(null);
                              }}
                              className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded hover:bg-emerald-500/10 transition-colors"
                              title="Approve and refund"
                            >
                              <Check size={12} /> Refund
                            </button>
                            <button
                              disabled={resolveLoading === d.id}
                              onClick={async () => {
                                setResolveLoading(d.id);
                                await resolveDispute(d.id, "rejected", resolveNotes[d.id]);
                                queryClient.invalidateQueries({ queryKey: ["disputes"] });
                                setResolveLoading(null);
                              }}
                              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                              title="Reject dispute"
                            >
                              <X size={12} /> Reject
                            </button>
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
    </div>
  );
}
