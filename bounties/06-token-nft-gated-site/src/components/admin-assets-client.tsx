"use client";

import { useCallback, useEffect, useState } from "react";

type Asset = {
  id: string;
  slug: string;
  originalName: string;
  mimeType: string;
  sha256: string;
  sizeBytes: number;
};

export function AdminAssetsClient() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/assets");
    if (res.ok) setAssets(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setMsg(null);
    const fd = new FormData(form);
    if (slug.trim()) fd.set("slug", slug.trim());
    setBusy(true);
    const res = await fetch("/api/admin/assets", { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) {
      setMsg("Upload failed");
      return;
    }
    setSlug("");
    form.reset();
    await load();
    setMsg("Uploaded");
  }

  async function remove(slug: string) {
    if (!confirm(`Delete ${slug}?`)) return;
    await fetch(`/api/admin/assets/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    });
    await load();
  }

  if (loading) return <p className="text-sm text-ink-muted">Loading assets…</p>;

  return (
    <div className="space-y-6">
      {msg ? (
        <p className="rounded-xl border border-accent/20 bg-accent-soft/40 px-3 py-2 text-sm font-medium text-accent">
          {msg}
        </p>
      ) : null}
      <form
        onSubmit={(e) => void upload(e)}
        className="ui-panel-dashed flex flex-col gap-4 sm:flex-row sm:items-end"
      >
        <label className="min-w-0 flex-1 text-xs font-medium text-ink-muted">
          File
          <input
            name="file"
            type="file"
            required
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent"
          />
        </label>
        <label className="text-xs font-medium text-ink-muted sm:w-48">
          Slug (optional)
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto from filename"
            className="input-field"
          />
        </label>
        <button type="submit" disabled={busy} className="btn-primary shrink-0">
          {busy ? "…" : "Upload"}
        </button>
      </form>

      <ul className="space-y-2 text-sm">
        {assets.map((a) => (
          <li
            key={a.id}
            className="ui-card-tight flex flex-wrap items-center justify-between gap-2"
          >
            <div>
              <span className="font-semibold text-ink">{a.originalName}</span>
              <span className="ml-2 font-mono text-xs text-ink-faint">{a.slug}</span>
              <p className="font-mono text-[10px] text-ink-faint">{a.sha256}</p>
            </div>
            <button
              type="button"
              onClick={() => void remove(a.slug)}
              className="btn-danger-sm"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
