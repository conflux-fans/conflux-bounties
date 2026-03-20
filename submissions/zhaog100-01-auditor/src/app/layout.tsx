import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Conflux Smart Contract Auditor',
  description: 'AI-powered smart contract security auditor for Conflux eSpace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 antialiased">
        <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white text-sm">C</div>
              <h1 className="text-lg font-semibold text-white">Conflux Auditor</h1>
              <span className="rounded-full bg-blue-600/20 px-2 py-0.5 text-xs text-blue-400">eSpace</span>
            </div>
            <a
              href="https://doc.confluxnetwork.org/docs/espace/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-white transition"
            >
              Conflux Docs ↗
            </a>
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
