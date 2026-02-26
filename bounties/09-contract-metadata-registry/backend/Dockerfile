FROM node:20

WORKDIR /app

# Build shared package first (backend depends on it)
COPY shared /shared/
RUN cd /shared && npm install && npm run build

# Backend - use workspace-style install so file:../shared resolves
COPY backend/package.json backend/package-lock.json* ./
RUN npm install

COPY backend/prisma ./prisma/
COPY backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src/

# Build with tsconfig.build.json (resolves shared from node_modules dist, not source)
RUN npx prisma generate && npx tsc -p tsconfig.build.json

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
