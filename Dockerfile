# PhantomPool Production Deployment
# Multi-stage Docker build for secure, optimized production deployment

# =============================================================================
# Stage 1: Base Node.js environment
# =============================================================================
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies for compilation
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    linux-headers \
    libc6-compat

# Copy package files
COPY package*.json ./

# =============================================================================
# Stage 2: Dependencies installation
# =============================================================================
FROM base AS deps

# Install dependencies
RUN npm ci --only=production --silent
RUN npm cache clean --force

# =============================================================================
# Stage 3: Build stage
# =============================================================================
FROM base AS builder

# Install all dependencies (including dev)
RUN npm ci --silent

# Copy source code
COPY . .

# Build the application
RUN npm run build 2>/dev/null || echo "No build script found, skipping build"

# Clean up dev dependencies
RUN npm prune --production

# =============================================================================
# Stage 4: Production runtime
# =============================================================================
FROM node:18-alpine AS runner

# Install security updates
RUN apk upgrade --no-cache

# Create non-root user for security
RUN addgroup --system --gid 1001 phantompool
RUN adduser --system --uid 1001 phantompool

# Set working directory
WORKDIR /app

# Copy production dependencies
COPY --from=deps --chown=phantompool:phantompool /app/node_modules ./node_modules

# Copy application code
COPY --chown=phantompool:phantompool . .

# Create logs directory with proper permissions
RUN mkdir -p /app/logs && chown phantompool:phantompool /app/logs

# Remove unnecessary files for production
RUN rm -rf \
    test* \
    *.test.js \
    *.spec.js \
    __tests__ \
    coverage \
    .git \
    .gitignore \
    .dockerignore \
    Dockerfile* \
    README*.md \
    docs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV LOG_LEVEL=info
ENV LOG_FORMAT=json

# Security: Run as non-root user
USER phantompool

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })"

# Start the application
CMD ["node", "src/api-server-secure.js"]