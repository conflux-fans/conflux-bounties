# Build context: ../  (the "repos" directory containing conflux-cas and conflux-sdk)
# ── Stage 1: deps ────────────────────────────────────────────────────────────
# node:20-slim (Debian/glibc) used throughout for consistency with backend/worker.
FROM node:20-slim AS deps

# Build tools needed by native addons: bufferutil, utf-8-validate
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

RUN pnpm install --frozen-lockfile --filter @cfxdevkit/sdk --filter @conflux-cas/shared --filter @conflux-cas/frontend

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM deps AS builder

WORKDIR /repos
COPY conflux-sdk              ./conflux-sdk
COPY conflux-cas/shared       ./conflux-cas/shared
COPY conflux-cas/frontend     ./conflux-cas/frontend
COPY conflux-cas/tsconfig.base.json ./conflux-cas/tsconfig.base.json

WORKDIR /repos
RUN pnpm --filter @cfxdevkit/sdk build
RUN pnpm --filter @conflux-cas/shared build
# Override the dev default (localhost:3001) so the production bundle uses the
# Next.js catch-all proxy at /api/** instead of hitting the backend directly.
# This works for any domain without hardcoding a URL in the image.
ENV NEXT_PUBLIC_API_URL=/api
RUN pnpm --filter @conflux-cas/frontend build

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM node:20-slim AS runner
RUN apt-get update -qq && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*
# Run from the original workspace path so pnpm symlinks resolve correctly
WORKDIR /repos/conflux-cas/frontend
COPY --from=builder /repos/node_modules                      /repos/node_modules
COPY --from=builder /repos/conflux-cas/frontend/node_modules ./node_modules
COPY --from=builder /repos/conflux-cas/frontend/.next        ./.next
COPY --from=builder /repos/conflux-cas/frontend/public       ./public
COPY --from=builder /repos/conflux-cas/frontend/package.json ./package.json

ENV NODE_ENV=production
EXPOSE 3000
# Use the real Next.js binary — .bin/next is a pnpm shell shim that node cannot execute directly
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
