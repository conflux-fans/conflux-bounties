'use client';

import Link from 'next/link';

const links = [
  { href: '/', label: 'Home' },
  { href: '/submit', label: 'Submit' },
  { href: '/explore', label: 'Explore' },
  { href: '/admin', label: 'Admin' },
];

export function Footer() {
  return (
    <footer className="border-t border-[rgb(var(--color-border))]/50 bg-[rgb(var(--color-bg-elevated))]/50">
      <div className="container-wide page-section">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2 font-semibold text-[rgb(var(--color-text))]">
            <span>Conflux</span>
            <span className="text-[rgb(var(--color-accent))]">Metadata</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-6">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-[rgb(var(--color-text-muted))] transition-colors hover:text-[rgb(var(--color-text))]"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-6 text-center text-xs text-[rgb(var(--color-text-muted))]">
          Verified metadata registry for Conflux smart contracts. Register, explore, and verify contract metadata on-chain.
        </p>
      </div>
    </footer>
  );
}
