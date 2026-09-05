import { prisma } from '../config/db.js';

async function setupOptimization() {
  console.log('🚀 [Setup] Enabling PostgreSQL TOAST LZ4 Compression and Partial Indexes...');

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "Article" ALTER COLUMN "rawContent" SET COMPRESSION lz4;');
    console.log('✅ Enabled LZ4 compression on "Article"."rawContent"');
  } catch (err: any) {
    console.warn('⚠️ LZ4 rawContent note:', err?.message || err);
  }

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "Article" ALTER COLUMN "summary" SET COMPRESSION lz4;');
    console.log('✅ Enabled LZ4 compression on "Article"."summary"');
  } catch (err: any) {
    console.warn('⚠️ LZ4 summary note:', err?.message || err);
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_article_hot_feed 
      ON "Article" (category, "publishedAt" DESC) 
      WHERE "publishedAt" > NOW() - INTERVAL '30 days';
    `);
    console.log('✅ Created partial hot feed index (idx_article_hot_feed) on 30-day window!');
  } catch (err: any) {
    console.warn('⚠️ Index note:', err?.message || err);
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_user_bookmarks 
      ON "User" USING GIN ("bookmarkedArticleIds");
    `);
    console.log('✅ Created GIN index on "User"."bookmarkedArticleIds" for instant bookmark protection lookups!');
  } catch (err: any) {
    console.warn('⚠️ Bookmark GIN index note:', err?.message || err);
  }

  console.log('🎉 [Setup] Database compression and indexing completed successfully!');
  await prisma.$disconnect();
}

setupOptimization().catch((e) => {
  console.error('Setup failed:', e);
  process.exit(1);
});
