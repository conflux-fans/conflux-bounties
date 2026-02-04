"use client";

import Link from "next/link";
import { Copy, FileJson, ExternalLink } from "lucide-react";
import { Button } from "./ui/Button";
import { StatusBadge } from "./status-badge";

interface ContractCardProps {
  contractAddress: string;
  metadata: {
    name?: string;
    description?: string;
    tags?: string[];
  };
  version: number;
  status: string;
  metadataCid?: string | null;
}

export function ContractCard({
  contractAddress,
  metadata,
  version,
  status,
  metadataCid,
}: ContractCardProps) {
  const shortAddr = `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}`;

  const copyAddress = () => {
    navigator.clipboard.writeText(contractAddress);
  };

  return (
    <div className="group relative bg-white border border-zinc-200 p-5 hover:border-black transition-colors duration-200 flex flex-col md:flex-row gap-6">
      {/* Status Indicator Strip */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${
          status === "approved"
            ? "bg-green-500"
            : status === "pending"
              ? "bg-amber-400"
              : "bg-red-500"
        }`}
      />

      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold font-[family-name:var(--font-space-grotesk)] text-zinc-900">
            {(metadata as any)?.name || shortAddr}
          </h3>
          <StatusBadge status={status} />
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 bg-zinc-50 p-1.5 w-fit border border-zinc-100">
          <span className="select-all">{shortAddr}</span>
          <button onClick={copyAddress} className="hover:text-black">
            <Copy className="w-3 h-3" />
          </button>
        </div>

        <p className="text-zinc-600 text-sm line-clamp-2 max-w-2xl">
          {(metadata as any)?.description || "No description available."}
        </p>

        {(metadata as any)?.tags && (
          <div className="flex gap-2 mt-2">
            {((metadata as any).tags as string[]).map((tag: string) => (
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

      <div className="flex flex-row md:flex-col justify-between md:items-end gap-3 border-t md:border-t-0 md:border-l border-zinc-100 pt-4 md:pt-0 md:pl-6 min-w-[140px]">
        <div className="text-right">
          <span className="block text-[10px] text-zinc-400 uppercase tracking-widest">
            Version
          </span>
          <span className="font-mono text-sm">{version}</span>
        </div>

        <div className="flex gap-2">
          {metadataCid && (
            <a
              href={`https://gateway.pinata.cloud/ipfs/${metadataCid}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="outline" icon={<FileJson className="w-3 h-3" />}>
                ABI
              </Button>
            </a>
          )}
          <Link href={`/contracts/${contractAddress}`}>
            <Button size="sm" variant="secondary" icon={<ExternalLink className="w-3 h-3" />}>
              View
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
