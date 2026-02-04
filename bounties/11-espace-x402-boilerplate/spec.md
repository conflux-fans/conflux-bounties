# Bounty #11: Conflux eSpace x402 Full-Stack Boilerplate

## Overview
- **Reward**: $1,400
- **Difficulty**: 🔴 Large
- **Timeline**: 5–6 weeks
- **Type**: Full-Stack, Payments, AI Agent
- **Status**: 🧪 Experimental / Non-Production
- **Goal**: Provide an end-to-end reference for x402 payments on Conflux eSpace testnet, covering seller API middleware, a web buyer UI, and an AI agent that autonomously handles encountered HTTP 402 paywalls and executes payments to access premium API resources.
- **Change Requests**: Please discuss any spec adjustments during the claim phase so we can approve them before assignment.

## Problem Statement
Developers want to monetize APIs with Conflux's x402 pay-per-request standard, but there's no holistic example showing seller setup, wallet payments, and AI agent integration. Without a boilerplate, teams struggle to adopt x402 and agents cannot learn reliable payment flows.

## Solution Overview
Deliver three cohesive apps sharing a common config: (1) Seller API with free + premium endpoints, x402 middleware, metering, and logging; (2) Web Frontend that lets humans discover APIs, connect wallet, pay invoices, and inspect call history; (3) AI Agent (LangChain/AgentKit) that calls the seller API, reacts to 402 responses by generating transactions, and retries automatically. Include docs, diagrams, and scripts for deploying on testnet (eSpace) plus optional analytics dashboard and Docker setup.

## Core Features
1. **Seller API**: Node.js (Express/Hono) server exposing endpoints such as `/health`, `/data/free`, `/data/premium`, `/compute/simulate`. x402 middleware checks headers, issues payment challenges, verifies on-chain receipts, supports per-user rate limits, and logs usage to Postgres.
2. **Payment Contracts**: Reference smart contract or library handling x402 receipts, verifying payments, and supporting features like per-endpoint pricing, subscription tiers, and refunds.
3. **Web Frontend**: Next.js app with wallet connect (Conflux Portal, WalletConnect), endpoint catalog, paywall modals, transaction status view, and faucet integration for testnet CFX. Includes admin view for API pricing + analytics (requests, revenue).
4. **AI Agent**: LangChain or similar agent that uses toolkits to call HTTP endpoints, detect 402 responses, sign transactions via configured wallet, and resume requests. Supports spending caps, retry logic, and logging.
5. **Observability & Ops**: Centralized logging (OpenSearch/ClickHouse or simple ELK), metrics dashboard, alerting when payments fail or agent exceeds cap.

## Technical Requirements
### Architecture
- Backend: Node.js (TypeScript) using Hono/Express + viem for signing/verification; includes x402 middleware, rate limiter, and job queue (BullMQ) for invoice expiration.
- Frontend: Next.js + Tailwind/shadcn, server actions for invoice creation, React Query for polling status, support for mobile and desktop.
- Agent: Python (LangChain) or TypeScript (LangGraph) script with CLI + Dockerfile; stores memory in SQLite/Postgres.
- Database: Postgres (Supabase acceptable) for API keys, invoices, receipts, usage logs, agent sessions.
- Messaging: Redis or NATS for event bus (invoice paid, refund issued).
- Deployment: Docker Compose + optional Railway/Vercel one-click config.

### Payment Flow
1. Client calls premium endpoint; server responds 402 with price, payment metadata, and ephemeral invoice ID.
2. Client (web or agent) submits on-chain payment referencing invoice ID (permit or direct transfer).
3. Seller verifies transaction via viem, updates invoice status, and fulfills original request (webhook or polling).
4. Agent handles retries, gas estimation, and failure states (insufficient funds, price change).

### Safety Controls
- Per-agent spending caps, daily budget resets, manual override.
- Web UI shows outstanding invoices, refunds, and dispute process.
- Admin can disable endpoints or rotate API keys without downtime.

## Deliverables
1. **Seller Backend**: x402 middleware, endpoints, logging, tests, CLI for pricing updates.
2. **Smart Contracts + Scripts**: Deployment to Conflux eSpace testnet, Hardhat tests, helper SDK for verifying receipts.
3. **Web Frontend**: Catalog + paywall, wallet connect, payment tracking, admin analytics, documentation for customizing branding.
4. **AI Agent**: Source code, prompt/config files, instructions for running autonomously, sample conversation showing discovery → payment → data retrieval.
5. **Docs & Tooling**: README, architecture diagram, sequence diagram, runbooks (rotate keys, refill faucet, handle disputes), Postman collection, docker-compose, CI pipeline with tests and linting.

## Acceptance Criteria
- ✅ Seller endpoints enforce x402: free endpoints open, premium return 402 until paid, then stream data.
- ✅ Web client can connect wallet, view invoice, confirm payment, and automatically re-fetch premium data.
- ✅ AI agent detects 402, submits payment transaction on testnet, and retries request within <30s.
- ✅ Logging + analytics show per-endpoint usage, revenue, and agent spend caps.
- ✅ Full stack spins up locally via `docker compose up` (API, DB, frontend, agent runner).
- ✅ Payment proof is bound to request scope (nonce/expiry + endpoint) with replay protection.
- ✅ End-to-end flow works reliably with demo scripts and documentation for quick forking.

## x402 Protocol Minimum Specification

To ensure compatibility across implementations, the following minimum specification must be implemented:

### HTTP 402 Response Format
- **Status Code**: `402 Payment Required`
- **Required Headers**:
  - `X-Payment-Amount`: Amount in CFX (wei) as decimal string
  - `X-Payment-Token`: Token address (use `0x0000000000000000000000000000000000000000` for native CFX)
  - `X-Payment-Nonce`: Unique nonce for this request (UUID or random hex string)
  - `X-Payment-Expiry`: Unix timestamp (seconds) when payment expires
  - `X-Payment-Endpoint`: Endpoint path that requires payment
  - `X-Payment-Invoice-Id`: Ephemeral invoice identifier
- **Optional Headers**:
  - `X-Payment-Description`: Human-readable description
  - `X-Payment-Recipient`: Payment recipient address (defaults to service wallet)

### Payment Verification
- Payment transactions must include invoice ID in transaction data or as a log event
- Server must verify: nonce uniqueness, expiry validity, amount match, and endpoint scope
- Replay protection: nonce + expiry + endpoint combination must be unique and non-reusable

## Example User Flow
1. Developer runs `docker compose up`; backend, frontend, DB, agent come online.
2. User opens web app, browses endpoint catalog, tries premium endpoint, sees paywall and price.
3. User pays via wallet; UI confirms transaction and displays retrieved premium data + receipt.
4. AI agent hits same endpoint programmatically, receives 402, pays via configured private key, and logs result.
5. Admin reviews analytics dashboard, adjusts pricing, and exports usage CSV for billing.

## Environment & Config
- `CONFLUX_RPC_URL`, `X402_CONTRACT_ADDRESS`, `SERVICE_WALLET_KEY`
- `DATABASE_URL`, `REDIS_URL`, `STORAGE_URL`
- `NEXT_PUBLIC_API_BASE`, `NEXT_PUBLIC_FAUCET_URL`
- `AGENT_PRIVATE_KEY`, `AGENT_SPEND_CAP`, `AGENT_POLL_INTERVAL_MS`
- `LOGGING_ENDPOINT`, `ALERT_WEBHOOK_URL`

## Evaluation Criteria
- **Completeness (35%)**: All three personas (seller, human buyer, agent) supported end-to-end.
- **Robustness (25%)**: Error handling, retries, spending caps, security controls.
- **Developer Experience (20%)**: Clarity of docs, code organization, configuration ergonomics.
- **Extensibility (20%)**: Ability to add new endpoints, pricing models, or external agents without major refactor.

