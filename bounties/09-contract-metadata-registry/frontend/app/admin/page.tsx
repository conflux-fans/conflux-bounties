"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Sidebar } from "@/components/sidebar";
import { LandingPage } from "@/components/landing-page";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/Button";
import { ShieldAlert, Check, X, Settings } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Submission {
  id: number;
  contractAddress: string;
  submitterAddress: string;
  rawMetadata: any;
  version: number;
  status: string;
  createdAt: string;
}

export default function AdminPage() {
  const { isConnected, address } = useAccount();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/submissions?status=submitted_onchain`);
      const data = await res.json();
      setSubmissions(data.data || []);
    } catch {
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) fetchPending();
  }, [isConnected]);

  const handleAction = async (id: number, action: "approve" | "reject") => {
    setActionLoading(id);
    try {
      const isReject = action === "reject";
      const headers: Record<string, string> = {
        "x-wallet-address": address || "",
      };
      if (isReject) headers["Content-Type"] = "application/json";

      const res = await fetch(`${API_URL}/api/admin/${action}/${id}`, {
        method: "POST",
        headers,
        body: isReject ? JSON.stringify({ reason: "Rejected by moderator" }) : undefined,
      });

      const data = await res.json();
      if (res.ok) {
        setSubmissions((prev) => prev.filter((s) => s.id !== id));
      } else {
        alert(`Failed to ${action}: ${data.error || res.statusText}`);
      }
    } catch (err) {
      console.error(`Failed to ${action}:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  if (!isConnected) return <LandingPage />;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center text-sm text-zinc-500">
            <ShieldAlert className="w-4 h-4 mr-2" />
            Moderation Panel
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" icon={<Settings className="w-4 h-4" />}>
              Settings
            </Button>
          </div>
        </header>

        <div className="p-6 md:p-12 max-w-6xl mx-auto space-y-6">
          <div className="border-b border-zinc-200 pb-6">
            <h2 className="text-2xl font-[family-name:var(--font-space-grotesk)] font-semibold text-zinc-900">
              Pending Submissions
            </h2>
            <p className="text-zinc-500 text-sm mt-1">
              Review and approve or reject contract metadata submissions.
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12 text-zinc-400">Loading...</div>
          ) : submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
              <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
              <p>No pending submissions.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-white border border-zinc-200 p-5 flex flex-col md:flex-row gap-4 items-start md:items-center"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold font-mono text-sm">
                        {sub.contractAddress.slice(0, 10)}...{sub.contractAddress.slice(-6)}
                      </h3>
                      <StatusBadge status={sub.status} />
                      <span className="text-xs text-zinc-400">#{sub.id}</span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      Submitted by {sub.submitterAddress.slice(0, 10)}... on{" "}
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-zinc-600">
                      {sub.rawMetadata?.name || "Unnamed"} — v{sub.version}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Check className="w-3 h-3" />}
                      disabled={actionLoading === sub.id}
                      onClick={() => handleAction(sub.id, "approve")}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:border-red-600 hover:bg-red-50"
                      icon={<X className="w-3 h-3" />}
                      disabled={actionLoading === sub.id}
                      onClick={() => handleAction(sub.id, "reject")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
