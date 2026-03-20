import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";

export default function UnauthorizedPage() {
  return (
    <PageShell
      size="sm"
      className="py-20 text-center sm:py-28"
      contentClassName="mx-auto max-w-md"
      eyebrow="403"
      title="Access denied"
      description="You’re signed in, but this wallet doesn’t satisfy the active gating rules for this area (and isn’t on the allowlist)."
    >
      <div className="mt-10 flex flex-col items-center gap-3">
        <Link href="/" className="btn-primary">
          Back to home
        </Link>
        <Link href="/profile" className="btn-ghost text-sm">
          View profile
        </Link>
      </div>
    </PageShell>
  );
}
