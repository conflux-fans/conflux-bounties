FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

ARG VITE_API_URL=http://localhost:3001/api/v1

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/frontend/package.json packages/frontend/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY packages/frontend/ packages/frontend/

RUN pnpm --filter @conflux-analytics/shared build
RUN VITE_API_URL=$VITE_API_URL pnpm --filter @conflux-analytics/frontend build

FROM nginx:alpine
COPY --from=build /app/packages/frontend/dist /usr/share/nginx/html
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
