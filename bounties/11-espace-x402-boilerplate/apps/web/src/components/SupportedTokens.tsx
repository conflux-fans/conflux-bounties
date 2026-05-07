"use client";

import { ExternalLink, Shield, Coins, Globe } from "lucide-react";
import { USDT0_MAINNET, CNHT0_MAINNET } from "@x402/shared";

const TOKENS = [
  {
    symbol: "USDT0",
    name: "USD₮0",
    description: "Tether USD stablecoin — the most widely used dollar-pegged stablecoin, now natively on Conflux eSpace with full ERC-3009 authorization support.",
    mainnetAddress: USDT0_MAINNET,
    decimals: 6,
    peg: "US Dollar (USD)",
    issuer: "Tether",
    standard: "OFT (LayerZero)",
    explorerUrl: `https://evm.confluxscan.io/token/${USDT0_MAINNET}`,
    color: "emerald",
    icon: "💵",
  },
  {
    symbol: "AxCNH",
    name: "AxCNH",
    description: "Tether offshore Chinese Yuan stablecoin — enabling cross-border trade settlement across Belt and Road Initiative countries via Conflux eSpace.",
    mainnetAddress: CNHT0_MAINNET,
    decimals: 6,
    peg: "Offshore Chinese Yuan (CNH)",
    issuer: "Tether",
    standard: "OFT (LayerZero)",
    explorerUrl: `https://evm.confluxscan.io/token/${CNHT0_MAINNET}`,
    color: "red",
    icon: "🇨🇳",
  },
];

export function SupportedTokens() {
  return (
    <div className="space-y-5">
      {/* Intro */}
      <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/40 p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-conflux-teal/15 flex items-center justify-center shrink-0">
            <Shield className="text-conflux-teal" size={20} />
          </div>
          <div>
            <h3 className="text-white font-semibold mb-1">ERC-3009 Payment Protocol</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              x402 uses <code className="text-conflux-teal bg-conflux-teal/10 px-1.5 py-0.5 rounded text-xs">receiveWithAuthorization</code> (EIP-3009)
              for gasless payment signing. The buyer signs an off-chain EIP-712 message authorizing a token transfer.
              The seller&apos;s facilitator submits the signed authorization on-chain, paying the gas.
              This means <span className="text-white font-medium">buyers never pay gas fees</span> — only the seller does.
            </p>
          </div>
        </div>
      </div>

      {/* Token cards */}
      <div className="grid gap-5 md:grid-cols-2">
        {TOKENS.map((token) => (
          <div
            key={token.symbol}
            className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/60 p-6 flex flex-col hover:border-gray-600/50 transition-colors"
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="text-2xl">{token.icon}</div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">{token.symbol}</h3>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border
                    ${token.color === "emerald"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}
                  >
                    ERC-3009
                  </span>
                </div>
                <p className="text-xs text-gray-400">{token.name}</p>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-400 leading-relaxed mb-5 flex-1">
              {token.description}
            </p>

            {/* Details grid */}
            <div className="rounded-xl bg-black/20 border border-gray-700/30 p-4 space-y-2.5 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1.5"><Coins size={12} /> Peg</span>
                <span className="text-gray-300">{token.peg}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1.5"><Globe size={12} /> Chain</span>
                <span className="text-gray-300">Conflux eSpace (1030)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Decimals</span>
                <span className="text-gray-300 font-mono">{token.decimals}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Standard</span>
                <span className="text-gray-300">{token.standard}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Issuer</span>
                <span className="text-gray-300">{token.issuer}</span>
              </div>
            </div>

            {/* Contract address */}
            <div className="rounded-xl bg-black/30 border border-gray-700/30 p-3 mb-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Mainnet Contract Address</p>
              <code className="text-xs font-mono text-conflux-teal break-all leading-relaxed">
                {token.mainnetAddress}
              </code>
            </div>

            {/* Explorer link */}
            <a
              href={token.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                flex items-center justify-center gap-2
                ${token.color === "emerald"
                  ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                }`}
            >
              View on ConfluxScan <ExternalLink size={13} />
            </a>
          </div>
        ))}
      </div>

      {/* Payment flow diagram */}
      <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/40 p-5">
        <h3 className="text-white font-semibold mb-4">x402 Payment Flow</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { step: "1", title: "Request", desc: "Client calls a premium API endpoint" },
            { step: "2", title: "402 Challenge", desc: "Server returns HTTP 402 with payment details" },
            { step: "3", title: "Sign Auth", desc: "Client signs EIP-712 receiveWithAuthorization (no gas)" },
            { step: "4", title: "Settle", desc: "Facilitator submits auth on-chain, client retries" },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3 p-3 rounded-xl bg-black/20 border border-gray-700/30">
              <div className="w-7 h-7 rounded-lg bg-conflux-teal/15 flex items-center justify-center shrink-0">
                <span className="text-conflux-teal text-xs font-bold">{item.step}</span>
              </div>
              <div>
                <p className="text-white text-sm font-medium">{item.title}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
