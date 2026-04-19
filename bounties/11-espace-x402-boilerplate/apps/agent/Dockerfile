FROM node:20-slim AS base

# Install build tools for better-sqlite3 native module
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root package files
COPY package.json package-lock.json* ./

# Copy workspace packages
COPY packages/shared ./packages/shared
COPY packages/x402-sdk ./packages/x402-sdk
COPY apps/agent ./apps/agent

# Install dependencies
RUN npm install --workspace=apps/agent

# Build shared packages
RUN npx tsc -p packages/shared/tsconfig.json || true
RUN npx tsc -p packages/x402-sdk/tsconfig.json || true

# Environment variables (set at runtime)
ENV API_BASE=http://host.docker.internal:4000
ENV LOG_LEVEL=info

# Default command: run the demo
CMD ["npx", "tsx", "apps/agent/src/index.ts", "demo"]
