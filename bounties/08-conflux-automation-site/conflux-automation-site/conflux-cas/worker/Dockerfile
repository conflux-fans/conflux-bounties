# Build context: ../  (the "repos" directory containing conflux-cas and conflux-sdk)
# ── Stage 1: deps ────────────────────────────────────────────────────────────
# node:20-slim (Debian/glibc) is required for ARM64 (Ampere) compatibility:
# better-sqlite3 ships prebuilt arm64-glibc binaries but not arm64-musl (Alpine).
FROM node:20-slim AS deps

# Build tools needed by native addons: better-sqlite3, bufferutil, utf-8-validate, secp256k1
RUN apt-get update -qq && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.11.0
WORKDIR /repos

# Root workspace manifests (pnpm-lock.yaml and pnpm-workspace.yaml live at /repos root)
COPY pnpm-workspace.yaml    ./pnpm-workspace.yaml
COPY pnpm-lock.yaml         ./pnpm-lock.yaml
COPY package.json           ./package.json
# All workspace member package.json stubs (needed for pnpm to resolve workspace: deps)
COPY conflux-sdk/package.json             ./conflux-sdk/package.json
COPY conflux-contracts/package.json       ./conflux-contracts/package.json
COPY conflux-cas/package.json             ./conflux-cas/package.json
COPY conflux-cas/shared/package.json      ./conflux-cas/shared/package.json
COPY conflux-cas/backend/package.json     ./conflux-cas/backend/package.json
COPY conflux-cas/worker/package.json      ./conflux-cas/worker/package.json
COPY conflux-cas/frontend/package.json    ./conflux-cas/frontend/package.json

RUN pnpm install --frozen-lockfile --filter @cfxdevkit/sdk --filter @conflux-cas/shared --filter @conflux-cas/worker

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM deps AS builder

WORKDIR /repos
COPY conflux-sdk             ./conflux-sdk
COPY conflux-cas/shared      ./conflux-cas/shared
COPY conflux-cas/worker      ./conflux-cas/worker
COPY conflux-cas/tsconfig.base.json ./conflux-cas/tsconfig.base.json

WORKDIR /repos
RUN pnpm --filter @cfxdevkit/sdk build
RUN pnpm --filter @conflux-cas/shared build
RUN pnpm --filter @conflux-cas/worker build

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM node:20-slim AS runner
RUN apt-get update -qq && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*
# Run from the original workspace path so pnpm symlinks resolve correctly
WORKDIR /repos/conflux-cas/worker
COPY --from=builder /repos/node_modules                    /repos/node_modules
# conflux-sdk is a workspace package: node_modules/@cfxdevkit/sdk -> ../../../../conflux-sdk
# The symlink target must exist in the runner image
COPY --from=builder /repos/conflux-sdk/dist        /repos/conflux-sdk/dist
COPY --from=builder /repos/conflux-sdk/package.json /repos/conflux-sdk/package.json
COPY --from=builder /repos/conflux-cas/worker/node_modules ./node_modules
COPY --from=builder /repos/conflux-cas/worker/dist         ./dist
COPY --from=builder /repos/conflux-cas/worker/package.json ./package.json

ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
