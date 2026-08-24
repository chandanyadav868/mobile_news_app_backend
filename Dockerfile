# ==============================================================================
# Multi-Stage Production Dockerfile for NewsFlow Backend
# Optimized for Hostinger VPS & Coolify Deployments
# ==============================================================================

# ─── Stage 1: Build Stage ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools if needed
RUN apk add --no-cache openssl libc6-compat

# Copy package descriptors
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for TypeScript compilation)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and catalogs
COPY src ./src/
COPY rss-catalog ./rss-catalog/

# Build TypeScript to dist/
RUN npm run build

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

# Copy built code and assets from builder stage
COPY --from=builder /app/dist ./dist
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
