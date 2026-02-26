'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { ConnectWallet } from './ConnectWallet';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/submit', label: 'Submit' },
  { href: '/explore', label: 'Explore' },
  { href: '/admin', label: 'Admin' },
];

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      {open ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      )}
    </svg>
  );
}

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinkClass = (href: string) =>
    clsx(
      'block rounded-lg px-4 py-3 text-sm font-medium transition-colors',
      pathname === href
        ? 'bg-[rgb(var(--color-accent))]/15 text-[rgb(var(--color-accent))]'
        : 'text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-bg-muted))]/50 hover:text-[rgb(var(--color-text))]'
    );

  return (
    <header className="sticky top-0 z-50 border-b border-[rgb(var(--color-border))]/50 bg-[rgb(var(--color-bg))]/80 backdrop-blur-xl">
      <div className="container-wide flex h-14 min-h-[3.5rem] items-center justify-between gap-4 sm:h-16">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-[rgb(var(--color-text))] hover:opacity-90">
          <span className="text-lg tracking-tight sm:text-xl">Conflux</span>
          <span className="text-[rgb(var(--color-accent))]">Metadata</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Main navigation">
          {navItems.map(({ href, label }) => (
            <Link key={href} href={href} className={navLinkClass(href)}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="relative z-[100] flex items-center gap-2">
          <ConnectWallet />
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-bg-muted))]/50 hover:text-[rgb(var(--color-text))] sm:hidden"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            <MenuIcon open={mobileMenuOpen} />
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav
          id="mobile-nav"
          className="border-t border-[rgb(var(--color-border))]/50 bg-[rgb(var(--color-bg))] sm:hidden"
          aria-label="Mobile navigation"
        >
          <div className="container-wide flex flex-col py-2">
            {navItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={navLinkClass(href)}
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
