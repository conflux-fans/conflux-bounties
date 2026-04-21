"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  chainId: number;
  tokenAddress: string;
  standard: string;
  name: string | null;
  symbol: string | null;
  uri: string | null;
  updatedAt: string;
};

export function AdminMetadataClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [chainId, setChainId] = useState("1030");
  const [addr, setAddr] = useState("");
  const [standard, setStandard] = useState<"ERC20" | "ERC721" | "ERC1155">(
    "ERC20",
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/metadata/refresh", { method: "GET" });
    if (!res.ok) return;
    const j = (await res.json()) as { cached?: Row[] };
    if (j.cached) setRows(j.cached);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshOne(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const res = await fetch("/api/admin/metadata/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chainId: Number(chainId),
        tokenAddress: addr.trim(),
        standard,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg("Refresh failed");
      return;
    }
    setMsg("Refreshed");
    await load();
  }

  async function refreshAll() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/metadata/refresh", { method: "GET" });
    setBusy(false);
    if (!res.ok) return;
    const j = (await res.json()) as { cached?: Row[] };
    if (j.cached) setRows(j.cached);
    setMsg("Synced from rules + loaded cache");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void refreshAll()}
          className="btn-primary-sm disabled:opacity-50"
        >
          Refresh from rules + reload table
        </button>
      </div>
      {msg ? (
        <p className="rounded-xl border border-accent/20 bg-accent-soft/40 px-3 py-2 text-sm font-medium text-accent">
          {msg}
        </p>
      ) : null}

      <form
        onSubmit={(e) => void refreshOne(e)}
        className="ui-card-tight flex flex-wrap items-end gap-3"
      >
        <label className="text-xs font-medium text-ink-muted">
          Chain
          <input
            value={chainId}
            onChange={(e) => setChainId(e.target.value)}
            className="input-field w-24"
          />
        </label>
        <label className="min-w-[200px] flex-1 text-xs font-medium text-ink-muted">
          Contract
          <input
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="0x…"
            className="input-field-mono text-sm"
          />
        </label>
        <select
          value={standard}
          onChange={(e) =>
            setStandard(e.target.value as "ERC20" | "ERC721" | "ERC1155")
          }
          className="input-field w-auto py-2 text-sm"
        >
          <option value="ERC20">ERC20</option>
          <option value="ERC721">ERC721</option>
          <option value="ERC1155">ERC1155</option>
        </select>
        <button type="submit" disabled={busy} className="btn-primary-sm">
          Fetch metadata
        </button>
      </form>

      <div className="table-wrap">
        <table className="w-full text-left text-xs">
          <thead className="table-head">
            <tr>
              <th className="p-2">Chain</th>
              <th className="p-2">Token</th>
              <th className="p-2">Std</th>
              <th className="p-2">Name</th>
              <th className="p-2">Symbol</th>
              <th className="p-2">URI</th>
              <th className="p-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-ink/[0.05]">
                <td className="p-2.5">{r.chainId}</td>
                <td className="p-2.5 font-mono">{r.tokenAddress.slice(0, 10)}…</td>
                <td className="p-2.5">{r.standard}</td>
                <td className="p-2.5">{r.name ?? "—"}</td>
                <td className="p-2.5">{r.symbol ?? "—"}</td>
                <td className="max-w-[120px] truncate p-2.5" title={r.uri ?? ""}>
                  {r.uri ?? "—"}
                </td>
                <td className="whitespace-nowrap p-2.5 text-ink-faint">
                  {new Date(r.updatedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
