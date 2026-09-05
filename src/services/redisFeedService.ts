import { redis, checkRedisHealth } from '../config/redis.js';
import { prisma } from '../config/db.js';

export const RING_BUFFER_SIZE = 20;

// Resilient in-memory backup in case Redis is restarting or offline
const inMemoryRingBuffers = new Map<string, any[]>();
const inMemorySubscribers = new Map<string, Set<string>>();

function normalizeCat(cat: string): string {
  return (cat || 'general').toLowerCase().trim();
}

/**
 * Pushes a newly ingested article into the category and main ring buffers.
 * Capped strictly at 20 articles (LTRIM 0 19).
 */
export async function pushArticleToRingBuffer(article: {
  id?: string;
  title: string;
  summary: string;
  rawContent?: string;
  url: string;
  imageUrl?: string | null;
  category: string;
  country?: string;
  source?: string;
  author?: string | null;
  publishedAt?: Date | string;
}): Promise<void> {
  const normCat = normalizeCat(article.category);
  const catKey = `news:category:${normCat}`;
  const mainKey = 'news:feed:main';
  const serialized = JSON.stringify(article);

  // 1. In-Memory Ring Buffer update (capped at 20)
  const updateMemoryBuffer = (key: string) => {
    const list = inMemoryRingBuffers.get(key) || [];
    const filtered = list.filter((a) => a.url !== article.url);
    filtered.unshift(article);
    inMemoryRingBuffers.set(key, filtered.slice(0, RING_BUFFER_SIZE));
  };

  updateMemoryBuffer(catKey);
  updateMemoryBuffer(mainKey);

  // 2. Redis Ring Buffer update (LPUSH + LTRIM 0 19)
  if (checkRedisHealth() && redis) {
    try {
      const pipeline = redis.pipeline();
      pipeline.lpush(catKey, serialized);
      pipeline.ltrim(catKey, 0, RING_BUFFER_SIZE - 1);
      pipeline.lpush(mainKey, serialized);
      pipeline.ltrim(mainKey, 0, RING_BUFFER_SIZE - 1);
      await pipeline.exec();
    } catch (err: any) {
      console.warn('⚠️ [Redis Ring Buffer] Failed to update Redis, memory updated:', err?.message || err);
    }
  }
}

/**
 * Retrieves the top 20 latest articles for a category from Redis in <1ms.
 * If Redis is cold/empty, automatically backfills from PostgreSQL.
 */
export async function getCategoryRingBuffer(category: string, limit = RING_BUFFER_SIZE): Promise<any[]> {
  const normCat = normalizeCat(category);
  const catKey = `news:category:${normCat}`;

  // 1. Try Redis LRANGE
  if (checkRedisHealth() && redis) {
    try {
      const rawList = await redis.lrange(catKey, 0, limit - 1);
      if (rawList && rawList.length > 0) {
        return rawList.map((item) => JSON.parse(item));
      }
    } catch (err) {
      console.warn(`[Redis LRANGE Warning] Failed for ${catKey}:`, err);
    }
  }

  // 2. Try In-Memory buffer
  const memList = inMemoryRingBuffers.get(catKey);
  if (memList && memList.length > 0) {
    return memList.slice(0, limit);
  }

  // 3. Cold-start backfill from PostgreSQL
  return await backfillCategoryFromDb(category, limit);
}

/**
 * Retrieves the top 20 main feed / Daily Dose articles from Redis in <1ms.
 */
export async function getMainFeedRingBuffer(country = 'IN', limit = RING_BUFFER_SIZE): Promise<any[]> {
  const mainKey = 'news:feed:main';

  // 1. Try Redis LRANGE
  if (checkRedisHealth() && redis) {
    try {
      const rawList = await redis.lrange(mainKey, 0, limit - 1);
      if (rawList && rawList.length > 0) {
        return rawList.map((item) => JSON.parse(item));
      }
    } catch (err) {
      console.warn('[Redis LRANGE Warning] Failed for main feed:', err);
    }
  }

  // 2. Try In-Memory buffer
  const memList = inMemoryRingBuffers.get(mainKey);
  if (memList && memList.length > 0) {
    return memList.slice(0, limit);
  }

  // 3. Cold-start backfill from PostgreSQL
  return await backfillMainFeedFromDb(country, limit);
}

/**
 * Backfills a category buffer from PostgreSQL when cache is empty.
 */
async function backfillCategoryFromDb(category: string, limit = RING_BUFFER_SIZE): Promise<any[]> {
  const normCat = normalizeCat(category);
  const catKey = `news:category:${normCat}`;
  try {
    const isFeedAll = category === 'All' || category === 'My Feed' || category === 'Trending' || category === '⏰ Daily Dose';
    const whereClause = isFeedAll
      ? {}
      : { category: { equals: category, mode: 'insensitive' as const } };

    const articles = await prisma.article.findMany({
      where: whereClause,
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });

    if (articles && articles.length > 0) {
      inMemoryRingBuffers.set(catKey, articles);

      if (checkRedisHealth() && redis) {
        try {
          const pipeline = redis.pipeline();
          pipeline.del(catKey);
          for (let i = articles.length - 1; i >= 0; i--) {
            pipeline.lpush(catKey, JSON.stringify(articles[i]));
          }
          pipeline.ltrim(catKey, 0, RING_BUFFER_SIZE - 1);
          await pipeline.exec();
        } catch {}
      }
      return articles;
    }
  } catch (err: any) {
    console.warn(`⚠️ [Backfill Warning] DB query failed for category ${category}:`, err?.message || err);
  }
  return [];
}

/**
 * Backfills main feed buffer from PostgreSQL when cache is empty.
 */
async function backfillMainFeedFromDb(country = 'IN', limit = RING_BUFFER_SIZE): Promise<any[]> {
  const mainKey = 'news:feed:main';
  try {
    const articles = await prisma.article.findMany({
      where: {
        imageUrl: { not: null },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });

    if (articles && articles.length > 0) {
      inMemoryRingBuffers.set(mainKey, articles);

      if (checkRedisHealth() && redis) {
        try {
          const pipeline = redis.pipeline();
          pipeline.del(mainKey);
          for (let i = articles.length - 1; i >= 0; i--) {
            pipeline.lpush(mainKey, JSON.stringify(articles[i]));
          }
          pipeline.ltrim(mainKey, 0, RING_BUFFER_SIZE - 1);
          await pipeline.exec();
        } catch {}
      }
      return articles;
    }
  } catch (err: any) {
    console.warn('⚠️ [Backfill Warning] DB query failed for main feed:', err?.message || err);
  }
  return [];
}

/**
 * Category-Targeted Subscriber Management:
 * Maps device tokens to their subscribed categories in Redis Sets.
 */
export async function subscribeDeviceToCategories(deviceToken: string, categories: string[]): Promise<void> {
  if (!deviceToken || !categories || categories.length === 0) return;

  for (const cat of categories) {
    const norm = normalizeCat(cat);
    const key = `subscribers:category:${norm}`;

    // Memory set
    if (!inMemorySubscribers.has(norm)) {
      inMemorySubscribers.set(norm, new Set());
    }
    inMemorySubscribers.get(norm)!.add(deviceToken);

    // Redis set
    if (checkRedisHealth() && redis) {
      try {
        await redis.sadd(key, deviceToken);
      } catch {}
    }
  }
}

/**
 * Retrieves all device tokens subscribed to a specific category.
 */
export async function getSubscribersForCategory(category: string): Promise<string[]> {
  const norm = normalizeCat(category);
  const key = `subscribers:category:${norm}`;

  if (checkRedisHealth() && redis) {
    try {
      const members = await redis.smembers(key);
      if (members && members.length > 0) return members;
    } catch {}
  }

  const memSet = inMemorySubscribers.get(norm);
  return memSet ? Array.from(memSet) : [];
}

/**
 * Pre-warms Redis ring buffers for all standard categories on server boot.
 */
export async function warmAllRingBuffers(): Promise<void> {
  const categories = ['technology', 'business', 'sports', 'politics', 'entertainment', 'science', 'world', 'health'];
  console.log('⚡ [Redis Ring Buffer] Pre-warming ring buffers for all categories...');
  await getMainFeedRingBuffer();
  for (const cat of categories) {
    await getCategoryRingBuffer(cat);
  }
  console.log('✅ [Redis Ring Buffer] All 20-item ring buffers warmed and ready!');
}
