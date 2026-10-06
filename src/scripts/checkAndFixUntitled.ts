import { prisma } from '../config/db.js';
import { redis, checkRedisHealth } from '../config/redis.js';

function extractTitleFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    const cleanSlug = last.replace(/\.[a-zA-Z0-9]+$/, '').replace(/[-_]+/g, ' ').trim();
    if (cleanSlug.length >= 6 && !/^\d+$/.test(cleanSlug)) {
      return cleanSlug
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  } catch {}
  return '';
}

function extractTitleFromSummary(summary: string): string {
  if (!summary) return '';
  const clean = summary.replace(/<[^>]*>/g, '').trim();
  const firstSentence = clean.split(/[.!?]/)[0]?.trim();
  if (firstSentence && firstSentence.length > 10) {
    const words = firstSentence.split(/\s+/).slice(0, 12).join(' ');
    return words;
  }
  return '';
}

async function run() {
  console.log('🔍 Checking database for Untitled articles...');
  const untitledArticles = await prisma.article.findMany({
    where: {
      OR: [
        { title: { equals: 'Untitled Story' } },
        { title: { startsWith: 'Untitled' } },
        { title: { equals: '' } },
      ],
    },
    take: 100,
  });

  console.log(`Found ${untitledArticles.length} Untitled articles in PostgreSQL database.`);

  let fixed = 0;
  for (const art of untitledArticles) {
    const fromSlug = extractTitleFromUrl(art.url);
    const fromSummary = extractTitleFromSummary(art.summary || art.rawContent || '');
    const newTitle = fromSlug || fromSummary || `${art.source || 'Breaking News'} Report`;

    console.log(`Fixing [${art.id}]: "${art.title}" -> "${newTitle}"`);
    await prisma.article.update({
      where: { id: art.id },
      data: { title: newTitle },
    });
    fixed++;
  }

  console.log(`✅ Successfully updated ${fixed} articles in DB.`);

  // Also clean Redis Ring Buffers if Redis is up
  if (checkRedisHealth() && redis) {
    console.log('🔄 Checking Redis ring buffers for Untitled Story...');
    const mainKey = 'news:feed:main';
    const items = await redis.lrange(mainKey, 0, 40);
    const updatedItems = items.map((raw) => {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.title === 'Untitled Story' || !parsed.title || parsed.title.startsWith('Untitled')) {
          const fromSlug = extractTitleFromUrl(parsed.url || parsed.link || '');
          const fromSummary = extractTitleFromSummary(parsed.summary || parsed.content || '');
          parsed.title = fromSlug || fromSummary || 'News Update';
          return JSON.stringify(parsed);
        }
        return raw;
      } catch {
        return raw;
      }
    });

    if (updatedItems.length > 0) {
      await redis.del(mainKey);
      await redis.rpush(mainKey, ...updatedItems);
      console.log('✅ Updated Redis main ring buffer.');
    }
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Error running script:', err);
  process.exit(1);
});
