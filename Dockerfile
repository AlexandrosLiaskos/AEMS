# Multi-stage Dockerfile for AEMS Production Build

# Stage 1: Build Stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/frontend/package*.json ./apps/frontend/

# Install dependencies
RUN npm ci --only=production --ignore-scripts

# Copy source code
COPY . .

# Build applications
RUN npm run build

# Stage 2: Production Stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && addgroup -g 1001 -S aems \
    && adduser -S aems -u 1001

# Set working directory
WORKDIR /app

# Copy built applications from builder stage
COPY --from=builder --chown=aems:aems /app/dist ./dist
COPY --from=builder --chown=aems:aems /app/node_modules ./node_modules
COPY --from=builder --chown=aems:aems /app/package.json ./

# Create data directories
RUN mkdir -p /app/data /app/logs /app/backups /app/cache \
    && chown -R aems:aems /app

# Switch to non-root user
USER aems

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/apps/backend/main.js"]