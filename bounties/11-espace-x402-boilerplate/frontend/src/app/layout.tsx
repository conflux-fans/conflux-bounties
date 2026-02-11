import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'x402 Fullstack — Conflux eSpace',
  description: 'HTTP 402 Payment Required protocol on Conflux eSpace. Multi-token, multi-method payments.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Manrope:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <nav className="nav-bar">
          <Link href="/" className="nav-logo">x402</Link>
          <div className="nav-links">
            <Link href="/">Demo</Link>
            <Link href="/pay">API</Link>
            <Link href="/history">History</Link>
            <Link href="/admin">Admin</Link>
            <a
              href="https://efaucet.confluxnetwork.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-faucet"
            >
              Faucet
            </a>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
