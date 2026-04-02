FROM node:20-slim AS base

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root config
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./

# Copy workspace packages
COPY packages/shared ./packages/shared
COPY packages/x402-sdk ./packages/x402-sdk
COPY apps/seller-api ./apps/seller-api

# Install dependencies
RUN npm install --workspace=apps/seller-api

# Build shared packages and seller-api
RUN npx tsc -p packages/shared/tsconfig.json || true
RUN npx tsc -p packages/x402-sdk/tsconfig.json || true
RUN npm run build --workspace=apps/seller-api

# Run migration then start compiled JS
CMD ["sh", "-c", "npx tsx apps/seller-api/src/db/migrate.ts && node apps/seller-api/dist/index.js"]
