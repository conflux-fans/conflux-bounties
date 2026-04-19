"use client";

import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "background", label: "Background" },
  { id: "x402-protocol", label: "The x402 Protocol" },
  { id: "conflux-espace", label: "Conflux eSpace" },
  { id: "architecture", label: "Architecture" },
  { id: "payment-flow", label: "Payment Flow" },
  { id: "smart-contracts", label: "Smart Contracts" },
  { id: "erc3009", label: "ERC-3009 (Gasless Transfers)" },
  { id: "escrow", label: "Escrow & Dispute Resolution" },
  { id: "ai-agents", label: "AI Agent Integration" },
  { id: "security", label: "Security" },
  { id: "deployment", label: "Deployment" },
  { id: "see-also", label: "See Also" },
  { id: "references", label: "References" },
];

const INFOBOX: { label: string; value: string }[] = [
  { label: "Protocol", value: "x402 (HTTP 402)" },
  { label: "Network", value: "Conflux eSpace" },
  { label: "Chain IDs", value: "71 (testnet) / 1030 (mainnet)" },
  { label: "Token Standard", value: "ERC-20 + ERC-3009" },
  { label: "Payment Tokens", value: "USDT0, CNHT0 (AxCNH)" },
  { label: "Settlement", value: "On-chain escrow" },
  { label: "Signing", value: "EIP-712 typed data" },
  { label: "License", value: "MIT" },
  { label: "Language", value: "Solidity, TypeScript" },
  { label: "Framework", value: "Hardhat, Next.js, Hono" },
];

/* ------------------------------------------------------------------ */
/*  Reusable pieces                                                    */
/* ------------------------------------------------------------------ */

function WikiHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-xl font-serif font-bold text-white border-b border-gray-600/40 pb-1 mt-10 mb-3 scroll-mt-24"
    >
      {children}
    </h2>
  );
}

function WikiSubHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3
      id={id}
      className="text-lg font-serif font-semibold text-gray-200 mt-6 mb-2 scroll-mt-24"
    >
      {children}
    </h3>
  );
}

function Ref({ n }: { n: number }) {
  return (
    <sup className="text-conflux-teal/80 text-[10px] cursor-pointer hover:underline ml-[1px]">
      [{n}]
    </sup>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-gray-800/60 text-conflux-teal text-sm px-1.5 py-0.5 rounded font-mono">
      {children}
    </code>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function WikiPage() {
  const [tocOpen, setTocOpen] = useState(true);

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-white mb-1">
          x402 on Conflux eSpace
        </h1>
        <p className="text-sm text-gray-400 mb-6 italic">
          From the x402 Boilerplate project — pay-per-request APIs for humans and AI agents
        </p>

        {/* Top notice */}
        <div className="border border-conflux-teal/20 bg-conflux-teal/5 rounded-lg px-4 py-3 text-sm text-gray-300 mb-8 leading-relaxed">
          This article describes the <strong className="text-white">x402 payment protocol</strong> as
          implemented on <strong className="text-white">Conflux eSpace</strong>, covering its architecture,
          smart contracts, payment flow, AI agent integration, and security model. The boilerplate is a
          full-stack reference implementation with two independent security audits and zero
          critical/high findings.
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* ---- Infobox (right column on desktop) ---- */}
          <aside className="lg:order-2 lg:w-72 shrink-0">
            <div className="border border-gray-600/40 rounded-lg overflow-hidden bg-[#0c1e35]">
              {/* Infobox header */}
              <div className="bg-gradient-to-r from-conflux-teal/20 to-blue-600/20 px-4 py-3 text-center border-b border-gray-600/40">
                <span className="text-white font-bold font-serif text-lg">x402 Boilerplate</span>
              </div>
              {/* Logo area */}
              <div className="flex items-center justify-center py-5 border-b border-gray-600/40">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-conflux-teal to-blue-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-conflux-teal/20">
                  x402
                </div>
              </div>
              {/* KV rows */}
              <div className="divide-y divide-gray-700/40 text-sm">
                {INFOBOX.map((row) => (
                  <div key={row.label} className="flex">
                    <span className="w-[40%] px-3 py-2 text-gray-400 bg-gray-800/30 font-medium">
                      {row.label}
                    </span>
                    <span className="w-[60%] px-3 py-2 text-gray-200">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* ---- Article body (left column) ---- */}
          <article className="lg:order-1 flex-1 text-[15px] leading-relaxed text-gray-300 wiki-body">
            {/* Table of Contents */}
            <div className="border border-gray-600/40 rounded-lg bg-[#0c1e35] mb-8 overflow-hidden">
              <button
                onClick={() => setTocOpen(!tocOpen)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold text-white hover:bg-white/5 transition-colors"
              >
                <span>Contents</span>
                <span className="text-gray-500 text-xs">{tocOpen ? "[hide]" : "[show]"}</span>
              </button>
              {tocOpen && (
                <ol className="px-4 pb-3 space-y-1 text-sm list-decimal list-inside text-conflux-teal/80">
                  {TOC.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="hover:underline hover:text-conflux-teal transition-colors"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* ============ OVERVIEW ============ */}
            <WikiHeading id="overview">Overview</WikiHeading>
            <p className="mb-3">
              The <strong className="text-white">x402 Boilerplate</strong> is a production-grade,
              full-stack reference implementation of the <strong className="text-white">x402 pay-per-request
              payment protocol</strong> on <strong className="text-white">Conflux eSpace</strong>.
              <Ref n={1} /> It enables API sellers to monetize endpoints using HTTP 402 responses,
              where buyers pay with signed ERC-3009 token authorizations settled on-chain through an
              escrow-based smart contract system.
            </p>
            <p className="mb-3">
              The project consists of five components: a Next.js web client, a Hono REST API server
              with x402 middleware, an autonomous AI agent (TypeScript + LangChain), a Claude MCP
              nanobot, and Solidity smart contracts deployed on Conflux eSpace. It supports both
              testnet (chain ID 71) and mainnet (chain ID 1030) simultaneously, with network switching
              via HTTP headers.
            </p>
            <p>
              Two independent security audits were conducted using seven parallel specialist agents,
              resulting in zero critical or high-severity findings.<Ref n={2} />
            </p>

            {/* ============ BACKGROUND ============ */}
            <WikiHeading id="background">Background</WikiHeading>
            <p className="mb-3">
              HTTP status code <Code>402 Payment Required</Code> was reserved in the original HTTP/1.1
              specification (RFC 2616) for &quot;future use&quot; in digital payment systems.<Ref n={3} /> Despite
              being defined in 1999, it remained largely unused until the emergence of blockchain-based
              micropayment protocols that could fulfill its original vision of native web payments.
            </p>
            <p className="mb-3">
              The x402 protocol leverages this status code to create a machine-readable payment
              negotiation layer. When a client requests a paid resource, the server responds with
              <Code>402 Payment Required</Code> alongside structured headers specifying the price,
              accepted token, and settlement parameters. This enables both human users and autonomous
              AI agents to programmatically discover and pay for API access.
            </p>
            <p>
              Conflux eSpace provides an EVM-compatible execution environment with significantly lower
              gas costs than Ethereum mainnet, making it practical for high-frequency micropayments
              that would be economically infeasible on L1.<Ref n={4} />
            </p>

            {/* ============ x402 PROTOCOL ============ */}
            <WikiHeading id="x402-protocol">The x402 Protocol</WikiHeading>
            <p className="mb-3">
              The x402 protocol defines a standardized HTTP-based payment negotiation flow between API
              clients (buyers) and API servers (sellers). The protocol uses eight custom HTTP headers
              returned with 402 responses to communicate payment requirements:
            </p>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border border-gray-600/40 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-800/40">
                    <th className="text-left px-3 py-2 text-gray-300 font-semibold border-b border-gray-600/40">Header</th>
                    <th className="text-left px-3 py-2 text-gray-300 font-semibold border-b border-gray-600/40">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/30">
                  {[
                    ["x-payment-amount", "Price in token's smallest unit (e.g. 6 decimals for USDT0)"],
                    ["x-payment-token", "ERC-3009 compatible token contract address"],
                    ["x-payment-nonce", "Unique UUID for this specific challenge"],
                    ["x-payment-expiry", "Unix timestamp after which the invoice expires"],
                    ["x-payment-endpoint", "The API path requiring payment"],
                    ["x-payment-invoice-id", "Ephemeral invoice identifier"],
                    ["x-payment-recipient", "Seller's facilitator wallet address"],
                    ["x-payment-verifier", "X402PaymentVerifier contract address"],
                  ].map(([h, d]) => (
                    <tr key={h} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2 font-mono text-conflux-teal text-xs">{h}</td>
                      <td className="px-3 py-2 text-gray-400">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              The protocol is designed to be <strong className="text-white">machine-first</strong>: every
              parameter needed to construct a valid payment is provided in the 402 response headers,
              enabling autonomous agents to complete transactions without human intervention.
            </p>

            {/* ============ CONFLUX eSpace ============ */}
            <WikiHeading id="conflux-espace">Conflux eSpace</WikiHeading>
            <p className="mb-3">
              <strong className="text-white">Conflux eSpace</strong> is the EVM-compatible execution
              environment within the Conflux network. It provides full Ethereum tooling compatibility
              (Hardhat, wagmi, ethers.js, MetaMask) while benefiting from Conflux&apos;s Tree-Graph
              consensus mechanism, which delivers higher throughput and lower transaction fees than
              traditional PoW or PoS chains.<Ref n={4} />
            </p>
            <p className="mb-3">
              For x402, eSpace&apos;s low gas costs make on-chain settlement economically viable even for
              sub-dollar micropayments. The boilerplate supports two networks:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-3 ml-2 text-gray-400">
              <li><strong className="text-gray-200">Testnet (Chain ID 71)</strong> — Free CFX from faucet, MockUSDT0 with public minting</li>
              <li><strong className="text-gray-200">Mainnet (Chain ID 1030)</strong> — Real USDT0 (LayerZero OFT) and CNHT0 (AxCNH)</li>
            </ul>
            <p>
              Network switching is handled at the application layer via an <Code>x-chain-id</Code> HTTP
              header, allowing a single API server to service both networks simultaneously.
            </p>

            {/* ============ ARCHITECTURE ============ */}
            <WikiHeading id="architecture">Architecture</WikiHeading>
            <p className="mb-3">
              The boilerplate follows a monorepo structure with npm workspaces, organized into three
              application packages and three shared library packages:
            </p>

            <WikiSubHeading id="arch-apps">Applications</WikiSubHeading>
            <ul className="list-disc list-inside space-y-2 ml-2 text-gray-400 mb-4">
              <li>
                <strong className="text-gray-200">Web Client</strong> (Next.js 14 + React 18 + Tailwind) —
                Endpoint catalog, wallet connection via ConnectKit, EIP-712 signing UI, seller
                directory, transaction history, admin dashboard with analytics, disputes, and agent controls.
              </li>
              <li>
                <strong className="text-gray-200">Seller API</strong> (Hono + BullMQ) — REST server with
                x402 middleware that issues 402 challenges, manages invoices, performs off-chain signature
                pre-validation, submits settlements, and exposes Prometheus metrics.
              </li>
              <li>
                <strong className="text-gray-200">AI Agent</strong> (TypeScript + LangChain) — Autonomous
                API consumer that detects 402 responses, signs authorizations, settles payments, and
                retries requests within configurable spend caps and daily budgets.
              </li>
            </ul>

            <WikiSubHeading id="arch-packages">Shared Packages</WikiSubHeading>
            <ul className="list-disc list-inside space-y-2 ml-2 text-gray-400 mb-4">
              <li>
                <strong className="text-gray-200">@x402/sdk</strong> — X402Client (EIP-712 signing),
                X402Verifier (on-chain settlement), invoice ID derivation, nonce hashing.
              </li>
              <li>
                <strong className="text-gray-200">@x402/shared</strong> — TypeScript types, constants,
                header builders, token addresses, and network configuration.
              </li>
              <li>
                <strong className="text-gray-200">contracts</strong> — Solidity smart contracts with
                Hardhat compilation, deployment scripts, and test suites.
              </li>
            </ul>

            <WikiSubHeading id="arch-infra">Infrastructure</WikiSubHeading>
            <p>
              Production deployments use PostgreSQL for persistent storage, Redis for BullMQ job queues
              (invoice expiry, escrow release scheduling), and optional Prometheus + Grafana for
              monitoring. A development mode using in-memory stores requires zero external dependencies.
            </p>

            {/* ============ PAYMENT FLOW ============ */}
            <WikiHeading id="payment-flow">Payment Flow</WikiHeading>
            <p className="mb-3">
              The x402 payment flow follows a seven-step negotiation and settlement sequence:
            </p>
            <ol className="list-decimal list-inside space-y-3 mb-4 ml-2">
              <li className="text-gray-400">
                <strong className="text-gray-200">Request</strong> — Client sends
                <Code>GET /data/premium</Code> to the seller API.
              </li>
              <li className="text-gray-400">
                <strong className="text-gray-200">Challenge</strong> — Server returns
                <Code>402 Payment Required</Code> with x402 headers specifying price (e.g. 0.10 USDT0),
                token address, nonce, expiry, and the verifier contract.
              </li>
              <li className="text-gray-400">
                <strong className="text-gray-200">Sign</strong> — Client constructs an EIP-712
                <Code>ReceiveWithAuthorization</Code> typed data message and signs it with their private
                key. This is gasless for the buyer.
              </li>
              <li className="text-gray-400">
                <strong className="text-gray-200">Submit</strong> — Client POSTs the signed authorization
                to <Code>/invoices/&#123;id&#125;/settle</Code>.
              </li>
              <li className="text-gray-400">
                <strong className="text-gray-200">Pre-validate</strong> — Server recovers the signer
                off-chain and verifies balance, allowance, and nonce freshness before spending gas.
              </li>
              <li className="text-gray-400">
                <strong className="text-gray-200">Settle</strong> — Seller&apos;s facilitator wallet calls
                <Code>X402PaymentVerifier.settle()</Code>, which executes the token&apos;s
                <Code>receiveWithAuthorization()</Code> to transfer funds from buyer to the verifier
                contract (escrow).
              </li>
              <li className="text-gray-400">
                <strong className="text-gray-200">Fulfill</strong> — Server confirms on-chain settlement
                and returns the premium data to the client.
              </li>
            </ol>
            <p>
              The entire flow completes in under 30 seconds, including on-chain confirmation. The buyer
              never pays gas — only the seller&apos;s facilitator wallet submits transactions.<Ref n={1} />
            </p>

            {/* ============ SMART CONTRACTS ============ */}
            <WikiHeading id="smart-contracts">Smart Contracts</WikiHeading>

            <WikiSubHeading id="sc-verifier">X402PaymentVerifier</WikiSubHeading>
            <p className="mb-3">
              The primary settlement contract implements a multi-tenant escrow system with a seller
              registry. Key features include:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-gray-400 mb-4">
              <li><strong className="text-gray-200">Seller registration</strong> — Sellers register with an API URL, description, and configurable escrow duration (0-30 days). Optional registration fee in native CFX.</li>
              <li><strong className="text-gray-200">Settlement</strong> — Executes <Code>receiveWithAuthorization()</Code> on the token contract, transferring funds from buyer to the verifier contract. Only the registered recipient can call settle.</li>
              <li><strong className="text-gray-200">Escrow release</strong> — Permissionless after the grace period expires. Anyone can trigger release, enabling batch processing.</li>
              <li><strong className="text-gray-200">Refunds</strong> — Only the seller can initiate during the escrow period. Funds are returned to the original payer only.</li>
              <li><strong className="text-gray-200">Token timelock</strong> — New token activations require a 48-hour waiting period for safety.</li>
              <li><strong className="text-gray-200">Deterministic invoice IDs</strong> — Computed on-chain as <Code>keccak256(abi.encode(from, recipient, token, nonce))</Code>.</li>
            </ul>

            <WikiSubHeading id="sc-mockusdt">MockUSDT0</WikiSubHeading>
            <p>
              A testnet ERC-20 token implementing ERC-3009 (<Code>transferWithAuthorization</Code> and
              <Code>receiveWithAuthorization</Code>) with EIP-712 signing, dynamic domain separator for
              fork safety, public <Code>mint()</Code> for testnet use, and 6-decimal precision matching
              real USDT0.
            </p>

            {/* ============ ERC-3009 ============ */}
            <WikiHeading id="erc3009">ERC-3009 (Gasless Transfers)</WikiHeading>
            <p className="mb-3">
              ERC-3009 is a token standard that enables <strong className="text-white">gasless token
              transfers</strong> via signed authorizations.<Ref n={5} /> Unlike ERC-20&apos;s
              approve-then-transfer pattern (which requires two transactions), ERC-3009 allows a token
              holder to sign an off-chain authorization that a third party can submit on their behalf.
            </p>
            <p className="mb-3">
              The standard defines two key functions:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-gray-400 mb-4">
              <li><Code>transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)</Code> — Anyone can submit</li>
              <li><Code>receiveWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)</Code> — Only the <Code>to</Code> address can submit (front-running protection)</li>
            </ul>
            <p>
              The boilerplate uses <Code>receiveWithAuthorization</Code> exclusively, where <Code>to</Code> is
              the X402PaymentVerifier contract. This prevents front-running attacks because only the
              verifier contract (called by the seller) can execute the transfer.<Ref n={2} />
            </p>

            {/* ============ ESCROW ============ */}
            <WikiHeading id="escrow">Escrow &amp; Dispute Resolution</WikiHeading>
            <p className="mb-3">
              After settlement, funds are held in the verifier contract for a configurable escrow
              period (default 24 hours, maximum 30 days per seller). During this grace period:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-gray-400 mb-4">
              <li>The <strong className="text-gray-200">seller can refund</strong> the buyer if the service was not delivered or a dispute is filed</li>
              <li>The <strong className="text-gray-200">buyer can file a dispute</strong> through the API, which an admin reviews</li>
              <li>Funds <strong className="text-gray-200">cannot be released</strong> until the grace period expires</li>
            </ul>
            <p className="mb-3">
              After the escrow period, release is permissionless — anyone can call <Code>release()</Code> to
              send funds to the seller. The seller can also use <Code>releaseTo()</Code> to redirect funds
              to an alternative address (e.g. if the original address is blocklisted by a stablecoin
              issuer).
            </p>
            <p>
              The dispute system operates off-chain through the seller API, with on-chain refund
              capability providing the enforcement mechanism. Disputes track the requester, reason,
              admin notes, and resolution status.
            </p>

            {/* ============ AI AGENTS ============ */}
            <WikiHeading id="ai-agents">AI Agent Integration</WikiHeading>
            <p className="mb-3">
              A distinguishing feature of the x402 protocol is its suitability for <strong className="text-white">
              autonomous AI agents</strong>. Because payment parameters are fully specified in HTTP headers,
              an agent can discover, negotiate, and pay for API access without human intervention.
            </p>
            <p className="mb-3">
              The boilerplate includes two agent implementations:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 text-gray-400 mb-4">
              <li>
                <strong className="text-gray-200">LangChain Agent</strong> — Uses LLM-driven tool selection
                with tools for health checks, data fetching, compute simulation, analytics, and budget
                tracking. Operates in demo, interactive (langchain), or direct modes.
              </li>
              <li>
                <strong className="text-gray-200">Claude MCP Nanobot</strong> — An MCP server that exposes
                x402 payment tools to Claude Desktop, enabling conversational API access with automatic
                paywall handling.
              </li>
            </ul>

            <WikiSubHeading id="ai-spending">Spending Controls</WikiSubHeading>
            <p>
              Agents operate under a multi-layered budget system: per-transaction caps
              (<Code>AGENT_SPEND_CAP</Code>), daily budgets (<Code>AGENT_DAILY_BUDGET</Code>), max retry
              limits to prevent gas waste, and admin-controlled pause/resume via the API. A local
              SQLite database tracks session history and cumulative spend.
            </p>

            {/* ============ SECURITY ============ */}
            <WikiHeading id="security">Security</WikiHeading>
            <p className="mb-3">
              The security model employs multiple layers of protection:<Ref n={2} />
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 text-gray-400 mb-4">
              <li>
                <strong className="text-gray-200">Replay protection</strong> — Nonces are scoped per
                (authorizer, nonce) pair and tracked on-chain. Invoice IDs are deterministically derived,
                preventing payment misbinding. Endpoint scoping prevents cross-endpoint reuse.
              </li>
              <li>
                <strong className="text-gray-200">Front-running resistance</strong> — Using
                <Code>receiveWithAuthorization</Code> (not <Code>transferWithAuthorization</Code>) ensures
                only the designated recipient can execute the transfer.
              </li>
              <li>
                <strong className="text-gray-200">Off-chain pre-validation</strong> — Signatures are
                verified off-chain before submitting on-chain, saving gas on invalid authorizations.
              </li>
              <li>
                <strong className="text-gray-200">Reentrancy guards</strong> — The verifier contract uses
                OpenZeppelin&apos;s ReentrancyGuard and follows the checks-effects-interactions pattern.
              </li>
              <li>
                <strong className="text-gray-200">Ownership safety</strong> — Uses Ownable2Step for safe
                ownership transfers with <Code>renounceOwnership</Code> disabled.
              </li>
              <li>
                <strong className="text-gray-200">Chain ID binding</strong> — Deployment chain is recorded
                at contract creation, validated in <Code>settle()</Code> to prevent cross-chain replay.
              </li>
            </ul>
            <p>
              Two audits (March 29 and April 2, 2026) using seven specialist agents (access control,
              signatures, ERC-20, DoS, precision math, chain-specific, general) found zero critical
              and zero high-severity issues. Six medium findings were classified as design trade-offs
              inherent to the facilitator trust model.
            </p>

            {/* ============ DEPLOYMENT ============ */}
            <WikiHeading id="deployment">Deployment</WikiHeading>
            <p className="mb-3">
              The boilerplate provides automated deployment with zero manual address copying:
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2 text-gray-400 mb-4">
              <li><Code>npm run deploy:full</Code> compiles contracts and deploys to testnet</li>
              <li>A post-deploy script reads <Code>deploy-manifest.json</Code> and updates all <Code>.env</Code> files</li>
              <li>ABIs are synced from Hardhat artifacts to the SDK package</li>
              <li>The SDK is rebuilt and 100 MockUSDT0 are minted to the agent wallet</li>
              <li>Address consistency is validated across all configuration files</li>
            </ol>
            <p className="mb-3">
              Docker Compose orchestrates the full stack: PostgreSQL, Redis, Seller API, Web frontend,
              with optional profiles for the AI agent and Prometheus + Grafana monitoring.
            </p>
            <p>
              For local development, an in-memory storage mode requires zero external dependencies —
              no database or Redis needed.
            </p>

            {/* ============ SEE ALSO ============ */}
            <WikiHeading id="see-also">See Also</WikiHeading>
            <ul className="list-disc list-inside space-y-1 ml-2 text-gray-400 mb-4">
              <li>
                <Link href="/architecture" className="text-conflux-teal hover:underline">
                  Architecture Diagram
                </Link>{" "}
                — Interactive system overview
              </li>
              <li>
                <Link href="/register" className="text-conflux-teal hover:underline">
                  Seller Registration
                </Link>{" "}
                — Register as an API seller on-chain
              </li>
              <li>
                <Link href="/admin" className="text-conflux-teal hover:underline">
                  Admin Dashboard
                </Link>{" "}
                — Analytics, pricing, disputes, and agent controls
              </li>
              <li>
                <Link href="/" className="text-conflux-teal hover:underline">
                  Endpoint Catalog
                </Link>{" "}
                — Browse and interact with API endpoints
              </li>
            </ul>

            {/* ============ REFERENCES ============ */}
            <WikiHeading id="references">References</WikiHeading>
            <ol className="list-decimal list-inside space-y-2 ml-2 text-sm text-gray-500">
              <li>
                x402 Boilerplate README — Full-stack implementation documentation and acceptance criteria.
              </li>
              <li>
                Security Audit Reports (March 29 &amp; April 2, 2026) — Seven-agent parallel audit with
                zero critical/high findings.
              </li>
              <li>
                RFC 2616, Section 10.4.3 — &quot;402 Payment Required: This code is reserved for future
                use.&quot; (HTTP/1.1, June 1999).
              </li>
              <li>
                Conflux Network Documentation — eSpace EVM-compatible execution environment and
                Tree-Graph consensus.
              </li>
              <li>
                EIP-3009: Transfer With Authorization — Gasless ERC-20 transfers via signed
                authorizations (Ethereum Improvement Proposal).
              </li>
            </ol>

            {/* Footer */}
            <div className="mt-12 pt-6 border-t border-gray-700/40 text-xs text-gray-500 text-center">
              This article is part of the x402 Boilerplate project on Conflux eSpace.
              <br />
              Last updated April 2026.
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
