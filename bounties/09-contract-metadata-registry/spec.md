# Bounty #09: Conflux Contract Metadata Registry

## Overview
- **Reward**: $900
- **Difficulty**: 🟡 Medium
- **Timeline**: 3 weeks
- **Type**: Smart Contracts, IPFS, Web UI
- **Status**: 🧪 Experimental / Non-Production
- **Goal**: Build a verified metadata registry where Conflux projects upload ABI, source, logo, and descriptions for deployed contracts. Metadata lives on IPFS, and a web UI lets teams submit, update, and browse entries with validation rules.
- **Change Requests**: Share proposed tweaks during the claim process so we can approve them before assignment.

## Problem Statement
Explorers and wallets lack consistent metadata for Conflux contracts, forcing manual curation. Projects often share ABI files informally, making integrations brittle. A canonical registry contract with verifiable IPFS CIDs solves discoverability and drives ecosystem tooling.

## Solution Overview
Deliver (1) a Solidity registry contract mapping contract addresses to metadata records (IPFS CID + checksums), (2) a moderation workflow ensuring only verified owners update entries, (3) a React-based UI for submissions and search, and (4) backend services for validation, IPFS pinning, and webhook notifications to partner tools.

## Core Features
1. **Registry Contract**: Stores struct with `contractAddress`, `owner`, `metadataCid`, `version`, `status`, `lastUpdated`. Supports `submitMetadata`, `approve`, `reject`, `transferOwnership`, `setResolver`.
2. **Verification**: Ownership proof via on-chain call (e.g., `owner()`), EIP-712 signature, or ConfluxScan verification. Optionally allow multisig approvals.
3. **Metadata Schema**: JSON with ABI, bytecode hash, compiler info, logo URL, description, tags, website, social links. Validate size (<50KB) and enforce schema via zod.
4. **IPFS Integration**: Upload metadata + assets to Pinata/Web3.Storage; store CID and replicate in local cache. Provide CLI to re-pin and verify.
5. **Web App**: Submission form, status tracking, search/filter by tag, contract view page with highlighted ABI and download links; admin view for approvals.

## Technical Requirements
### Architecture
- Smart Contract: Solidity 0.8.x using OpenZeppelin Ownable + AccessControl; upgradeable via UUPS or clearly documented migration path.
- Backend: Node.js (Fastify/Express) API handling submissions, schema validation, IPFS pinning, ConfluxScan ownership checks, and webhook to notify watchers.
- Frontend: Next.js + Tailwind + wagmi wallet connect for signature-based submissions; uses server actions for SSR contract queries.
- Database: Postgres storing submissions, statuses, moderation logs, and IPFS pin records.
- Queue: BullMQ/Redis for async pinning + verification.

### Security & Validation
- Rate limiting on submissions per wallet/IP.
- Duplicate detection (same contract or CID) with manual override.
- Automatic checksum verification comparing uploaded ABI bytecode hash with on-chain code via RPC.
- Audit log of all actions; admin roles managed via RBAC.

## Deliverables
1. **Registry Contract** with tests (Hardhat/Foundry), deployment scripts, and gas report.
2. **Backend API** for submissions, callbacks, ownership checks, and IPFS operations.
3. **Web UI** for creators + admins, including status filters, search, and metadata viewer.
4. **Integration Kit**: Lightweight SDK or REST examples for wallets/explorers to consume metadata (with caching guidance).
5. **Docs & Ops**: README, API reference, metadata schema doc, runbook for re-pinning, docker-compose for local stack, testing instructions (unit + integration).

## Acceptance Criteria
- ✅ Only contract owners (or approved delegates) can publish metadata.
- ✅ Registry stores IPFS CID + checksum on-chain; UI shows proof and last update.
- ✅ Submissions undergo schema + size validation and automatic IPFS pinning.
- ✅ Public API endpoint returns metadata for any registered contract with caching headers.
- ✅ Test suite covers contracts, API validation, and e2e submission flow (>80% coverage).

## Example User Flow
1. Developer connects wallet, selects a verified contract address, and uploads ABI + description + logo.
2. Backend validates schema, pins JSON/logo to IPFS, computes checksum, and submits transaction calling `submitMetadata`.
3. Admin reviews pending entry, verifies ownership proof, and approves on-chain.
4. Wallets/explorers call public API or read registry contract to display metadata.
5. If metadata changes, developer submits new CID version; history retained in DB UI.

## Environment & Config
- `CONFLUX_RPC_URL`, `REGISTRY_ADDRESS`
- `PINATA_JWT` or `WEB3STORAGE_TOKEN`
- `DATABASE_URL`, `REDIS_URL`
- `MODERATOR_WALLET`, `WEBHOOK_URL`
- `MAX_METADATA_KB`, `ALLOWED_LOGO_MIME`

## Evaluation Criteria
- **Data Integrity (35%)**: Accurate ownership verification, checksum enforcement, IPFS redundancy.
- **Developer Experience (25%)**: Submission UX, SDK quality, documentation clarity.
- **Security & Compliance (20%)**: Rate limiting, RBAC, audit logs, minimal permissions.
- **Performance & Ops (20%)**: Caching strategy, monitoring, CI/CD with automated tests.

