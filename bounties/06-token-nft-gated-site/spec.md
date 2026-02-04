# Bounty #06: Token/NFT Gated Site Boilerplate

## Overview
- **Reward**: $800
- **Difficulty**: 🟢 Small
- **Timeline**: 2–3 weeks
- **Type**: Next.js, Auth, Web3 UX
- **Status**: 🧪 Experimental / Non-Production
- **Goal**: Production-ready boilerplate for Conflux eSpace projects that gate pages, files, and API routes based on ERC20/721/1155 balances with Sign-In With Conflux (SIWC) auth and admin-configurable rules.
- **Change Requests**: We welcome spec tweaks, but please align on them during the claim process before assignment.

## Problem Statement
Teams repeatedly rebuild wallet auth, token checks, and protected delivery when launching member portals or premium docs on Conflux. Missing reference code slows launches and invites security mistakes. A turnkey starter removes redundant effort and standardizes best practices.

## Solution Overview
Ship a Next.js app with server components, wallet connectors, and SIWC-compatible auth (via the [`siwc`](https://www.npmjs.com/package/siwc) package or a custom SIWC-style implementation) that can lock SSR/ISR pages, APIs, and downloads unless the connected address meets admin-defined token requirements. Include minimal backend for metadata caching, signed URL proxying, and anti-abuse controls (rate limits + CAPTCHA). Provide admin dashboard for rule management and audit logs.

## Core Features
1. **Auth & Sessions**: SIWE-style login (cf. `@confluxnetwork/` or viem) with Supabase/Postgres session store, refresh-safe cookies, optional email alerts.
2. **Gating Engine**: Rule builder for ERC20 min balance, ERC721 ownership, and ERC1155 quantity checks; supports multiple networks (mainnet/testnet) and combinational logic (all/any).
3. **Protected Delivery**: Server-side checks for `/app/(protected)` routes, API handlers, and asset proxy that signs short-lived URLs from Supabase storage/S3.
4. **Admin Console**: UI to define rules, upload token metadata, preview gating state, manage allowlists/deny lists, and view access logs.
5. **Anti-Abuse**: Per-IP + per-wallet rate limiting, optional hCaptcha/ReCAPTCHA on login, webhook alerts for repeated failures.

## Technical Requirements
### Architecture
- Frontend: Next.js (RSC + app router) with Tailwind UI kit, wagmi/viem wallet connectors, SSR-friendly SIWC flow.
- Backend: Next.js API routes or lightweight Hono/Express server for auth callbacks, rule evaluation, asset proxy, and metadata caching.
- Database: Supabase or PostgreSQL + Prisma for users, sessions, rules, logs.
- Storage: Supabase buckets or S3-compatible store for gated files; Cloudflare R2 acceptable.
- Rate limiting: Upstash Redis or self-hosted Redis using `@upstash/ratelimit`.

### Key Components
- **Auth Service**: Handles nonce issuance, signature verification, session issuance, and optional MFA.
- **Rule Engine**: Normalizes token configs (address, chainId, decimals, type) and evaluates balances via viem RPC calls with caching.
- **Metadata Cache**: Periodic job to fetch token names/symbols/URIs and store them for UI display.
- **Protected Middleware**: Next.js middleware + server actions that enforce gating before rendering or streaming.
- **File Proxy**: Generates signed URLs, streams blobs, and logs downloads with checksum verification.

## Deliverables
1. **Frontend + Auth**: Login, wallet switcher, profile settings, demo gated pages (SSR + client) with optimistic loading states.
2. **Gating System**: Rule definition UI + backend evaluation covering ERC20 min balance, ERC721 ownership, ERC1155 quantity.
3. **Admin & Config**: Dashboard for rules, tokens, allow/deny lists, audit log table, env-based defaults.
4. **Protected Assets**: File upload + signed delivery flow, example downloadable PDF/video, integrity checks.
5. **Docs & Tests**: README with setup, env sample, SIWE walkthrough, jest/playwright tests (~80% coverage), Postman collection for APIs.

## Acceptance Criteria
- ✅ Wallet login issues SIWE challenge, stores session securely, and expires correctly.
- ✅ SSR routes, API handlers, and file proxy all deny access when rules fail and allow when satisfied.
- ✅ Admin can add/edit/delete rules without redeploy and changes take effect within one minute.
- ✅ Rate limiting + CAPTCHA configurable via env; abuse attempts logged with metadata.
- ✅ Project ships Dockerfile + `docker compose up` running web, db, and redis locally.

## Example User Flow
1. Visitor connects wallet and signs SIWE message.
2. App checks balances via viem, caches results, and grants session token.
3. User requests `/resources/alpha`; middleware verifies rule set (e.g., 1000 XYZ or NFT #123).
4. If approved, server streams page and provides signed URL for PDF; download logged.
5. Admin dashboard shows access event and token metadata snapshot.

## Environment & Config
- `CONFLUX_RPC_URL`, `CONFLUX_TESTNET_RPC_URL`
- `NEXTAUTH_SECRET` or equivalent session secret
- `DATABASE_URL`, `REDIS_URL`, `STORAGE_BUCKET`
- `SIWC_DOMAIN`, `CAPTCHA_SITE_KEY/SECRET`
- `DEFAULT_RULES_JSON` for bootstrap configs

## Evaluation Criteria
- **Functionality (35%)**: All gating modes, asset protection, and admin workflows operate end-to-end on testnet.
- **Security (25%)**: Proper SIWE nonce handling, CSRF protection, rate limiting, and secrets management.
- **Code Quality (20%)**: Modular Next.js architecture, typed APIs, reusable hooks, meaningful tests.
- **Documentation (20%)**: Clear setup, env matrix, rule-writing guide, threat model notes, deployment instructions.

