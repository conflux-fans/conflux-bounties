# Multi-stage build for production deployment
# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY scripts/ ./scripts/

# Build the application
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Stage 2: Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S webhook-relay -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=webhook-relay:nodejs /app/dist ./dist
COPY --from=builder --chown=webhook-relay:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=webhook-relay:nodejs /app/package*.json ./

# Copy configuration example
COPY --chown=webhook-relay:nodejs config.example.json ./

# Create directories for logs and data
RUN mkdir -p /app/logs /app/data && \
    chown -R webhook-relay:nodejs /app/logs /app/data

# Switch to non-root user
USER webhook-relay

# Expose health check port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV CONFIG_PATH=/app/config.json

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]