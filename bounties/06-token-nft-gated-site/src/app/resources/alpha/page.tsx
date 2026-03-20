import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ResourcesAlphaClient } from "@/components/resources-alpha-client";
import { PageShell } from "@/components/ui/page-shell";

export default async function AlphaResourcePage() {
  const assets = await prisma.gatedAsset.findMany({
    orderBy: { slug: "asc" },
    select: { slug: true, originalName: true },
  });

  return (
    <PageShell
      size="md"
      eyebrowVariant="amber"
      eyebrow="Resource"
      title="Alpha brief"
      description="This page is SSR-gated (layout checks rules). Below, a client island loads download UI on demand — tap when you’re ready to fetch signed URLs."
    >
      <Link
        href="/members"
        className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
      >
        <span aria-hidden>←</span> Back to members
      </Link>

      <ResourcesAlphaClient assets={assets} />
    </PageShell>
  );
}
