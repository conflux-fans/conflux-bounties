FROM node:20-slim AS base

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root config
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./

# Copy workspace packages
COPY packages/shared ./packages/shared
COPY packages/x402-sdk ./packages/x402-sdk
COPY apps/web ./apps/web

# Install dependencies and build
RUN npm install --workspace=apps/web
RUN npm run build --workspace=apps/web

CMD ["npm", "run", "start", "--workspace=apps/web"]
