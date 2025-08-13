# Use Node.js 18 Alpine as base image
FROM node:18-alpine

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

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Start the application
CMD ["npm", "start"]