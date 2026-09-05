import { prisma } from '../config/db.js';

async function checkAndCompressExisting() {
  console.log('🔍 Checking existing Article table size...');
  
  const beforeStats: any = await prisma.$queryRawUnsafe(`
    SELECT 
      pg_size_pretty(pg_total_relation_size('"Article"')) as total_size,
      pg_size_pretty(pg_relation_size('"Article"')) as table_size,
      (SELECT pg_size_pretty(pg_total_relation_size(reltoastrelid)) FROM pg_class WHERE relname = 'Article') as toast_size
  `);
  
  console.log('📊 Current Size before re-compressing existing rows:', beforeStats[0]);

  // Touch/Update existing rows that still have rawContent or summary so Postgres re-writes them using the new LZ4 algorithm
  console.log('⚙️ Re-compressing existing rows with LZ4...');
  const updatedCount = await prisma.$executeRawUnsafe(`
    UPDATE "Article"
    SET "summary" = "summary"
    WHERE "summary" IS NOT NULL;
  `);
  console.log(`✅ Rewritten & re-compressed ${updatedCount} existing articles using LZ4.`);

  // VACUUM FULL to physically compact pages and free all dead space
  console.log('🧹 Running VACUUM FULL on Article table to physically compact disk space...');
  await prisma.$executeRawUnsafe(`VACUUM FULL "Article";`);

  const afterStats: any = await prisma.$queryRawUnsafe(`
    SELECT 
      pg_size_pretty(pg_total_relation_size('"Article"')) as total_size,
      pg_size_pretty(pg_relation_size('"Article"')) as table_size,
      (SELECT pg_size_pretty(pg_total_relation_size(reltoastrelid)) FROM pg_class WHERE relname = 'Article') as toast_size
  `);
  console.log('🎉 Final Optimized Size:', afterStats[0]);

  await prisma.$disconnect();
}

checkAndCompressExisting().catch(console.error);
