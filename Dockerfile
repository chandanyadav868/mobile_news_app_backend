# ==============================================================================
# Multi-Stage Production Dockerfile for NewsFlow Backend
# Optimized for Hostinger VPS & Coolify Deployments
# ==============================================================================

# ─── Stage 1: Build Stage ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Force development mode during build stage to bypass Coolify build-arg injection
ARG NODE_ENV=development
ENV NODE_ENV=development
ENV NPM_CONFIG_PRODUCTION=false

# Install build tools
RUN apk add --no-cache openssl libc6-compat

# Copy package descriptors
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies)
RUN npm install --legacy-peer-deps --no-audit

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and catalogs
COPY src ./src/
COPY rss-catalog ./rss-catalog/

# Build TypeScript to dist/ using tsc with skipLibCheck to guarantee clean build
RUN tsc --skipLibCheck || ./node_modules/.bin/tsc --skipLibCheck || npx tsc --skipLibCheck

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

# Install only production dependencies and global prisma CLI for schema migrations
RUN npm install -g prisma && \
    npm install --omit=dev --legacy-peer-deps --no-audit && \
    npx prisma generate && \
    npm cache clean --force

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
