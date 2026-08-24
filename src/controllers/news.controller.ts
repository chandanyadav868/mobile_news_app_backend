import { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { getCache, setCache } from '../services/cacheService.js';
import { ingestAllFeeds } from '../services/rssFetcher.js';

/**
 * GET /api/v1/news/feed
 * Returns unified home feed localized by country:
 * - heroArticles (5 latest articles with verified images)
 * - categoryClusters (5 latest updated categories, each with 1 lead + 2 sub-articles)
 * - visualInsights (5 latest visual insight stories)
 */
export async function getFeed(req: Request, res: Response) {
  const country = ((req.query.country as string) || 'IN').toUpperCase();
  const cacheKey = `news:feed:${country}`;

  // 1. Check Redis Cache
  const cached = await getCache<any>(cacheKey);
  if (cached) {
    return res.json({ success: true, source: 'cache', data: cached });
  }

  try {
    const countryFilter: any = {
      OR: [{ country: { equals: country } }, { country: { equals: 'GLOBAL' } }],
    };

    // 2. Fetch hero articles (5 latest with real photos)
    const heroArticles = await prisma.article.findMany({
      where: {
        imageUrl: { not: null },
        ...countryFilter,
      },
      orderBy: { publishedAt: 'desc' },
      take: 5,
    });

    // 3. Fetch latest articles across categories matching country or global
    const recentArticles = await prisma.article.findMany({
      where: countryFilter,
      orderBy: { publishedAt: 'desc' },
      take: 120,
    });

    // Group by category
    const categoryMap = new Map<string, Array<(typeof recentArticles)[0]>>();
    recentArticles.forEach((art: any) => {
      if (!categoryMap.has(art.category)) {
        categoryMap.set(art.category, []);
      }
      categoryMap.get(art.category)!.push(art);
    });

    // Sort category entries by their freshest article
    const categoryEntries = Array.from(categoryMap.entries()).map(([cat, items]) => {
      const newestTime = items[0]?.publishedAt ? new Date(items[0].publishedAt).getTime() : 0;
      return { cat, items, newestTime };
    });

    categoryEntries.sort((a, b) => b.newestTime - a.newestTime);

    // Pick top 5 latest categories
    const top5Categories = categoryEntries.slice(0, 5);

    const categoryClusters = top5Categories.map(({ cat, items }) => ({
      id: `cluster-${cat}`,
      categoryTitle: cat,
      leadNews: items[0],
      subNews: items.slice(1, 3),
    }));

    // 4. Fetch 5 latest visual insights
    const visualInsights = await prisma.insightStory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const feedData = {
      country,
      heroArticles,
      categoryClusters,
      visualInsights,
      generatedAt: new Date().toISOString(),
    };

    // Cache for 3 minutes
    await setCache(cacheKey, feedData, 180);

    return res.json({
      success: true,
      source: 'database',
      data: feedData,
    });
  } catch (error: any) {
    console.error('Error in getFeed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate news feed',
    });
  }
}

/**
 * GET /api/v1/news/category/:category
 * Returns paginated vertical slide articles for a specific category
 */
export async function getCategoryNews(req: Request, res: Response) {
  const categoryParam = req.params.category;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(5, parseInt(req.query.limit as string) || 20));
  const country = ((req.query.country as string) || 'IN').toUpperCase();

  const skip = (page - 1) * limit;
  const cacheKey = `news:category:${categoryParam.toLowerCase()}:${country}:p${page}:l${limit}`;

  const cached = await getCache<any>(cacheKey);
  if (cached) {
    return res.json({ success: true, source: 'cache', data: cached });
  }

  try {
    const isMainOrTrending =
      categoryParam.toLowerCase() === 'my feed' ||
      categoryParam.toLowerCase() === 'trending' ||
      categoryParam.toLowerCase() === 'all' ||
      categoryParam === '⏰ Daily Dose';

    const whereClause: any = isMainOrTrending
      ? { OR: [{ country: { equals: country } }, { country: { equals: 'GLOBAL' } }] }
      : {
          category: { equals: categoryParam, mode: 'insensitive' },
          OR: [{ country: { equals: country } }, { country: { equals: 'GLOBAL' } }],
        };

    const [articles, totalCount] = await Promise.all([
      prisma.article.findMany({
        where: whereClause,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.article.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    const responseData = {
      category: categoryParam,
      country,
      page,
      limit,
      totalPages,
      totalArticles: totalCount,
      articles,
    };

    await setCache(cacheKey, responseData, 180);

    return res.json({
      success: true,
      source: 'database',
      data: responseData,
    });
  } catch (error: any) {
    console.error(`Error in getCategoryNews for ${categoryParam}:`, error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch news for category: ${categoryParam}`,
    });
  }
}

/**
 * POST /api/v1/news/refresh
 * Admin manual trigger for immediate RSS ingestion & Mozilla Readability extraction
 */
export async function triggerManualIngest(req: Request, res: Response) {
  try {
    console.log('🔄 [Manual Trigger] Starting on-demand RSS ingestion...');
    const result = await ingestAllFeeds();
    return res.json({
      success: true,
      message: 'Ingestion pipeline executed successfully',
      stats: {
        scanned: result.totalScanned,
        inserted: result.newInserted,
        durationMs: result.durationMs,
      },
    });
  } catch (error: any) {
    console.error('Error during manual ingestion:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Ingestion failed',
    });
  }
}

/**
 * GET /api/v1/news/check-new
 * Lightweight real-time check to see how many new articles arrived since timestamp
 */
export async function checkNewArticles(req: Request, res: Response) {
  try {
    const { since, category, country } = req.query;
    const countryCode = (typeof country === 'string' ? country : 'IN').toUpperCase();
    const categoryParam = typeof category === 'string' ? category : 'My Feed';

    const sinceDate = since ? new Date(String(since)) : new Date(Date.now() - 3600000);

    const isMainOrTrending =
      categoryParam.toLowerCase() === 'my feed' ||
      categoryParam.toLowerCase() === 'trending' ||
      categoryParam.toLowerCase() === 'all' ||
      categoryParam === '⏰ Daily Dose';

    const whereClause: any = isMainOrTrending
      ? {
          publishedAt: { gt: sinceDate },
          OR: [{ country: { equals: countryCode } }, { country: { equals: 'GLOBAL' } }],
        }
      : {
          category: { equals: categoryParam, mode: 'insensitive' },
          publishedAt: { gt: sinceDate },
          OR: [{ country: { equals: countryCode } }, { country: { equals: 'GLOBAL' } }],
        };

    const newCount = await prisma.article.count({ where: whereClause });

    return res.json({
      success: true,
      hasNew: newCount > 0,
      count: newCount,
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.json({
      success: true,
      hasNew: false,
      count: 0,
    });
  }
}

