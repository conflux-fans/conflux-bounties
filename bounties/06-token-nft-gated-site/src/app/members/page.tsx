import Link from "next/link";
import { getSession } from "@/lib/auth/get-session";
import { prisma } from "@/lib/prisma";
import { GatedDownloadList } from "@/components/gated-download-list";
import { PageShell } from "@/components/ui/page-shell";

export default async function MembersPage() {
  const session = await getSession();
  const assets = await prisma.gatedAsset.findMany({
    orderBy: { slug: "asc" },
    select: { slug: true, originalName: true },
  });

  return (
    <PageShell
      size="md"
      eyebrow="Members"
      title="Gated area"
      description="You passed token checks (or allowlist) for this path. Downloads below use short-lived signed URLs after a server check."
    >
      <div className="mt-8 ui-card-tight">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
          Active wallet
        </p>
        <p className="mt-2 font-mono text-sm break-all text-ink">
          {session?.address}
        </p>
      </div>

      <ul className="mt-10 space-y-2">
        <li>
          <Link
            href="/resources/alpha"
            className="group flex items-center justify-between rounded-xl border border-ink/[0.06] bg-white/80 px-4 py-3 text-sm font-medium text-accent shadow-card-sm transition hover:border-accent/25 hover:bg-accent-soft/30"
          >
            <span>Resource: Alpha (SSR + client downloads)</span>
            <span className="text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-accent">
              →
            </span>
          </Link>
        </li>
      </ul>

      <section className="mt-14 border-t border-ink/[0.06] pt-12">
        <h2 className="section-subtitle">Signed download links</h2>
        <p className="section-desc">
          Issue a time-limited URL after gating. The HMAC token is verified on
          download — handy for CDNs or in-app handoffs.
        </p>
        <GatedDownloadList assets={assets} />
      </section>
    </PageShell>
  );
}
