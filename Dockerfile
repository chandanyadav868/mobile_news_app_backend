# ==============================================================================
# Multi-Stage Production Dockerfile for NewsFlow Backend
# Optimized for Hostinger VPS & Coolify Deployments
# ==============================================================================

# ─── Stage 1: Build Stage ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Ensure development dependencies (TypeScript, tsc) are installed even if Coolify injects NODE_ENV=production
ARG NODE_ENV=development
ENV NODE_ENV=development
ENV NPM_CONFIG_PRODUCTION=false

# Install build tools
RUN apk add --no-cache openssl libc6-compat

# Copy package descriptors
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Force install devDependencies (TypeScript) regardless of build args
RUN npm install --include=dev

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and catalogs
COPY src ./src/
COPY rss-catalog ./rss-catalog/

# Build TypeScript to dist/ using direct local binary to guarantee execution
RUN ./node_modules/.bin/tsc || npx tsc

# Copy constants JSON to dist/constants/ in builder stage
RUN mkdir -p /app/dist/constants && cp -r /app/src/constants/* /app/dist/constants/ || true

# ─── Stage 2: Production Runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install OpenSSL for Prisma engine binary
RUN apk add --no-cache openssl libc6-compat

# Copy package descriptors
COPY package*.json ./
COPY prisma ./prisma/

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Generate Prisma Client for runner environment
RUN npx prisma generate

# Copy built code, verified feeds constants, and assets from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/constants ./src/constants
COPY --from=builder /app/src/constants ./dist/constants
COPY --from=builder /app/rss-catalog ./rss-catalog

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

# Expose backend port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/v1/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
