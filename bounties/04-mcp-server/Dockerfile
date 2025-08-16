# Multi-stage Docker build for Conflux MCP Server
# Optimized for HTTP/SSE transport and production deployment

# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install bun for building
RUN apk add --no-cache curl bash && \
    curl -fsSL https://bun.sh/install | bash && \
    mv /root/.bun/bin/bun /usr/local/bin/

# Copy package files
COPY package*.json ./
COPY bun.lock* ./

# Install dependencies
RUN bun install

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application using bun
RUN bun run build && bun run build:http

# Stage 2: Runtime stage
FROM node:18-alpine AS runtime

# Create non-root user for security
RUN addgroup -g 1001 -S conflux && \
    adduser -S conflux -u 1001

# Set working directory
WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Copy package files for production dependencies
COPY package*.json ./

# Install production dependencies only
RUN npm install --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/build ./build

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create logs and config directories
RUN mkdir -p /app/logs /app/config && chown -R conflux:conflux /app

# Change to non-root user
USER conflux

# Expose port
ARG MCP_SERVER_PORT=3333
ENV MCP_SERVER_PORT=${MCP_SERVER_PORT}
EXPOSE ${MCP_SERVER_PORT}

# Add health check (conditional based on mode)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD if [ "$MCP_MODE" = "stdio" ]; then exit 0; else curl -f http://localhost:$MCP_SERVER_PORT/health || exit 1; fi

# Set environment variables
ENV NODE_ENV=production
ENV PORT=${MCP_SERVER_PORT}
ENV HOST=0.0.0.0

# Add labels for metadata
LABEL maintainer="Conflux MCP Server Team"
LABEL description="Conflux MCP Server with HTTP/SSE and STDIO transport for MCP clients"
LABEL version="1.0.0"

# Use the entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"] 