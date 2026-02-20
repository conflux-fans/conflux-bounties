import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Conflux Gated Site',
  description: 'Token/NFT gated content on Conflux eSpace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <nav className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
            <a href="/" className="text-lg font-bold text-conflux-accent">Conflux Gated Site</a>
            <div className="flex gap-4 text-sm">
              <a href="/login" className="text-gray-300 hover:text-white">Login</a>
              <a href="/dashboard" className="text-gray-300 hover:text-white">Dashboard</a>
              <a href="/admin" className="text-gray-300 hover:text-white">Admin</a>
            </div>
          </nav>
          <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
