# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Install Docker CLI for static analysis integration
RUN apk add --no-cache docker-cli

# Set working directory
WORKDIR /app

# Copy package files and prisma schema first
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including dev) for build process
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy rest of source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm ci --only=production && npm cache clean --force

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]