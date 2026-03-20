"use client";

import { useEffect, useState } from "react";

type Log = {
  id: string;
  walletAddress: string | null;
  path: string;
  allowed: boolean;
  createdAt: string;
  meta: unknown;
  rule: { name: string } | null;
};

export function AdminLogsPreview() {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/access-logs");
      if (res.ok) setLogs(await res.json());
    })();
  }, []);

  if (!logs.length) {
    return <p className="text-sm text-ink-muted">No access events yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="w-full text-left text-xs">
        <thead className="table-head">
          <tr>
            <th className="p-2">Time</th>
            <th className="p-2">Path</th>
            <th className="p-2">Wallet</th>
            <th className="p-2">Rule</th>
            <th className="p-2">OK</th>
            <th className="p-2">Meta / snapshot</th>
          </tr>
        </thead>
        <tbody>
          {logs.slice(0, 30).map((l) => (
            <tr key={l.id} className="border-b border-ink/[0.05]">
              <td className="whitespace-nowrap p-2.5 text-ink-faint">
                {new Date(l.createdAt).toLocaleString()}
              </td>
              <td className="p-2.5 font-mono">{l.path}</td>
              <td className="p-2.5 font-mono text-ink-muted">
                {l.walletAddress?.slice(0, 10)}…
              </td>
              <td className="p-2.5">{l.rule?.name ?? "—"}</td>
              <td className="p-2.5">{l.allowed ? "yes" : "no"}</td>
              <td className="max-w-[200px] break-all p-2.5 font-mono text-[10px] text-ink-faint">
                {l.meta
                  ? JSON.stringify(l.meta).slice(0, 120) +
                    (JSON.stringify(l.meta).length > 120 ? "…" : "")
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
