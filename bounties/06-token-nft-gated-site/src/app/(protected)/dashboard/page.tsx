import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="rounded-lg border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-conflux-accent">Welcome</h2>
        <p className="mt-2 text-gray-400">
          Connected as <span className="font-mono text-white">{session.address}</span> on
          chain <span className="text-white">{session.chainId}</span>.
        </p>
      </div>

      <div className="rounded-lg border border-gray-700 p-6">
        <h2 className="text-lg font-semibold">🔒 Token-Gated Content</h2>
        <p className="mt-2 text-gray-400">
          This page is only accessible to authenticated users who pass all active gating rules.
          Your token balances have been verified.
        </p>
        <div className="mt-4 rounded bg-gray-800 p-4">
          <p className="text-sm text-conflux-accent">✅ You have access to this gated content.</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-700 p-6">
        <h2 className="text-lg font-semibold">📁 Protected Files</h2>
        <p className="mt-2 text-gray-400">
          Access token-gated file downloads from the <a href="/files" className="text-conflux-accent underline">Files</a> page.
        </p>
      </div>

      <form action="/api/auth/logout" method="POST">
        <button className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">
          Sign Out
        </button>
      </form>
    </div>
  );
}
