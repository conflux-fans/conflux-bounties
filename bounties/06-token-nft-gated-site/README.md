# Token/NFT Gated Site Boilerplate — Conflux eSpace

A production-ready Next.js 14 boilerplate for building token-gated websites on **Conflux eSpace**. Gate pages, API routes, and file downloads behind ERC20/ERC721/ERC1155 token ownership with Sign-In With Conflux (SIWC) authentication.

## Features

- **SIWC Authentication** — Wallet-based sign-in flow (nonce → sign → verify → session)
- **Token Gating Engine** — ERC20 min balance, ERC721 ownership, ERC1155 quantity checks via viem
- **Protected Routes** — Next.js middleware guards SSR pages and API routes
- **File Proxy** — Supabase Storage signed URLs with download logging
- **Admin Dashboard** — Create/edit/delete gating rules, view access logs (no redeploy needed)
- **Rate Limiting** — Per-IP/per-wallet via Upstash Redis
- **CAPTCHA Support** — Optional hCaptcha/reCAPTCHA integration
- **Docker Ready** — `docker compose up` starts web + Postgres + Redis

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- Redis 7+ (optional, for rate limiting)

### 1. Install Dependencies
```bash
cd bounties/06-token-nft-gated-site
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Set Up Database
```bash
npx prisma generate
npx prisma db push
# Optional: seed with demo rules
npm run db:seed
```

### 4. Run Development Server
```bash
npm run dev
# Open http://localhost:3000
```

### Docker Compose (Recommended)
```bash
docker compose up
# Starts web app + PostgreSQL + Redis
# Open http://localhost:3000
```

## SIWC (Sign-In With Conflux) Walkthrough

1. **User connects wallet** via MetaMask/Fluent Wallet (wagmi connectors)
2. **Frontend requests nonce** from `POST /api/auth/nonce`
3. **Message is built** in SIWC format:
   ```
   localhost wants you to sign in with your Conflux account:
   0xYourAddress

   Sign in to access token-gated content.

   URI: http://localhost:3000
   Version: 1
   Chain ID: 1030
   Nonce: <random-hex>
   Issued At: 2025-01-01T00:00:00.000Z
   ```
4. **User signs** the message in their wallet
5. **Signature is verified** server-side via `POST /api/auth/verify`
6. **Session cookie** (JWT, httpOnly) is set — user is authenticated
7. **Token balances** are checked against active gating rules
8. **Access granted/denied** based on rule evaluation (ALL/ANY logic)

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | 32+ char secret for JWT signing |
| `NEXT_PUBLIC_SIWC_DOMAIN` | ✅ | Domain for SIWC messages |
| `NEXT_PUBLIC_CONFLUX_RPC_URL` | — | Mainnet RPC (default: evm.confluxrpc.com) |
| `NEXT_PUBLIC_CONFLUX_TESTNET_RPC_URL` | — | Testnet RPC |
| `REDIS_URL` | — | Redis for rate limiting |
| `UPSTASH_REDIS_REST_URL` | — | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | — | Upstash Redis REST token |
| `SUPABASE_URL` | — | Supabase project URL |
| `SUPABASE_ANON_KEY` | — | Supabase anonymous key |
| `SUPABASE_SERVICE_KEY` | — | Supabase service role key |
| `STORAGE_BUCKET` | — | Storage bucket name (default: gated-files) |
| `ADMIN_USERNAME` | — | Admin login username (default: admin) |
| `ADMIN_PASSWORD` | — | Admin login password (default: changeme) |
| `CAPTCHA_SITE_KEY` | — | hCaptcha/reCAPTCHA site key |
| `CAPTCHA_SECRET_KEY` | — | hCaptcha/reCAPTCHA secret key |
| `NEXT_PUBLIC_WC_PROJECT_ID` | — | WalletConnect project ID |
| `DEFAULT_RULES_JSON` | — | JSON array of initial gating rules for seeding |

## Project Structure

```
├── prisma/schema.prisma        # Database models
├── src/
│   ├── app/
│   │   ├── page.tsx             # Landing page
│   │   ├── (auth)/login/        # Login page
│   │   ├── (protected)/         # Token-gated pages
│   │   │   ├── dashboard/       # User dashboard
│   │   │   └── files/           # File downloads
│   │   ├── admin/               # Rule management
│   │   │   └── logs/            # Access logs
│   │   └── api/
│   │       ├── auth/{nonce,verify,logout}/
│   │       ├── rules/           # CRUD gating rules
│   │       ├── files/[id]/      # File proxy
│   │       └── logs/            # Access log API
│   ├── lib/
│   │   ├── auth.ts              # SIWC message build/parse/verify
│   │   ├── gating.ts            # ERC20/721/1155 balance checks
│   │   ├── rate-limit.ts        # Upstash rate limiting
│   │   ├── session.ts           # JWT session management
│   │   ├── prisma.ts            # Prisma client singleton
│   │   ├── supabase.ts          # Supabase client + signed URLs
│   │   └── chains.ts            # Conflux eSpace chain definitions
│   ├── components/
│   │   ├── WalletConnect.tsx     # Wallet connect button
│   │   ├── SiwcButton.tsx        # SIWC sign-in button
│   │   ├── GatingRuleForm.tsx    # Admin rule form
│   │   ├── AccessLogTable.tsx    # Admin log viewer
│   │   └── providers.tsx         # wagmi + react-query providers
│   └── middleware.ts             # Route protection
├── tests/
│   ├── auth.test.ts              # SIWC auth tests
│   └── gating.test.ts            # Gating engine tests
├── scripts/seed.ts               # Database seeder
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Deployment

### Vercel
1. Push to GitHub
2. Import in Vercel
3. Set environment variables
4. Deploy (Prisma generates automatically via `postinstall`)

### Docker
```bash
docker compose up -d
```

### Self-hosted
```bash
npm run build
npx prisma db push
npm start
```

## Testing
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

## Security Notes

- Session tokens are **httpOnly JWT cookies** — not accessible to client-side JS
- SIWC messages expire after **5 minutes** to prevent replay attacks
- Nonces are **unique per request** and stored in the database
- Rate limiting protects against brute-force attacks
- Admin credentials are **env-based** — change defaults before deploying
- File proxy uses **short-lived signed URLs** (1-hour TTL)

## License

MIT
