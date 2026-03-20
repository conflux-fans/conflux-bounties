import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/get-session";
import { isAdminWallet } from "@/lib/admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");

  if (!isAdminWallet(session.address)) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center sm:py-32">
        <div className="ui-card">
          <p className="eyebrow">Restricted</p>
          <h1 className="mt-3 font-display text-2xl font-semibold text-ink">
            Admin only
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Your wallet is not listed in{" "}
            <span className="kbd-inline">ADMIN_WALLETS</span>.
          </p>
          <Link href="/" className="btn-primary mt-8 inline-flex">
            Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-paper bg-mesh-page">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-14">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-ink/[0.06] pb-6">
          <div>
            <p className="eyebrow">Console</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-ink sm:text-3xl">
              Admin
            </h1>
          </div>
          <Link
            href="/members"
            className="text-sm font-medium text-ink-muted transition hover:text-accent"
          >
            ← Back to members
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
