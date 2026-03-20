"use client";

import { useCallback, useEffect, useState } from "react";

type Rule = {
  id: string;
  name: string;
  pathPattern: string;
  combineLogic: string;
  rulesJson: unknown;
  sortOrder: number;
  enabled: boolean;
};

const exampleJson = `{
  "conditions": [
    {
      "type": "ERC20",
      "chainId": 1030,
      "address": "0x0000000000000000000000000000000000000000",
      "minBalance": "1"
    }
  ]
}`;

export function AdminRulesClient() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("New rule");
  const [pathPattern, setPathPattern] = useState("/members");
  const [combine, setCombine] = useState<"ALL" | "ANY">("ALL");
  const [jsonText, setJsonText] = useState(exampleJson);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editJson, setEditJson] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/rules");
      if (!res.ok) throw new Error("Failed to load rules");
      setRules(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let rulesJson: unknown;
    try {
      rulesJson = JSON.parse(jsonText) as unknown;
    } catch {
      setError("Invalid JSON");
      return;
    }
    const res = await fetch("/api/admin/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        pathPattern,
        combineLogic: combine,
        rulesJson,
      }),
    });
    if (!res.ok) {
      const j = (await res.json()) as { error?: string };
      setError(j.error || "Create failed");
      return;
    }
    setName("New rule");
    setPathPattern("/members");
    setJsonText(exampleJson);
    await load();
  }

  async function removeRule(id: string) {
    if (!confirm("Delete this rule?")) return;
    const res = await fetch(`/api/admin/rules/${id}`, { method: "DELETE" });
    if (!res.ok) setError("Delete failed");
    await load();
  }

  async function toggleRule(r: Rule) {
    const res = await fetch(`/api/admin/rules/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !r.enabled }),
    });
    if (!res.ok) setError("Update failed");
    await load();
  }

  function startEdit(r: Rule) {
    setEditingId(r.id);
    setEditJson(JSON.stringify(r.rulesJson, null, 2));
  }

  async function saveEdit(id: string) {
    setError(null);
    let rulesJson: unknown;
    try {
      rulesJson = JSON.parse(editJson) as unknown;
    } catch {
      setError("Invalid JSON");
      return;
    }
    const res = await fetch(`/api/admin/rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rulesJson }),
    });
    if (!res.ok) {
      setError("Save failed");
      return;
    }
    setEditingId(null);
    await load();
  }

  if (loading) return <p className="text-sm text-ink-muted">Loading rules…</p>;

  return (
    <div className="space-y-8">
      {error ? (
        <p
          className="rounded-xl border border-red-200/80 bg-red-50/80 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <ul className="space-y-3">
        {rules.map((r) => (
          <li
            key={r.id}
            className="ui-card-tight flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <div>
              <span className="font-semibold text-ink">{r.name}</span>
              <span className="ml-2 text-ink-muted">{r.pathPattern}</span>
              <span className="ml-2 text-xs uppercase text-ink-faint">
                {r.combineLogic} · {r.enabled ? "on" : "off"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void toggleRule(r)}
                className="btn-secondary-sm"
              >
                {r.enabled ? "Disable" : "Enable"}
              </button>
              <button
                type="button"
                onClick={() => startEdit(r)}
                className="btn-secondary-sm"
              >
                Edit JSON
              </button>
              <button
                type="button"
                onClick={() => void removeRule(r.id)}
                className="btn-danger-sm"
              >
                Delete
              </button>
            </div>
            {editingId === r.id ? (
              <div className="mt-3 w-full border-t border-ink/[0.06] pt-3">
                <textarea
                  className="input-field-mono min-h-[200px]"
                  rows={10}
                  value={editJson}
                  onChange={(e) => setEditJson(e.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void saveEdit(r.id)}
                    className="btn-primary-sm"
                  >
                    Save rulesJson
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="btn-secondary-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => void createRule(e)}
        className="ui-panel-dashed mt-8 space-y-4"
      >
        <h3 className="font-display font-semibold text-ink">Add rule</h3>
        <label className="block text-xs font-medium text-ink-muted">
          Name
          <input
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-ink-muted">
          Path pattern
          <input
            className="input-field"
            value={pathPattern}
            onChange={(e) => setPathPattern(e.target.value)}
          />
        </label>
        <label className="flex flex-wrap items-center gap-2 text-xs font-medium text-ink-muted">
          Combine
          <select
            value={combine}
            onChange={(e) => setCombine(e.target.value as "ALL" | "ANY")}
            className="input-field w-auto py-1.5"
          >
            <option value="ALL">ALL (every condition)</option>
            <option value="ANY">ANY (one condition)</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-ink-muted">
          rulesJson
          <textarea
            className="input-field-mono min-h-[240px]"
            rows={12}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
        </label>
        <button type="submit" className="btn-primary">
          Create rule
        </button>
      </form>
    </div>
  );
}
