FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/ingestor/package.json packages/ingestor/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY packages/ingestor/ packages/ingestor/

RUN pnpm --filter @conflux-analytics/shared build
RUN pnpm --filter @conflux-analytics/ingestor build

CMD ["node", "packages/ingestor/dist/index.js"]
