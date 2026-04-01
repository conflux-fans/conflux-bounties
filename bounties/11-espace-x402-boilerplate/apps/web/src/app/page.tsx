"use client";

import { EndpointCatalog } from "@/components/EndpointCatalog";
import { SellerDirectory } from "@/components/SellerDirectory";
import { SupportedTokens } from "@/components/SupportedTokens";
import { TransactionHistory } from "@/components/TransactionHistory";
import { MintTestTokens } from "@/components/MintTestTokens";
import AgentChat from "@/components/AgentChat";
import { Navbar } from "@/components/Navbar";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-conflux-teal/5 to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-8">
          <h2 className="text-4xl font-bold text-white mb-3">
            Monetize your APIs with <span className="text-conflux-teal">HTTP 402</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl">
            Try the endpoints below. Free endpoints return data instantly.
            Premium endpoints require a USDT0 payment via ERC-3009 on Conflux eSpace.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 pb-16">
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-6 bg-conflux-teal rounded-full" />
            <h2 className="text-xl font-semibold text-white">API Endpoints</h2>
          </div>
          <EndpointCatalog />
        </section>

        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-6 bg-conflux-teal rounded-full" />
            <h2 className="text-xl font-semibold text-white">Registered APIs</h2>
          </div>
          <SellerDirectory />
        </section>

        <section className="mb-16">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 bg-conflux-teal rounded-full" />
            <h2 className="text-xl font-semibold text-white">x402 AI Agent</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6 ml-3">
            Autonomous agent that calls APIs and pays for premium data via x402
          </p>
          <AgentChat />
        </section>

        <section className="mb-16">
          <MintTestTokens />
        </section>

        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-6 bg-conflux-teal rounded-full" />
            <h2 className="text-xl font-semibold text-white">Supported Tokens on Conflux eSpace (Chain 1030)</h2>
          </div>
          <SupportedTokens />
        </section>

        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-6 bg-conflux-teal rounded-full" />
            <h2 className="text-xl font-semibold text-white">Transaction History</h2>
          </div>
          <TransactionHistory />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-sm text-gray-500">
          <span>Conflux eSpace Testnet</span>
          <a
            href={process.env.NEXT_PUBLIC_FAUCET_URL || "https://efaucet.confluxnetwork.org/"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-conflux-teal hover:underline"
          >
            Get testnet CFX
          </a>
        </div>
      </footer>
    </div>
  );
}
