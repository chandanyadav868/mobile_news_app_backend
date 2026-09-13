#!/bin/sh
set -e

echo "🚀 [NewsFlow Production Entrypoint] Preparing database schema..."

# Push Prisma schema to PostgreSQL to ensure all tables and indexes exist
npx prisma db push --skip-generate

echo "✅ [Database Sync] Prisma schema applied successfully!"

# Start Node.js production server
echo "🌟 [Server Startup] Launching NewsFlow Production Server on port ${PORT:-4000}..."
exec node dist/index.js
