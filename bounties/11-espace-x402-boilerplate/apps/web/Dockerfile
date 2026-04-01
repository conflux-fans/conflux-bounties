FROM node:20-slim AS base
WORKDIR /app

COPY package.json ./
COPY packages/shared ./packages/shared
COPY packages/x402-sdk ./packages/x402-sdk
COPY apps/web ./apps/web

RUN npm install --workspace=apps/web
RUN npm run build --workspace=apps/web

CMD ["npm", "run", "start", "--workspace=apps/web"]
