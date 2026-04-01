"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { apiFetch, submitDispute } from "@/lib/api";
import { CheckCircle, Clock, XCircle, Receipt, RotateCcw, ExternalLink, AlertTriangle, Lock, Unlock, Timer } from "lucide-react";

interface Invoice {
  id: string;
  endpoint: string;
  amount: string;
  token?: string;
  status: string;
  payer?: string;
  tx_hash?: string;
  created_at: string;
  paid_at?: string;
  release_at?: string;
  escrow_remaining_ms?: number;
  escrow_released?: boolean;
}

function tokenSymbol(address?: string): string {
  if (!address) return "USDT0";
  const known: Record<string, string> = {
    "0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff": "USDT0",
    "0x70bfd7f7eadf9b9827541272589a6b2bb760ae2e": "CNHT0",
    "0x15964435f2d3e500407e234b750bc2d4027996cd": "USDT0",
    "0x91de8a02c4e85b4b7cab8c13f71a5272e4ef9b11": "USDT0",
  };
  return known[address.toLowerCase()] ?? "USDT0";
}

type DisputeMsg = { type: "success" | "error"; msg: string } | null;

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "Ready";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "<1m";
}

function statusBadge(s: string) {
  if (s === "paid")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
        <Lock size={12} /> In Escrow
      </span>
    );
  if (s === "released")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
        <Unlock size={12} /> Released
      </span>
    );
  if (s === "refunded")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full">
        <RotateCcw size={12} /> Refunded
      </span>
    );
  if (s === "expired")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full">
        <XCircle size={12} /> Expired
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
      <Clock size={12} /> Pending
    </span>
  );
}

function EscrowTimer({ invoice }: { invoice: Invoice }) {
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    if (invoice.status !== "paid" || !invoice.release_at) return;
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [invoice.status, invoice.release_at]);

  if (invoice.status !== "paid" || !invoice.release_at) return null;

  const releaseAt = new Date(invoice.release_at).getTime();
  const remaining = Math.max(0, releaseAt - now);

  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
        <Unlock size={10} /> Ready to release
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-400" title={`Refund window closes ${new Date(invoice.release_at).toLocaleString()}`}>
      <Timer size={10} /> {formatTimeRemaining(remaining)} left
    </span>
  );
}

export function TransactionHistory() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const [disputeTarget, setDisputeTarget] = useState(null as string | null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeStatus, setDisputeStatus] = useState(null as DisputeMsg);
  const [disputeLoading, setDisputeLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => apiFetch<{ invoices: Invoice[] }>("/invoices?limit=20"),
    refetchInterval: 10000,
  });

  const invoices = ((data?.data as { invoices: Invoice[] })?.invoices ?? []).filter(
    (inv) => inv.status !== "pending"
  );

  const handleDispute = async (invoiceId: string) => {
    if (!address || !disputeReason.trim()) return;
    setDisputeLoading(true);
    setDisputeStatus(null);
    try {
      const res = await submitDispute(invoiceId, address, disputeReason.trim());
      if (res.dispute) {
        setDisputeStatus({ type: "success", msg: "Dispute submitted successfully" });
        setDisputeReason("");
        setTimeout(() => { setDisputeTarget(null); setDisputeStatus(null); }, 2000);
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
      } else {
        setDisputeStatus({ type: "error", msg: res.error || "Failed to submit dispute" });
      }
    } catch (_err) {
      setDisputeStatus({ type: "error", msg: "Could not reach API" });
    }
    setDisputeLoading(false);
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/40 p-8 text-center">
        <p className="text-gray-500 text-sm">Loading transactions...</p>
      </div>
    );
  }

  if (!invoices.length) {
    return (
      <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/40 p-12 text-center">
        <Receipt size={32} className="text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No transactions yet</p>
        <p className="text-gray-600 text-xs mt-1">Try calling a premium endpoint to see invoices here</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/40 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700/50">
              <th className="text-left py-3 px-5 font-medium">Status</th>
              <th className="text-left py-3 px-5 font-medium">Endpoint</th>
              <th className="text-right py-3 px-5 font-medium">Amount</th>
              <th className="text-left py-3 px-5 font-medium">Payer</th>
              <th className="text-left py-3 px-5 font-medium">Tx Hash</th>
              <th className="text-center py-3 px-5 font-medium">Escrow</th>
              <th className="text-right py-3 px-5 font-medium">Time</th>
              <th className="text-center py-3 px-5 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {invoices.map((inv) => (
              <React.Fragment key={inv.id}>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-5">{statusBadge(inv.status)}</td>
                  <td className="py-3 px-5">
                    <code className="text-xs font-mono text-gray-300 bg-gray-800/50 px-2 py-0.5 rounded">
                      {inv.endpoint}
                    </code>
                  </td>
                  <td className="py-3 px-5 text-right">
                    <span className="font-mono text-white">{(Number(inv.amount) / 1e6).toFixed(2)}</span>
                    <span className="text-gray-500 text-xs ml-1">{tokenSymbol(inv.token)}</span>
                  </td>
                  <td className="py-3 px-5 font-mono text-xs text-gray-400">
                    {inv.payer ? `${inv.payer.slice(0, 6)}...${inv.payer.slice(-4)}` : "\u2014"}
                  </td>
                  <td className="py-3 px-5 font-mono text-xs">
                    {inv.tx_hash ? (
                      <a
                        href={`https://evmtestnet.confluxscan.net/tx/${inv.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-conflux-teal hover:text-conflux-teal/80 transition-colors"
                      >
                        {inv.tx_hash.slice(0, 8)}...{inv.tx_hash.slice(-6)}
                        <ExternalLink size={10} />
                      </a>
                    ) : (
                      <span className="text-gray-600">{"\u2014"}</span>
                    )}
                  </td>
                  <td className="py-3 px-5 text-center">
                    <EscrowTimer invoice={inv} />
                  </td>
                  <td className="py-3 px-5 text-right text-gray-400 text-xs">
                    {new Date(inv.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-5 text-center">
                    {inv.status === "paid" && address && inv.payer?.toLowerCase() === address.toLowerCase() ? (
                      <button
                        onClick={() => { setDisputeTarget(disputeTarget === inv.id ? null : inv.id); setDisputeStatus(null); setDisputeReason(""); }}
                        className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors px-2 py-1 rounded hover:bg-amber-500/10"
                        title="Dispute this payment"
                      >
                        <AlertTriangle size={12} /> Dispute
                      </button>
                    ) : (
                      <span className="text-gray-700">{"\u2014"}</span>
                    )}
                  </td>
                </tr>
                {disputeTarget === inv.id && (
                  <tr>
                    <td colSpan={8} className="px-5 py-3 bg-amber-500/5 border-t border-amber-500/20">
                      <div className="flex items-center gap-3">
                        <textarea
                          placeholder="Describe the reason for your dispute..."
                          value={disputeReason}
                          onChange={(e) => setDisputeReason(e.target.value)}
                          rows={2}
                          className="flex-1 bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 resize-none"
                        />
                        <button
                          onClick={() => handleDispute(inv.id)}
                          disabled={disputeLoading || !disputeReason.trim()}
                          className="px-4 py-2 rounded-lg bg-amber-500/15 text-amber-400 text-sm font-medium hover:bg-amber-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-amber-500/20 whitespace-nowrap"
                        >
                          {disputeLoading ? "Submitting..." : "Submit Dispute"}
                        </button>
                        <button
                          onClick={() => { setDisputeTarget(null); setDisputeStatus(null); }}
                          className="text-gray-500 hover:text-gray-300 text-sm px-2 py-1"
                        >
                          Cancel
                        </button>
                      </div>
                      {disputeStatus && (
                        <p className={`text-xs mt-2 ${disputeStatus.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                          {disputeStatus.msg}
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
