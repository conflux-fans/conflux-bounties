"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NetworkBadge } from "@/components/NetworkBadge";

const COMPONENTS = [
  {
    name: "Web Client",
    tech: "Next.js + wagmi",
    desc: "Browse endpoints, connect wallet, sign EIP-712 authorizations, view transaction history",
    color: "from-emerald-500/20 to-emerald-500/5",
    border: "border-emerald-500/20",
  },
  {
    name: "Seller API",
    tech: "Hono + x402 middleware",
    desc: "Free + premium endpoints, 402 challenges, off-chain signature pre-validation, settlement via facilitator, rate limiting, Prometheus metrics, admin CRUD + agent controls",
    color: "from-amber-500/20 to-amber-500/5",
    border: "border-amber-500/20",
  },
  {
    name: "AI Agent",
    tech: "TypeScript + LangChain",
    desc: "Autonomous API caller — detects 402, signs auth, settles, retries. Spend caps + daily budgets. Admin-pausable via API.",
    color: "from-violet-500/20 to-violet-500/5",
    border: "border-violet-500/20",
  },
  {
    name: "Smart Contracts",
    tech: "Solidity on eSpace",
    desc: "X402PaymentVerifier (multi-tenant settlement + replay protection) + MockUSDT0 (ERC-3009 token)",
    color: "from-conflux-teal/20 to-conflux-teal/5",
    border: "border-conflux-teal/20",
  },
];

const X402_HEADERS = [
  { header: "x-payment-amount", desc: "Price in token smallest unit (6 decimals for USDT0)" },
  { header: "x-payment-token", desc: "ERC-3009 token contract address" },
  { header: "x-payment-nonce", desc: "Unique UUID for this challenge" },
  { header: "x-payment-expiry", desc: "Unix timestamp — invoice expires after 5 minutes" },
  { header: "x-payment-endpoint", desc: "The API path requiring payment" },
  { header: "x-payment-invoice-id", desc: "Ephemeral invoice identifier" },
  { header: "x-payment-recipient", desc: "Seller wallet address (receives funds after settlement)" },
  { header: "x-payment-verifier", desc: "X402PaymentVerifier contract address (the 'to' in ReceiveWithAuthorization)" },
];

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 glass">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-conflux-teal to-blue-500 flex items-center justify-center text-white font-bold text-sm">
              x4
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Architecture</h1>
              <p className="text-xs text-gray-400">x402 Payment Flow on Conflux eSpace</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <NetworkBadge />
            <Link
              href="/"
              className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              Home
            </Link>
            <Link
              href="/admin"
              className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-20">

        {/* ─── System Overview Diagram (SVG) ─── */}
        <section>
          <div className="flex items-center gap-2 mb-8">
            <div className="w-1 h-6 bg-conflux-teal rounded-full" />
            <h2 className="text-2xl font-bold text-white">System Overview</h2>
          </div>

          <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/60 p-4 sm:p-8 overflow-x-auto">
            <svg viewBox="0 0 880 520" className="w-full max-w-4xl mx-auto" xmlns="http://www.w3.org/2000/svg">
              {/* Defs: gradients, markers, glow filter */}
              <defs>
                <linearGradient id="grad-emerald" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="grad-amber" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="grad-violet" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="grad-teal" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="grad-slate" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.05" />
                </linearGradient>
                <marker id="arrow-teal" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6" fill="#2dd4bf" />
                </marker>
                <marker id="arrow-amber" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6" fill="#fbbf24" />
                </marker>
                <marker id="arrow-emerald" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6" fill="#34d399" />
                </marker>
                <marker id="arrow-violet" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6" fill="#a78bfa" />
                </marker>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* ── Connections (behind nodes) ── */}
              {/* Client ↔ API: 402 challenge */}
              <line x1="265" y1="72" x2="505" y2="72" stroke="#2dd4bf" strokeWidth="2" strokeDasharray="6 3" markerEnd="url(#arrow-teal)" opacity="0.7" />
              <line x1="505" y1="88" x2="265" y2="88" stroke="#fbbf24" strokeWidth="2" strokeDasharray="6 3" markerEnd="url(#arrow-amber)" opacity="0.7" />
              <text x="385" y="60" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace">GET /data/premium</text>
              <text x="385" y="105" textAnchor="middle" fill="#fbbf24" fontSize="10" fontFamily="monospace" opacity="0.8">402 Payment Required</text>

              {/* Client → API: settle */}
              <line x1="265" y1="135" x2="505" y2="135" stroke="#34d399" strokeWidth="2" markerEnd="url(#arrow-emerald)" opacity="0.7" />
              <text x="385" y="150" textAnchor="middle" fill="#34d399" fontSize="10" fontFamily="monospace" opacity="0.8">POST /settle + EIP-712 sig</text>

              {/* API → Blockchain */}
              <line x1="660" y1="190" x2="660" y2="280" stroke="#2dd4bf" strokeWidth="2" markerEnd="url(#arrow-teal)" opacity="0.6" />
              <text x="670" y="240" fill="#94a3b8" fontSize="9" fontFamily="monospace">settle on-chain</text>
              <text x="670" y="252" fill="#94a3b8" fontSize="9" fontFamily="monospace">(facilitator pays gas)</text>

              {/* API → DB */}
              <line x1="660" y1="190" x2="820" y2="280" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#arrow-amber)" opacity="0.5" />
              <text x="756" y="230" fill="#94a3b8" fontSize="9" fontFamily="monospace" transform="rotate(22 756 230)">invoices DB</text>

              {/* Client → Blockchain (wallet interaction) */}
              <line x1="130" y1="190" x2="130" y2="280" stroke="#34d399" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#arrow-emerald)" opacity="0.4" />
              <text x="80" y="240" fill="#94a3b8" fontSize="9" fontFamily="monospace">read chain</text>

              {/* AI Agent → API */}
              <line x1="310" y1="430" x2="560" y2="190" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-violet)" opacity="0.5" />
              <text x="395" y="330" fill="#a78bfa" fontSize="9" fontFamily="monospace" opacity="0.7" transform="rotate(-34 395 330)">autonomous 402 handling</text>

              {/* AI Agent → Blockchain */}
              <line x1="240" y1="430" x2="200" y2="380" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-violet)" opacity="0.4" />

              {/* ── Node: Web Client ── */}
              <g>
                <rect x="30" y="40" width="235" height="150" rx="16" fill="url(#grad-emerald)" stroke="#34d399" strokeWidth="1.2" strokeOpacity="0.4" />
                <text x="147" y="70" textAnchor="middle" fill="#34d399" fontSize="14" fontWeight="600">Web Client</text>
                <text x="147" y="88" textAnchor="middle" fill="#6b7280" fontSize="11" fontFamily="monospace">Next.js + wagmi</text>
                <line x1="60" y1="100" x2="235" y2="100" stroke="#34d399" strokeOpacity="0.15" strokeWidth="1" />
                <text x="60" y="120" fill="#94a3b8" fontSize="10">• Connect wallet</text>
                <text x="60" y="136" fill="#94a3b8" fontSize="10">• EIP-712 sign (gasless)</text>
                <text x="60" y="152" fill="#94a3b8" fontSize="10">• Browse endpoints</text>
                <text x="60" y="168" fill="#94a3b8" fontSize="10">• Transaction history</text>
              </g>

              {/* ── Node: Seller API ── */}
              <g>
                <rect x="505" y="40" width="260" height="150" rx="16" fill="url(#grad-amber)" stroke="#fbbf24" strokeWidth="1.2" strokeOpacity="0.4" />
                <text x="635" y="70" textAnchor="middle" fill="#fbbf24" fontSize="14" fontWeight="600">Seller API</text>
                <text x="635" y="88" textAnchor="middle" fill="#6b7280" fontSize="11" fontFamily="monospace">Hono + x402 middleware</text>
                <line x1="535" y1="100" x2="735" y2="100" stroke="#fbbf24" strokeOpacity="0.15" strokeWidth="1" />
                <text x="535" y="120" fill="#94a3b8" fontSize="10">• x402 paywall + sig pre-validation</text>
                <text x="535" y="136" fill="#94a3b8" fontSize="10">• Facilitator settlement</text>
                <text x="535" y="152" fill="#94a3b8" fontSize="10">• Prometheus /metrics</text>
                <text x="535" y="168" fill="#94a3b8" fontSize="10">• Rate limiter + agent controls</text>
              </g>

              {/* ── Node: Conflux eSpace ── */}
              <g>
                <rect x="30" y="280" width="310" height="100" rx="16" fill="url(#grad-teal)" stroke="#2dd4bf" strokeWidth="1.2" strokeOpacity="0.4" />
                <text x="185" y="310" textAnchor="middle" fill="#2dd4bf" fontSize="14" fontWeight="600">Conflux eSpace Testnet</text>
                <text x="185" y="328" textAnchor="middle" fill="#6b7280" fontSize="11" fontFamily="monospace">Chain ID: 71</text>
                <line x1="60" y1="338" x2="310" y2="338" stroke="#2dd4bf" strokeOpacity="0.15" strokeWidth="1" />
                <text x="60" y="358" fill="#94a3b8" fontSize="10">📄 X402PaymentVerifier — settle, verify, refund</text>
                <text x="60" y="374" fill="#94a3b8" fontSize="10">🪙 MockUSDT0 — ERC-20 + ERC-3009 (6 decimals)</text>
              </g>

              {/* ── Node: Database ── */}
              <g>
                <rect x="640" y="280" width="220" height="100" rx="16" fill="url(#grad-slate)" stroke="#94a3b8" strokeWidth="1" strokeOpacity="0.3" />
                <text x="750" y="310" textAnchor="middle" fill="#94a3b8" fontSize="14" fontWeight="600">PostgreSQL + Redis</text>
                <line x1="660" y1="322" x2="840" y2="322" stroke="#94a3b8" strokeOpacity="0.15" strokeWidth="1" />
                <text x="660" y="342" fill="#6b7280" fontSize="10">invoices · endpoint_pricing · agent_controls</text>
                <text x="660" y="358" fill="#6b7280" fontSize="10">usage_logs · audit_logs · api_keys</text>
                <text x="660" y="374" fill="#6b7280" fontSize="10">BullMQ jobs (Redis)</text>
              </g>

              {/* ── Node: AI Agent ── */}
              <g>
                <rect x="120" y="420" width="310" height="90" rx="16" fill="url(#grad-violet)" stroke="#a78bfa" strokeWidth="1.2" strokeOpacity="0.4" />
                <text x="275" y="450" textAnchor="middle" fill="#a78bfa" fontSize="14" fontWeight="600">AI Agent</text>
                <text x="275" y="468" textAnchor="middle" fill="#6b7280" fontSize="11" fontFamily="monospace">TypeScript + LangChain</text>
                <line x1="150" y1="478" x2="400" y2="478" stroke="#a78bfa" strokeOpacity="0.15" strokeWidth="1" />
                <text x="150" y="498" fill="#94a3b8" fontSize="10">detects 402 → signs auth → settles → retries • spend caps • daily budgets</text>
              </g>

              {/* ── Legend ── */}
              <g transform="translate(540, 430)">
                <rect x="0" y="0" width="320" height="80" rx="10" fill="#0F2744" fillOpacity="0.8" stroke="#374151" strokeWidth="0.5" />
                <text x="16" y="20" fill="#6b7280" fontSize="10" fontWeight="600">LEGEND</text>
                <line x1="16" y1="32" x2="40" y2="32" stroke="#2dd4bf" strokeWidth="2" strokeDasharray="6 3" />
                <text x="48" y="36" fill="#94a3b8" fontSize="9">HTTP request/response</text>
                <line x1="170" y1="32" x2="194" y2="32" stroke="#34d399" strokeWidth="2" />
                <text x="202" y="36" fill="#94a3b8" fontSize="9">Settlement flow</text>
                <line x1="16" y1="52" x2="40" y2="52" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="5 3" />
                <text x="48" y="56" fill="#94a3b8" fontSize="9">Agent automation</text>
                <line x1="170" y1="52" x2="194" y2="52" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 3" />
                <text x="202" y="56" fill="#94a3b8" fontSize="9">DB persistence</text>
                <circle cx="28" y="70" cy="70" r="4" fill="#34d399" fillOpacity="0.3" stroke="#34d399" strokeWidth="0.8" />
                <text x="48" y="74" fill="#94a3b8" fontSize="9">Color = component owner</text>
              </g>
            </svg>
          </div>
        </section>

        {/* ─── Components ─── */}
        <section>
          <div className="flex items-center gap-2 mb-8">
            <div className="w-1 h-6 bg-conflux-teal rounded-full" />
            <h2 className="text-2xl font-bold text-white">Components</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {COMPONENTS.map((c) => (
              <div
                key={c.name}
                className={`rounded-2xl border ${c.border} bg-gradient-to-b ${c.color} p-6`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-lg font-semibold text-white">{c.name}</h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-gray-700/50">
                    {c.tech}
                  </span>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Payment Flow (Sequence Diagram) ─── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-6 bg-conflux-teal rounded-full" />
            <h2 className="text-2xl font-bold text-white">ERC-3009 Payment Flow</h2>
          </div>
          <p className="text-gray-400 mb-8">
            Buyers never pay gas. They sign an off-chain EIP-712 message, and the seller&apos;s
            facilitator wallet submits the on-chain settlement.
          </p>

          <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/60 p-4 sm:p-8 overflow-x-auto">
            <svg viewBox="0 0 880 580" className="w-full max-w-4xl mx-auto" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <marker id="seq-right" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6" fill="#2dd4bf" />
                </marker>
                <marker id="seq-left" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
                  <path d="M8,0 L0,3 L8,6" fill="#fbbf24" />
                </marker>
                <marker id="seq-right-green" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6" fill="#34d399" />
                </marker>
                <marker id="seq-right-amber" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6" fill="#fbbf24" />
                </marker>
                <marker id="seq-left-green" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
                  <path d="M8,0 L0,3 L8,6" fill="#34d399" />
                </marker>
              </defs>

              {/* ── Actor headers ── */}
              {/* Client */}
              <rect x="60" y="10" width="130" height="44" rx="10" fill="#34d399" fillOpacity="0.15" stroke="#34d399" strokeWidth="1" strokeOpacity="0.5" />
              <text x="125" y="30" textAnchor="middle" fill="#34d399" fontSize="13" fontWeight="600">Client</text>
              <text x="125" y="44" textAnchor="middle" fill="#6b7280" fontSize="9" fontFamily="monospace">Web / AI Agent</text>

              {/* Seller API */}
              <rect x="340" y="10" width="160" height="44" rx="10" fill="#fbbf24" fillOpacity="0.15" stroke="#fbbf24" strokeWidth="1" strokeOpacity="0.5" />
              <text x="420" y="30" textAnchor="middle" fill="#fbbf24" fontSize="13" fontWeight="600">Seller API</text>
              <text x="420" y="44" textAnchor="middle" fill="#6b7280" fontSize="9" fontFamily="monospace">Hono + x402</text>

              {/* Blockchain */}
              <rect x="640" y="10" width="170" height="44" rx="10" fill="#2dd4bf" fillOpacity="0.15" stroke="#2dd4bf" strokeWidth="1" strokeOpacity="0.5" />
              <text x="725" y="30" textAnchor="middle" fill="#2dd4bf" fontSize="13" fontWeight="600">Conflux eSpace</text>
              <text x="725" y="44" textAnchor="middle" fill="#6b7280" fontSize="9" fontFamily="monospace">X402Verifier + USDT0</text>

              {/* ── Lifelines ── */}
              <line x1="125" y1="54" x2="125" y2="560" stroke="#34d399" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="4 4" />
              <line x1="420" y1="54" x2="420" y2="560" stroke="#fbbf24" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="4 4" />
              <line x1="725" y1="54" x2="725" y2="560" stroke="#2dd4bf" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="4 4" />

              {/* ── Step 1: Client → API ── */}
              <g>
                <rect x="14" y="78" width="22" height="22" rx="6" fill="#34d399" />
                <text x="25" y="94" textAnchor="middle" fill="#064e3b" fontSize="12" fontWeight="700">1</text>
                <line x1="135" y1="90" x2="408" y2="90" stroke="#34d399" strokeWidth="1.5" markerEnd="url(#seq-right-green)" />
                <text x="270" y="84" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace">GET /data/premium</text>
              </g>

              {/* ── Step 2: API → Client (402) ── */}
              <g>
                <rect x="14" y="118" width="22" height="22" rx="6" fill="#fbbf24" />
                <text x="25" y="134" textAnchor="middle" fill="#78350f" fontSize="12" fontWeight="700">2</text>
                <line x1="408" y1="130" x2="137" y2="130" stroke="#fbbf24" strokeWidth="1.5" markerEnd="url(#seq-left)" />
                <text x="270" y="124" textAnchor="middle" fill="#fbbf24" fontSize="10" fontWeight="500">402 Payment Required</text>
                {/* Detail box */}
                <rect x="150" y="140" width="240" height="48" rx="6" fill="#fbbf24" fillOpacity="0.06" stroke="#fbbf24" strokeWidth="0.5" strokeOpacity="0.2" />
                <text x="165" y="155" fill="#94a3b8" fontSize="9" fontFamily="monospace">x-payment-amount: 100000</text>
                <text x="165" y="167" fill="#94a3b8" fontSize="9" fontFamily="monospace">x-payment-token: 0x...USDT0</text>
                <text x="165" y="179" fill="#94a3b8" fontSize="9" fontFamily="monospace">x-payment-invoice-id: inv-abc</text>
              </g>

              {/* ── Step 3: Client signs (self) ── */}
              <g>
                <rect x="14" y="204" width="22" height="22" rx="6" fill="#34d399" />
                <text x="25" y="220" textAnchor="middle" fill="#064e3b" fontSize="12" fontWeight="700">3</text>
                {/* Self-arrow */}
                <path d="M135,215 C200,215 200,240 135,240" fill="none" stroke="#34d399" strokeWidth="1.5" markerEnd="url(#seq-right-green)" />
                <rect x="140" y="200" width="220" height="34" rx="6" fill="#34d399" fillOpacity="0.06" stroke="#34d399" strokeWidth="0.5" strokeOpacity="0.2" />
                <text x="250" y="215" textAnchor="middle" fill="#34d399" fontSize="10" fontWeight="500">Sign EIP-712 off-chain</text>
                <text x="250" y="228" textAnchor="middle" fill="#6b7280" fontSize="9">receiveWithAuthorization — no gas</text>
              </g>

              {/* ── Step 4: Client → API (settle) ── */}
              <g>
                <rect x="14" y="260" width="22" height="22" rx="6" fill="#34d399" />
                <text x="25" y="276" textAnchor="middle" fill="#064e3b" fontSize="12" fontWeight="700">4</text>
                <line x1="135" y1="272" x2="408" y2="272" stroke="#34d399" strokeWidth="1.5" markerEnd="url(#seq-right-green)" />
                <text x="270" y="266" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace">POST /invoices/:id/settle</text>
                <rect x="150" y="282" width="240" height="34" rx="6" fill="#34d399" fillOpacity="0.06" stroke="#34d399" strokeWidth="0.5" strokeOpacity="0.2" />
                <text x="270" y="297" textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="monospace">{`{ authorization: { from, to, value,`}</text>
                <text x="270" y="309" textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="monospace">{`  v, r, s, nonce, validBefore } }`}</text>
              </g>

              {/* ── Step 5: API → Blockchain (on-chain settle) ── */}
              <g>
                <rect x="14" y="332" width="22" height="22" rx="6" fill="#fbbf24" />
                <text x="25" y="348" textAnchor="middle" fill="#78350f" fontSize="12" fontWeight="700">5</text>
                <line x1="430" y1="344" x2="713" y2="344" stroke="#2dd4bf" strokeWidth="1.5" markerEnd="url(#seq-right)" />
                <text x="571" y="338" textAnchor="middle" fill="#2dd4bf" fontSize="10" fontWeight="500">settle() → receiveWithAuthorization</text>
                <text x="571" y="360" textAnchor="middle" fill="#6b7280" fontSize="9">Facilitator wallet pays gas</text>

                {/* Blockchain response */}
                <line x1="713" y1="380" x2="432" y2="380" stroke="#2dd4bf" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#seq-left-green)" />
                <text x="571" y="395" textAnchor="middle" fill="#6b7280" fontSize="9" fontFamily="monospace">txHash: 0x...</text>
              </g>

              {/* ── Step 5b: DB update ── */}
              <g>
                <path d="M420,406 C445,406 445,426 420,426" fill="none" stroke="#fbbf24" strokeWidth="1" strokeDasharray="3 2" />
                <text x="455" y="420" fill="#6b7280" fontSize="9">UPDATE invoices SET status=&apos;paid&apos;</text>
              </g>

              {/* ── Step 6: API → Client (success) ── */}
              <g>
                <rect x="14" y="440" width="22" height="22" rx="6" fill="#fbbf24" />
                <text x="25" y="456" textAnchor="middle" fill="#78350f" fontSize="12" fontWeight="700">6</text>
                <line x1="408" y1="452" x2="137" y2="452" stroke="#34d399" strokeWidth="1.5" markerEnd="url(#seq-left-green)" />
                <text x="270" y="446" textAnchor="middle" fill="#34d399" fontSize="10" fontWeight="500">{`{ verified: true, txHash }`}</text>
              </g>

              {/* ── Step 7: Client retries with invoice ID ── */}
              <g>
                <rect x="14" y="478" width="22" height="22" rx="6" fill="#34d399" />
                <text x="25" y="494" textAnchor="middle" fill="#064e3b" fontSize="12" fontWeight="700">7</text>
                <line x1="135" y1="490" x2="408" y2="490" stroke="#34d399" strokeWidth="1.5" markerEnd="url(#seq-right-green)" />
                <text x="270" y="484" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace">GET /data/premium</text>
                <text x="270" y="508" textAnchor="middle" fill="#6b7280" fontSize="9">Header: x-payment-invoice-id: inv-abc</text>
              </g>

              {/* ── Step 7 response: data ── */}
              <g>
                <line x1="408" y1="528" x2="137" y2="528" stroke="#34d399" strokeWidth="1.5" markerEnd="url(#seq-left-green)" />
                <text x="270" y="544" textAnchor="middle" fill="#34d399" fontSize="11" fontWeight="600">200 OK — premium data returned ✓</text>
              </g>
            </svg>
          </div>
        </section>

        {/* ─── x402 Protocol Headers ─── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-6 bg-conflux-teal rounded-full" />
            <h2 className="text-2xl font-bold text-white">x402 Protocol Headers</h2>
          </div>
          <p className="text-gray-400 mb-8">
            When a premium endpoint returns <code className="text-conflux-teal bg-conflux-teal/10 px-1.5 py-0.5 rounded text-xs font-mono">402 Payment Required</code>,
            these headers describe how to pay.
          </p>

          <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/60 overflow-hidden">
            <div className="px-6 py-3 bg-gray-800/40 border-b border-gray-700/50">
              <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Response Headers</span>
            </div>
            <div className="divide-y divide-gray-700/30">
              {X402_HEADERS.map((h) => (
                <div key={h.header} className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <code className="text-sm font-mono text-conflux-teal whitespace-nowrap">{h.header}</code>
                  <span className="text-sm text-gray-400">{h.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Contract Architecture ─── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-6 bg-conflux-teal rounded-full" />
            <h2 className="text-2xl font-bold text-white">Smart Contract Architecture</h2>
          </div>
          <p className="text-gray-400 mb-8">
            The settlement is multi-tenant: the buyer signs a ReceiveWithAuthorization where <code className="text-conflux-teal text-xs">to</code> is
            the verifier contract. The contract receives funds first, then forwards to the seller — preventing front-running.
          </p>

          {/* X402PaymentVerifier — full function reference */}
          <div className="rounded-2xl border border-conflux-teal/20 bg-gradient-to-b from-conflux-teal/10 to-transparent p-6 mb-8">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-lg font-semibold text-white">X402PaymentVerifier</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-conflux-teal/15 text-conflux-teal border border-conflux-teal/20">On-chain Registry + Facilitator</span>
            </div>
            <p className="text-xs text-gray-500 mb-5">
              Dual-purpose: settlement facilitator (accepts ERC-3009 signed auth, transfers tokens) and on-chain seller registry (anyone can register).
              CEI pattern + ReentrancyGuard + Ownable2Step.
            </p>

            {/* Write Functions */}
            <h4 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3">Write Functions</h4>
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700/50">
                    <th className="text-left py-2.5 px-4 font-medium">Function</th>
                    <th className="text-left py-2.5 px-4 font-medium">Who</th>
                    <th className="text-left py-2.5 px-4 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50 text-gray-400">
                  <tr>
                    <td className="py-2.5 px-4"><code className="text-white text-xs">settle(invoiceId, token, from, recipient, value, validAfter, validBefore, nonce, endpoint, v, r, s)</code></td>
                    <td className="py-2.5 px-4 whitespace-nowrap">Facilitator</td>
                    <td className="py-2.5 px-4">Submits buyer&apos;s ERC-3009 signed auth. Calls <code className="text-conflux-teal text-xs">receiveWithAuthorization</code> on the token, records payment, prevents replay.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4"><code className="text-white text-xs">refund(invoiceId)</code></td>
                    <td className="py-2.5 px-4 whitespace-nowrap">Seller only</td>
                    <td className="py-2.5 px-4">Refunds a paid invoice back to the original payer. Requires seller to have approved the contract via ERC-20 <code className="text-xs text-conflux-teal">approve()</code>.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4"><code className="text-white text-xs">refundTo(invoiceId, refundRecipient)</code></td>
                    <td className="py-2.5 px-4 whitespace-nowrap">Seller only</td>
                    <td className="py-2.5 px-4">Refunds to an alternative address (e.g., if the original payer is blocklisted by the token).</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4"><code className="text-white text-xs">registerSeller(apiBaseUrl, description)</code></td>
                    <td className="py-2.5 px-4 whitespace-nowrap">Anyone</td>
                    <td className="py-2.5 px-4">Registers caller&apos;s wallet as a seller. Stored on-chain with API URL and description.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4"><code className="text-white text-xs">updateSeller(apiBaseUrl, description)</code></td>
                    <td className="py-2.5 px-4 whitespace-nowrap">Registered seller</td>
                    <td className="py-2.5 px-4">Updates the caller&apos;s seller profile (URL, description).</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4"><code className="text-white text-xs">deactivateSeller(wallet)</code></td>
                    <td className="py-2.5 px-4 whitespace-nowrap">Self / Owner</td>
                    <td className="py-2.5 px-4">Marks a seller as inactive and removes from active list via swap-and-pop.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4"><code className="text-white text-xs">reactivateSeller(apiBaseUrl, description)</code></td>
                    <td className="py-2.5 px-4 whitespace-nowrap">Previously registered</td>
                    <td className="py-2.5 px-4">Re-registers a previously deactivated seller with a new profile.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4"><code className="text-white text-xs">setSupportedToken(token, supported)</code></td>
                    <td className="py-2.5 px-4 whitespace-nowrap">Owner only</td>
                    <td className="py-2.5 px-4">Adds or removes ERC-3009 tokens from the settlement whitelist.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Read Functions */}
            <h4 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">Read Functions</h4>
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700/50">
                    <th className="text-left py-2.5 px-4 font-medium">Function</th>
                    <th className="text-left py-2.5 px-4 font-medium">Returns</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50 text-gray-400">
                  <tr>
                    <td className="py-2.5 px-4"><code className="text-white text-xs">verifyPayment(invoiceId, amount, endpoint)</code></td>
                    <td className="py-2.5 px-4"><code className="text-xs text-emerald-400">(valid, payer)</code> &mdash; checks invoice paid with matching amount + endpoint</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4"><code className="text-white text-xs">getPayment(invoiceId)</code></td>
                    <td className="py-2.5 px-4">Full payment record: payer, recipient, amount, token, endpoint, nonce, expiry, paidAt</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4"><code className="text-white text-xs">usedNonces(bytes32)</code></td>
                    <td className="py-2.5 px-4"><code className="text-xs text-emerald-400">bool</code> &mdash; replay protection, whether nonce has been consumed</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4"><code className="text-white text-xs">getSeller(wallet)</code></td>
                    <td className="py-2.5 px-4">Seller profile: wallet, apiBaseUrl, description, active, registeredAt</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4"><code className="text-white text-xs">getActiveSellers(offset, limit)</code></td>
                    <td className="py-2.5 px-4">Paginated array of active seller profiles</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4"><code className="text-white text-xs">getSellerCount()</code></td>
                    <td className="py-2.5 px-4"><code className="text-xs text-emerald-400">uint256</code> &mdash; total registered sellers</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4"><code className="text-white text-xs">supportedTokens(address)</code></td>
                    <td className="py-2.5 px-4"><code className="text-xs text-emerald-400">bool</code> &mdash; whether a token is whitelisted for settlement</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Events */}
            <h4 className="text-sm font-semibold text-violet-400 uppercase tracking-wider mb-3">Events</h4>
            <div className="flex flex-wrap gap-2">
              {["PaymentReceived", "Refunded", "SellerRegistered", "SellerUpdated", "SellerDeactivated", "TokenSupported"].map((ev) => (
                <code key={ev} className="text-xs px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">{ev}</code>
              ))}
            </div>
          </div>

          {/* MockUSDT0 + Mainnet Tokens */}
          <div className="grid gap-5 md:grid-cols-2">
            {/* MockUSDT0 */}
            <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/10 to-transparent p-6">
              <h3 className="text-lg font-semibold text-white mb-1">MockUSDT0</h3>
              <p className="text-xs font-mono text-gray-500 mb-4">ERC-20 + ERC-3009 test token</p>
              <div className="space-y-3 text-sm text-gray-400">
                <div className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">&#x2022;</span>
                  <span><code className="text-white">transferWithAuthorization()</code> &mdash; Off-chain signed gasless transfer (ERC-3009).</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">&#x2022;</span>
                  <span><code className="text-white">receiveWithAuthorization()</code> &mdash; Anti-frontrun variant (caller must be recipient). <strong className="text-conflux-teal">Used by x402 settlement.</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">&#x2022;</span>
                  <span><code className="text-white">cancelAuthorization()</code> &mdash; Revoke unused authorization.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">&#x2022;</span>
                  <span><code className="text-white">mint()</code> &mdash; Anyone can mint on testnet (faucet).</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">&#x25CB;</span>
                  <span>6 decimals &middot; EIP-712 domain: <code className="text-white">&ldquo;USD Tether 0&rdquo;</code> v1</span>
                </div>
              </div>
            </div>

            {/* Mainnet Token Domains */}
            <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/10 to-transparent p-6">
              <h3 className="text-lg font-semibold text-white mb-1">Mainnet ERC-3009 Tokens</h3>
              <p className="text-xs font-mono text-gray-500 mb-4">Verified on-chain domain parameters</p>
              <div className="space-y-4 text-sm text-gray-400">
                <div className="bg-gray-800/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-semibold">USDT0</span>
                    <code className="text-xs text-gray-500">0xaf37...47ff</code>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <div>EIP-712 name: <code className="text-emerald-400">&ldquo;USDT0&rdquo;</code></div>
                    <div>EIP-712 version: <code className="text-emerald-400">&ldquo;1&rdquo;</code></div>
                    <div>6 decimals &middot; Chain 1030</div>
                  </div>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-semibold">AxCNH</span>
                    <code className="text-xs text-gray-500">0x70bf...ae2e</code>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <div>EIP-712 name: <code className="text-emerald-400">&ldquo;AxCNH&rdquo;</code></div>
                    <div>EIP-712 version: <code className="text-emerald-400">&ldquo;2&rdquo;</code></div>
                    <div>6 decimals &middot; Chain 1030</div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Domain mismatch = invalid signature = revert. The SDK auto-detects the correct domain via <code className="text-white">getERC3009Domain()</code>.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Nonce Handling Note ─── */}
        <section>
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6">
            <h3 className="text-white font-semibold mb-2">Nonce Handling</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              The x402 middleware generates a UUID nonce for each 402 challenge. Before EIP-712 signing,
              the SDK hashes this UUID with <code className="text-violet-400 bg-violet-500/10 px-1 py-0.5 rounded text-xs font-mono">keccak256</code> to
              produce a <code className="text-violet-400 bg-violet-500/10 px-1 py-0.5 rounded text-xs font-mono">bytes32</code> value
              required by ERC-3009. The same hashing is applied by the verifier when calling the contract.
              If integrating a non-SDK client, you must hash the UUID nonce identically.
            </p>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-sm text-gray-500">
          <span>Conflux eSpace Testnet</span>
          <Link href="/" className="text-conflux-teal hover:underline">
            Back to Home
          </Link>
        </div>
      </footer>
    </div>
  );
}
