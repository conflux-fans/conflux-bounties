FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY packages/api/ packages/api/
COPY db/ db/
COPY scripts/ scripts/

RUN pnpm --filter @conflux-analytics/shared build
RUN pnpm --filter @conflux-analytics/api build

EXPOSE 3001
CMD ["node", "packages/api/dist/index.js"]
