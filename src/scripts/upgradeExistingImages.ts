import { PrismaClient } from '@prisma/client';
import { clearCache } from '../services/cacheService.js';

const prisma = new PrismaClient();

async function main() {
  console.log('⚡ [Fast Image Upgrade] Running SQL batch replacements for low-res thumbnails...');

  // 1. Phys.org / ScienceX: 1.6KB tiny thumbnail (/tmb/) -> 800px full HD image (/800w/)
  const physResult = await prisma.$executeRawUnsafe(`
    UPDATE "Article" 
    SET "imageUrl" = REPLACE("imageUrl", '/tmb/', '/800w/') 
    WHERE "imageUrl" LIKE '%scx1.b-cdn.net/csz/news/tmb/%';
  `);
  console.log(`✅ Upgraded ${physResult} Phys.org/ScienceX images from 1.6KB thumbnails to 800px HD photos.`);

  // 2. BBC News CDN: 240px thumbnail (/240/) -> 976px HD photo (/976/)
  const bbcResult = await prisma.$executeRawUnsafe(`
    UPDATE "Article" 
    SET "imageUrl" = REPLACE("imageUrl", '/240/', '/976/') 
    WHERE "imageUrl" LIKE '%ichef.bbci.co.uk%240%';
  `);
  console.log(`✅ Upgraded ${bbcResult} BBC images from 240px thumbnails to 976px HD photos.`);

  // 3. The Verge / Vox: Decode &#038; to &
  const vergeResult = await prisma.$executeRawUnsafe(`
    UPDATE "Article" 
    SET "imageUrl" = REPLACE("imageUrl", '&#038;', '&') 
    WHERE "imageUrl" LIKE '%&#038;%';
  `);
  console.log(`✅ Decoded ${vergeResult} The Verge URLs.`);

  // 4. Flush Redis feed & category caches
  try {
    await clearCache('news:feed:*');
    await clearCache('news:category:*');
    console.log('🧹 [Cache Cleared] Cleared stale feed and category caches in Redis.');
  } catch (e) {
    console.warn('Cache clear note:', e);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error during fast image upgrade:', err);
  process.exit(1);
});
