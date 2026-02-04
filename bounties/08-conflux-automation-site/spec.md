# Bounty #08: Conflux Automation Site

## Overview
- **Reward**: $1,000
- **Difficulty**: 🟡 Medium
- **Timeline**: 3–4 weeks
- **Type**: DeFi Automation, No-Code Builder
- **Status**: 🧪 Experimental / Non-Production
- **Goal**: Deliver an MVP no-code web app for creating and executing non-custodial limit-order and DCA strategies on Conflux eSpace with per-job approvals and basic safety controls.
- **Note**: This bounty is exploratory in nature. It is not expected to yield a production-ready system; rather, it aims to stimulate community creativity and surface architectural ideas or design patterns for automation.
- **Change Requests**: Open to refinements proposed during the claim discussion; lock scope before assignment.

## Problem Statement
Builders need automation but lack a safe, Conflux-native tool that lets them craft limit orders or recurring buys without handing off custody. Existing bots demand private keys or centralized services. A self-hostable automation site with on-chain execution unlocks wider adoption.

## Solution Overview
Create three layers: (1) Strategy Builder UI where users configure limit orders or DCA schedules, (2) Execution Layer that runs a worker service checking prices and submits transactions using per-job approvals, and (3) Basic Safety Controls for pausing and cancelling jobs. All logic must be non-custodial; users approve smart contracts or sign permits per strategy.

## Core Features
1. **Strategy Builder**: Forms for limit sell/buy and recurring DCA (time interval, amount, slippage). Basic validation and preview.
2. **Smart Contracts**: Minimal manager contract that stores job metadata, holds allowances (never custody), validates price targets, and emits events.
3. **Execution Worker**: Single worker service that polls for jobs, fetches prices (DEX quotes), and triggers `executeJob` with basic retry logic.
4. **Safety Controls**: Global pause switch, per-job cancel, basic guardrails (max slippage), simple audit logs.
5. **Web App**: Dashboard with job states, execution history, wallet connect (wagmi), basic notifications.

## Technical Requirements
### Architecture
- Frontend: Next.js + Tailwind, deployed on Vercel or similar.
- Backend: Simple API (Express/Fastify) for job CRUD and auth (JWT acceptable). Optional WebSocket/SSE for live updates.
- Worker: Node.js service (simple cron or queue) that polls for jobs, queries DEX prices (Swappi or Flux), and submits transactions via configured private key.
- Blockchain: Solidity smart contracts using OpenZeppelin libraries, basic permit approvals, pausable.
- Database: Postgres or SQLite storing jobs, executions, approvals.

### Key Modules
- **Job Manager Contract**: Holds job structs (owner, type, tokenIn/out, target price, interval, amount). Exposes `createJob`, `cancelJob`, `pause`, `executeJob`.
- **Price Adapter**: Library to fetch on-chain DEX price.
- **Permit Handler**: Supports permit signatures per job; executor calls contract using signed data.
- **Basic Monitoring**: Simple logging and error handling.

## Deliverables
1. **Strategy Builder**: UI for limit orders & DCA with preview, validation, and job submission.
2. **Smart Contracts**: Manager contract + deployment scripts + Hardhat tests (basic coverage).
3. **Execution Layer**: Worker service with price checks, gas estimation, and CLI to run/pause.
4. **Safety Controls**: Global pause UI, basic gas guard.
5. **Docs & Tests**: README, architecture diagram, deployment guide, unit + integration tests (≥70% coverage).

## Acceptance Criteria
- ✅ Strategies require explicit user approvals or permits; contracts never hold arbitrary funds.
- ✅ Limit orders execute only when on-chain price crosses target within configured slippage.
- ✅ DCA jobs run on schedule with basic retry logic.
- ✅ Global pause and per-job cancel stop executions and persist across restarts.
- ✅ Dashboard reflects job state and shows execution history.

## Example User Flow
1. User connects wallet, selects “DCA into CFX”, sets amount, interval, slippage, and end date.
2. App simulates route via DEX API, shows expected fills, and asks for permit approval.
3. Job stored on-chain + in DB; worker listens for interval and executes swap via contract when due.
4. Execution result streamed back to UI; user can pause or cancel anytime.
5. Admin toggles global pause during incident; workers halt and resume once resolved.

## Environment & Config
- `CONFLUX_RPC_URL`, `PRIVATE_KEY_EXECUTOR`
- `DATABASE_URL`
- `DEX_API_URL`
- `NEXT_PUBLIC_SUPPORTED_TOKENS`, `PERMIT_DOMAIN`

## Evaluation Criteria
- **Conceptual Soundness & Architecture (40%)**: Quality of the non-custodial design, safety patterns proposed, and architectural clarity.
- **Functionality & Logic (30%)**: Execution of limit orders and DCA strategies according to specification.
- **Learning Value & Documentation (30%)**: Insights for future production systems and clarity of the documentation.

