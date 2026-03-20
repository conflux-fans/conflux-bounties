import { getSession } from "@/lib/auth/get-session";
import { ProfileActions } from "@/components/profile-actions";
import { PageShell } from "@/components/ui/page-shell";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <PageShell
      size="sm"
      eyebrow="Account"
      title="Profile"
      description="Signed-in wallet and session. Gating for protected routes still uses on-chain rules or allowlists."
    >
      <dl className="ui-card mt-10 space-y-5 text-sm">
        <div className="border-b border-ink/[0.06] pb-5 last:border-0 last:pb-0">
          <dt className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Address
          </dt>
          <dd className="mt-2 font-mono text-xs break-all text-ink">
            {session.address}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Session id
          </dt>
          <dd className="mt-2 font-mono text-xs text-ink-muted">{session.id}</dd>
        </div>
      </dl>
      <div className="mt-8">
        <ProfileActions />
      </div>
    </PageShell>
  );
}
