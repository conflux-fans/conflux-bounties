"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Sidebar } from "@/components/sidebar";
import { SearchBar } from "@/components/search-bar";
import { ContractCard } from "@/components/contract-card";
import { LandingPage } from "@/components/landing-page";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/Button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ContractResult {
  contractAddress: string;
  metadata: any;
  metadataCid: string | null;
  version: number;
  updatedAt: string;
}

export default function Home() {
  const { isConnected } = useAccount();
  const [search, setSearch] = useState("");
  const [contracts, setContracts] = useState<ContractResult[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchContracts = async (q?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const res = await fetch(`${API_URL}/api/contracts?${params}`);
      const data = await res.json();
      setContracts(data.data || []);
    } catch {
      setContracts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      fetchContracts();
    }
  }, [isConnected]);

  if (!isConnected) {
    return <LandingPage />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row">
      <Sidebar />

      <main className="flex-1 overflow-y-auto md:ml-0">
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center text-sm text-zinc-500">
            <span className="mr-2">Conflux eSpace</span>
            <span className="font-mono bg-zinc-100 px-2 py-1 text-black">
              Testnet
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" icon={<Settings className="w-4 h-4" />}>
              Settings
            </Button>
          </div>
        </header>

        <div className="p-6 md:p-12 max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-zinc-200 pb-6">
            <div>
              <h2 className="text-2xl font-[family-name:var(--font-space-grotesk)] font-semibold text-zinc-900">
                Registry
              </h2>
              <p className="text-zinc-500 text-sm mt-1">
                Browse verified contract metadata on Conflux
              </p>
            </div>
            <SearchBar
              value={search}
              onChange={setSearch}
              onSearch={() => fetchContracts(search)}
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-zinc-400">Loading...</div>
          ) : contracts.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {contracts.map((c) => (
                <ContractCard
                  key={c.contractAddress}
                  contractAddress={c.contractAddress}
                  metadata={c.metadata}
                  version={c.version}
                  status="approved"
                  metadataCid={c.metadataCid}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-400">
              <p>No contracts found. Submit metadata to get started.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
