"use client";

import { useCallback, useEffect, useState } from "react";

export function AdminListsClient() {
  const [allow, setAllow] = useState<{ address: string; note: string | null }[]>(
    [],
  );
  const [deny, setDeny] = useState<{ address: string; note: string | null }[]>(
    [],
  );
  const [addr, setAddr] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<"allow" | "deny">("allow");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/lists");
    if (!res.ok) return;
    const data = (await res.json()) as {
      allowlist: { address: string; note: string | null }[];
      denylist: { address: string; note: string | null }[];
    };
    setAllow(data.allowlist);
    setDeny(data.denylist);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: kind, address: addr, note: note || undefined }),
    });
    if (!res.ok) {
      setError("Failed to add");
      return;
    }
    setAddr("");
    setNote("");
    await load();
  }

  async function remove(type: "allow" | "deny", address: string) {
    await fetch(
      `/api/admin/lists?type=${type}&address=${encodeURIComponent(address)}`,
      { method: "DELETE" },
    );
    await load();
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="ui-card-tight">
        <h3 className="text-sm font-semibold text-ink">Allowlist</h3>
        <ul className="mt-3 space-y-1.5 text-sm">
          {allow.map((a) => (
            <li
              key={a.address}
              className="flex items-center justify-between gap-2 rounded-lg border border-ink/[0.06] bg-paper/50 px-2.5 py-1.5 font-mono text-[11px]"
            >
              <span className="min-w-0 truncate">{a.address}</span>
              <button
                type="button"
                className="shrink-0 rounded-md px-1.5 text-red-700 hover:bg-red-50"
                onClick={() => void remove("allow", a.address)}
                aria-label="Remove from allowlist"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="ui-card-tight">
        <h3 className="text-sm font-semibold text-ink">Denylist</h3>
        <ul className="mt-3 space-y-1.5 text-sm">
          {deny.map((a) => (
            <li
              key={a.address}
              className="flex items-center justify-between gap-2 rounded-lg border border-ink/[0.06] bg-paper/50 px-2.5 py-1.5 font-mono text-[11px]"
            >
              <span className="min-w-0 truncate">{a.address}</span>
              <button
                type="button"
                className="shrink-0 rounded-md px-1.5 text-red-700 hover:bg-red-50"
                onClick={() => void remove("deny", a.address)}
                aria-label="Remove from denylist"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      <form
        onSubmit={(e) => void add(e)}
        className="ui-panel-dashed md:col-span-2 flex flex-wrap items-end gap-3"
      >
        {error ? (
          <p className="w-full rounded-lg border border-red-200/80 bg-red-50/80 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <label className="text-xs font-medium text-ink-muted">
          Type
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "allow" | "deny")}
            className="input-field ml-1 mt-1 w-auto py-1.5"
          >
            <option value="allow">allow</option>
            <option value="deny">deny</option>
          </select>
        </label>
        <input
          placeholder="0x…"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          className="input-field-mono min-w-[200px] flex-1 text-sm"
        />
        <input
          placeholder="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="input-field min-w-[120px] text-sm"
        />
        <button type="submit" className="btn-primary-sm">
          Add
        </button>
      </form>
    </div>
  );
}
