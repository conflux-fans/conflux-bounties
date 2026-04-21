"use client";

import { useState } from "react";

export type GatedAssetBrief = { slug: string; originalName: string };

export function GatedDownloadList({ assets }: { assets: GatedAssetBrief[] }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [issued, setIssued] = useState<
    Record<string, { url: string; sha256?: string }>
  >({});

  async function issue(slug: string) {
    setLoading(slug);
    setErr(null);
    try {
      const res = await fetch("/api/assets/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const j = (await res.json()) as {
        error?: string;
        url?: string;
        integrity?: { sha256?: string };
      };
      if (!res.ok) throw new Error(j.error || "Could not issue link");
      if (j.url) {
        setIssued((u) => ({
          ...u,
          [slug]: { url: j.url!, sha256: j.integrity?.sha256 },
        }));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(null);
    }
  }

  if (!assets.length) {
    return (
      <p className="mt-4 text-sm text-ink-muted">
        No gated files yet. Run{" "}
        <span className="kbd-inline">npm run db:seed</span> or upload via Admin →
        Assets.
      </p>
    );
  }

  return (
    <ul className="mt-6 space-y-3">
      {assets.map((a) => (
        <li
          key={a.slug}
          className="flex flex-col gap-3 rounded-2xl border border-ink/[0.07] bg-white/90 p-4 shadow-card-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <span className="font-semibold text-ink">{a.originalName}</span>
            <span className="ml-2 font-mono text-xs text-ink-faint">{a.slug}</span>
            {issued[a.slug]?.sha256 ? (
              <p className="mt-1.5 font-mono text-[10px] text-ink-faint">
                SHA-256: {issued[a.slug].sha256}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading === a.slug}
              onClick={() => void issue(a.slug)}
              className="btn-primary-sm"
            >
              {loading === a.slug ? "Issuing…" : "Get signed link"}
            </button>
            {issued[a.slug] ? (
              <a
                href={issued[a.slug].url}
                className="btn-secondary-sm text-accent"
              >
                Download
              </a>
            ) : null}
          </div>
        </li>
      ))}
      {err ? (
        <p
          className="rounded-xl border border-red-200/80 bg-red-50/80 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {err}
        </p>
      ) : null}
    </ul>
  );
}
