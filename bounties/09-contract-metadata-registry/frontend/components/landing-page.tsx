"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Top decorative line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-zinc-200 via-zinc-400 to-zinc-200" />

      {/* Main Container — Dashed Border Box */}
      <div className="w-full max-w-5xl aspect-[2/1] relative group">
        {/* Dashed Border */}
        <div className="absolute inset-0 border-2 border-dashed border-zinc-200 rounded-none pointer-events-none" />

        {/* Corner Accents */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-zinc-400 -mt-[1px] -ml-[1px]" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-zinc-400 -mt-[1px] -mr-[1px]" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-zinc-400 -mb-[1px] -ml-[1px]" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-zinc-400 -mb-[1px] -mr-[1px]" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Illustration */}
          <div className="mb-8 relative">
            <div className="w-32 h-32 relative opacity-90">
              <svg
                viewBox="0 0 200 200"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full text-zinc-800"
              >
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  className="opacity-20 animate-[spin_10s_linear_infinite]"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="60"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="opacity-10"
                />
                <path d="M90 140L100 60L125 105L170 115L90 140Z" fill="currentColor" />
                <path d="M70 160C70 160 85 145 90 140" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <div className="absolute -top-10 -right-20 w-40 h-40 border border-zinc-100 rounded-full -z-10" />
            <div className="absolute -bottom-10 -left-20 w-56 h-56 border border-zinc-50 rounded-full -z-10" />
          </div>

          <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl md:text-3xl font-medium text-zinc-900 mb-2 tracking-tight">
            Conflux Registry
          </h1>
          <p className="text-zinc-500 mb-8 text-center max-w-md font-light">
            Canonical metadata registry for verifying, storing, and discovering
            smart contracts.
          </p>

          <ConnectButton label="Connect Wallet" />
        </div>
      </div>

      <div className="fixed bottom-6 text-xs text-zinc-400 font-mono">
        BOUNTY #09
      </div>
    </div>
  );
}
