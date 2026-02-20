# Bounty 06: Token/NFT Gated Site — Build Instructions

## Goal
Build the complete Token/NFT Gated Site Boilerplate inside `bounties/06-token-nft-gated-site/`
Reward: $800 from conflux-fans/conflux-bounties issue #12

## Spec File
Read the full spec at: `bounties/06-token-nft-gated-site/spec.md`

## Structure to Build
Build EVERYTHING inside `bounties/06-token-nft-gated-site/`. 
Reference a completed bounty: `bounties/04-mcp-server/` for the file/directory style.

## What to Build
A Next.js 14 App Router boilerplate with:

### Core Stack
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui components
- wagmi v2 + viem for Conflux eSpace wallet connection
- Supabase for Postgres DB + session store + Storage
- Prisma ORM
- Upstash Redis for rate limiting
- SIWC (Sign-In With Conflux) - similar to SIWE but for Conflux

### Key Features

#### 1. Auth & Sessions
- SIWC wallet auth flow (nonce → sign → verify → session)
- Use `next-auth` or custom session with Supabase
- Refresh-safe httpOnly cookies
- Session expiry handling

#### 2. Gating Engine  
- Support ERC20 minimum balance checks
- Support ERC721 ownership checks  
- Support ERC1155 quantity checks
- Multiple networks: Conflux eSpace mainnet (chainId: 1030) + testnet (chainId: 71)
- Combinational logic: ALL rules must pass OR ANY rule passes
- Cache balance results in Redis (5-min TTL)

#### 3. Protected Routes
- Next.js middleware for `/app/(protected)/*` routes
- API route guards
- SSR page protection

#### 4. File Proxy
- Supabase storage + signed URL generation (1-hour TTL)
- Download logging
- Content-type detection

#### 5. Admin Dashboard (`/admin`)
- Create/edit/delete gating rules
- View access logs table
- Token metadata display
- Manual cache invalidation
- Simple username/password auth (env: ADMIN_USERNAME, ADMIN_PASSWORD)

#### 6. Rate Limiting
- Per-IP + per-wallet limits using Upstash Redis
- Configurable via env vars
- Optional hCaptcha/reCAPTCHA on login (env: CAPTCHA_SITE_KEY optional)

### File Structure to Create

```
bounties/06-token-nft-gated-site/
├── README.md                 # Setup, env vars, deployment guide
├── spec.md                   # (already exists)
├── Dockerfile
├── docker-compose.yml        # web + db + redis
├── .env.example
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── prisma/
│   └── schema.prisma         # User, Session, GatingRule, AccessLog tables
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx          # Landing page with wallet connect demo
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (protected)/
│   │   │   ├── dashboard/page.tsx   # Shows token-gated content
│   │   │   └── files/page.tsx       # Protected file download
│   │   ├── admin/
│   │   │   ├── page.tsx             # Rule management
│   │   │   └── logs/page.tsx        # Access logs
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── nonce/route.ts   # SIWC nonce
│   │       │   ├── verify/route.ts  # Signature verification
│   │       │   └── logout/route.ts
│   │       ├── rules/route.ts       # CRUD gating rules
│   │       ├── files/[id]/route.ts  # Signed URL proxy
│   │       └── logs/route.ts        # Access log fetch
│   ├── lib/
│   │   ├── auth.ts           # SIWC auth helpers
│   │   ├── gating.ts         # Token balance checking logic
│   │   ├── rate-limit.ts     # Upstash Redis rate limiting
│   │   ├── session.ts        # Session management
│   │   ├── prisma.ts         # Prisma client
│   │   └── supabase.ts       # Supabase client
│   ├── middleware.ts          # Route protection middleware
│   └── components/
│       ├── WalletConnect.tsx  # wagmi wallet connect button
│       ├── SiwcButton.tsx     # Sign-In With Conflux button
│       ├── GatingRuleForm.tsx # Admin rule creator
│       └── AccessLogTable.tsx # Admin log viewer
├── scripts/
│   └── seed.ts               # Seed DB with example rules
└── tests/
    ├── gating.test.ts        # Unit tests for balance checking
    └── auth.test.ts          # Unit tests for SIWC flow
```

### Key Implementation Details

#### SIWC Message Format (similar to SIWE)
```
conflux.network wants you to sign in with your Conflux account:
{address}

{statement}

URI: {uri}
Version: 1
Chain ID: 1030
Nonce: {nonce}
Issued At: {issuedAt}
```

#### Conflux eSpace Chain Config (wagmi)
```typescript
import { defineChain } from 'viem'

export const confluxESpace = defineChain({
  id: 1030,
  name: 'Conflux eSpace',
  nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evm.confluxrpc.com'] },
  },
  blockExplorers: {
    default: { name: 'ConfluxScan', url: 'https://evm.confluxscan.io' },
  },
})

export const confluxESpaceTestnet = defineChain({
  id: 71,
  name: 'Conflux eSpace Testnet',
  nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evmtestnet.confluxrpc.com'] },
  },
  blockExplorers: {
    default: { name: 'ConfluxScan Testnet', url: 'https://evmtestnet.confluxscan.io' },
  },
})
```

#### Balance Check via viem
```typescript
import { createPublicClient, http, erc20Abi, erc721Abi } from 'viem'

// ERC20 check
const balance = await client.readContract({
  address: tokenAddress as `0x${string}`,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [userAddress as `0x${string}`],
})

// ERC721 check  
const nftBalance = await client.readContract({
  address: nftAddress as `0x${string}`,
  abi: erc721Abi,
  functionName: 'balanceOf',
  args: [userAddress as `0x${string}`],
})
```

#### Prisma Schema
```prisma
model GatingRule {
  id          String   @id @default(cuid())
  name        String
  description String?
  contractAddress String
  contractType    String // ERC20 | ERC721 | ERC1155
  chainId         Int
  minBalance      String @default("1") // as string to handle BigInt
  tokenId         String? // for ERC1155
  logic           String @default("ALL") // ALL | ANY
  isActive        Boolean @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  accessLogs  AccessLog[]
}

model Session {
  id          String   @id @default(cuid())
  address     String
  chainId     Int
  nonce       String   @unique
  issuedAt    DateTime
  expiresAt   DateTime
  createdAt   DateTime @default(now())
}

model AccessLog {
  id          String   @id @default(cuid())
  address     String
  path        String
  ruleId      String?
  granted     Boolean
  reason      String?
  ipAddress   String?
  createdAt   DateTime @default(now())
  rule        GatingRule? @relation(fields: [ruleId], references: [id])
}
```

#### .env.example
```
NEXT_PUBLIC_CONFLUX_RPC_URL=https://evm.confluxrpc.com
NEXT_PUBLIC_CONFLUX_TESTNET_RPC_URL=https://evmtestnet.confluxrpc.com
DATABASE_URL=postgresql://postgres:password@localhost:5432/gated_site
REDIS_URL=redis://localhost:6379
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
STORAGE_BUCKET=gated-files
SIWC_DOMAIN=localhost
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
CAPTCHA_SITE_KEY=
CAPTCHA_SECRET_KEY=
DEFAULT_RULES_JSON=[{"name":"Demo","contractAddress":"0x...","contractType":"ERC20","minBalance":"1","chainId":1030}]
```

## Quality Requirements
- TypeScript throughout (strict mode)
- All acceptance criteria from spec.md must be met
- Docker Compose works: `docker compose up`
- README with clear setup guide, env vars, and SIWC walkthrough
- Unit tests for gating engine and auth
- No shortcuts — build the full spec

## Review Requirements
After building, do TWO review passes:
1. Check all spec.md acceptance criteria are met
2. Verify docker-compose.yml works and README setup instructions are correct

## Submit
After passing both reviews:
```
git add -A
git commit -m "feat: Bounty 06 — Token/NFT Gated Site Boilerplate"
```

When done, run:
openclaw system event --text "Done: Conflux Bounty 06 Token/NFT Gated Site built and committed. Ready for PR." --mode now
