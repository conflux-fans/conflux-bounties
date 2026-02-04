"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { Sidebar } from "@/components/sidebar";
import { LandingPage } from "@/components/landing-page";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/Button";
import {
  Copy,
  ExternalLink,
  FileJson,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ContractData {
  contractAddress: string;
  metadata: any;
  metadataCid: string | null;
  contentHash: string | null;
  version: number;
  updatedAt: string;
}

export default function ContractDetailPage() {
  const { address } = useParams<{ address: string }>();
  const { isConnected } = useAccount();
  const [data, setData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [abiOpen, setAbiOpen] = useState(false);

  useEffect(() => {
    if (!address) return;
    fetch(`${API_URL}/api/contracts/${address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [address]);

  if (!isConnected) return <LandingPage />;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center px-8 sticky top-0 z-20">
          <Link href="/" className="flex items-center text-sm text-zinc-500 hover:text-black">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Registry
          </Link>
        </header>

        <div className="p-6 md:p-12 max-w-4xl mx-auto">
          {loading ? (
            <div className="text-center py-12 text-zinc-400">Loading...</div>
          ) : !data ? (
            <div className="text-center py-12 text-zinc-400">
              <p>No approved metadata found for this contract.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Header */}
              <div className="bg-white border border-zinc-200 p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-[family-name:var(--font-space-grotesk)] font-bold">
                    {data.metadata?.name || address}
                  </h1>
                  <StatusBadge status="approved" />
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 bg-zinc-50 p-2 w-fit border border-zinc-100">
                  <span className="select-all">{data.contractAddress}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(data.contractAddress)}
                    className="hover:text-black"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <a
                    href={`https://evmtestnet.confluxscan.io/address/${data.contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-black"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <p className="text-zinc-600 text-sm">
                  {data.metadata?.description || "No description."}
                </p>

                {data.metadata?.tags && (
                  <div className="flex gap-2">
                    {data.metadata.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="text-xs bg-zinc-100 text-zinc-600 px-2 py-1 border border-zinc-200"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Version", value: data.version },
                  {
                    label: "Compiler",
                    value: data.metadata?.compiler
                      ? `${data.metadata.compiler.name} ${data.metadata.compiler.version}`
                      : "N/A",
                  },
                  { label: "IPFS CID", value: data.metadataCid ? `${data.metadataCid.slice(0, 12)}...` : "N/A" },
                  { label: "Updated", value: data.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : "N/A" },
                ].map((item) => (
                  <div key={item.label} className="bg-white border border-zinc-200 p-4">
                    <span className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">
                      {item.label}
                    </span>
                    <span className="font-mono text-sm">{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Content Hash */}
              {data.contentHash && (
                <div className="bg-white border border-zinc-200 p-4">
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">
                    Content Hash (keccak256)
                  </span>
                  <span className="font-mono text-xs break-all">{data.contentHash}</span>
                </div>
              )}

              {/* ABI Viewer */}
              {data.metadata?.abi && (
                <div className="bg-white border border-zinc-200">
                  <button
                    onClick={() => setAbiOpen(!abiOpen)}
                    className="w-full flex items-center justify-between p-4 hover:bg-zinc-50"
                  >
                    <div className="flex items-center gap-2">
                      <FileJson className="w-4 h-4" />
                      <span className="font-semibold text-sm">
                        ABI ({data.metadata.abi.length} entries)
                      </span>
                    </div>
                    {abiOpen ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>

                  {abiOpen && (
                    <div className="border-t border-zinc-200 p-4 max-h-96 overflow-y-auto">
                      {data.metadata.abi.map((entry: any, i: number) => (
                        <div
                          key={i}
                          className="py-2 border-b border-zinc-100 last:border-b-0"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 ${
                                entry.type === "function"
                                  ? "bg-blue-100 text-blue-700"
                                  : entry.type === "event"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {entry.type}
                            </span>
                            <span className="font-mono text-sm">
                              {entry.name || "(anonymous)"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* IPFS Link */}
              {data.metadataCid && (
                <div className="flex gap-2">
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${data.metadataCid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" icon={<ExternalLink className="w-4 h-4" />}>
                      View on IPFS
                    </Button>
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
