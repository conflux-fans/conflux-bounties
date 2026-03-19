'use client';

import { Activity, ShieldCheck, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { WalletConnect } from './WalletConnect';

export function NavBar() {
  const isAdmin = useIsAdmin();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-800/50 bg-slate-950/70 backdrop-blur-md px-4 py-4">
      <div className="mx-auto max-w-7xl flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="text-lg font-bold text-white flex items-center gap-2 group"
        >
          <div className="bg-gradient-to-br from-conflux-500 to-blue-600 p-1.5 rounded-lg shadow-[0_0_15px_rgba(0,120,200,0.5)] group-hover:shadow-[0_0_25px_rgba(0,120,200,0.8)] transition-all">
            <Zap className="h-4 w-4 text-white fill-white" />
          </div>
          <span className="tracking-tight">Conflux Automation</span>
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-6 text-slate-400 text-sm font-medium">
          {mounted && isAdmin && (
            <Link
              href="/safety"
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck className="h-4 w-4" />
              Safety
            </Link>
          )}
          <Link
            href="/status"
            className="hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Activity className="h-4 w-4" />
            Status
          </Link>
        </div>

        {/* Wallet widget */}
        <div className="min-w-[120px] flex justify-end">
          {!mounted ? (
            <div className="h-8 w-40 rounded-xl bg-slate-800 animate-pulse" />
          ) : (
            <WalletConnect />
          )}
        </div>
      </div>
    </nav>
  );
}
