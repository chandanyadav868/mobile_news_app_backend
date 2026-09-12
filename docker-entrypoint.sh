#!/bin/sh
set -e

echo "🚀 [NewsFlow Production Entrypoint] Preparing database schema..."

# Push Prisma schema to PostgreSQL to ensure all tables and indexes exist
npx prisma db push --skip-generate

echo "✅ [Database Sync] Prisma schema applied successfully!"

# Verify Python and SanoTTS neural synthesis runtime
echo "🐍 [Python Runtime] Verifying Python and SanoTTS..."
python3 -c "import sanotts; print('   ✅ SanoTTS Neural Engine Ready (v' + getattr(sanotts, '__version__', 'latest') + ')')" || echo "   ⚠️ SanoTTS check skipped"

# Start Node.js production server
echo "🌟 [Server Startup] Launching NewsFlow Production Server on port ${PORT:-4000}..."
exec node dist/index.js
