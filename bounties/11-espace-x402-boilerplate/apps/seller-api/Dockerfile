FROM node:20-slim AS base
WORKDIR /app

COPY package.json ./
COPY packages/shared ./packages/shared
COPY packages/x402-sdk ./packages/x402-sdk
COPY apps/seller-api ./apps/seller-api

RUN npm install --workspace=apps/seller-api

# Run migration then start
CMD ["sh", "-c", "npx tsx apps/seller-api/src/db/migrate.ts && npx tsx apps/seller-api/src/index.ts"]
