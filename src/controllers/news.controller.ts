import { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { getCache, setCache } from '../services/cacheService.js';
import { ingestAllFeeds } from '../services/rssFetcher.js';
import { logStream } from '../services/logStreamService.js';

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
    let heroArticles = await prisma.article.findMany({
      where: {
        imageUrl: { not: null },
        ...countryFilter,
      },
      orderBy: { publishedAt: 'desc' },
      take: 5,
    });

    if (heroArticles.length < 5) {
      heroArticles = await prisma.article.findMany({
        where: { imageUrl: { not: null } },
        orderBy: { publishedAt: 'desc' },
        take: 5,
      });
    }

    // 3. Fetch latest articles across categories matching country or global
    let recentArticles = await prisma.article.findMany({
      where: countryFilter,
      orderBy: { publishedAt: 'desc' },
      take: 200,
    });

    // Fallback: if no country-specific articles yet, take latest articles globally
    if (recentArticles.length === 0) {
      recentArticles = await prisma.article.findMany({
        orderBy: { publishedAt: 'desc' },
        take: 200,
      });
    }

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

    // Pick top categories (or guarantee all user-subscribed categories)
    let selectedCategoryEntries = categoryEntries.slice(0, 8);

    const subscribedParam = req.query.subscribedCategories as string;
    if (subscribedParam) {
      const subscribedList = subscribedParam.split(',').map((s) => s.trim()).filter(Boolean);
      for (const subCat of subscribedList) {
        if (!selectedCategoryEntries.some((e) => e.cat.toLowerCase() === subCat.toLowerCase())) {
          // Fetch latest 5 from DB / Redis for this missing subscribed category
          const missingCatArticles = await prisma.article.findMany({
            where: {
              category: { equals: subCat, mode: 'insensitive' },
            },
            orderBy: { publishedAt: 'desc' },
            take: 5,
          });
          if (missingCatArticles.length > 0) {
            selectedCategoryEntries.push({
              cat: missingCatArticles[0].category,
              items: missingCatArticles,
              newestTime: new Date(missingCatArticles[0].publishedAt).getTime(),
            });
          }
        }
      }
    }

    const categoryClusters = selectedCategoryEntries.map(({ cat, items }) => ({
      id: `cluster-${cat}`,
      categoryTitle: cat,
      leadNews: items[0],
      subNews: items.slice(1, 4),
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

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');

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

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');

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
 * Non-blocking manual trigger for immediate RSS ingestion & Mozilla Readability extraction
 */
export async function triggerManualIngest(req: Request, res: Response) {
  console.log('🔄 [Manual Trigger] Dispatched non-blocking background RSS ingestion...');
  
  // Instantly return 200 OK so client receives response in <50ms without waiting for 12s scraping
  res.json({
    success: true,
    message: 'Ingestion pipeline dispatched successfully in background',
    status: 'processing',
    timestamp: new Date().toISOString(),
  });

  // Run the ingestion task in background
  ingestAllFeeds().catch((err: any) => {
    console.error('Background ingestion error:', err);
    logStream.emitLog('error', `❌ Background ingestion failed: ${err.message}`);
  });
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
    console.error('Error in checkNewArticles:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check new articles',
      hasNew: false,
      count: 0,
    });
  }
}

/**
 * GET /api/v1/news/stream-logs
 * Server-Sent Events (SSE) live streaming of backend background activities
 */
export async function streamIngestLogs(req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders?.();

  logStream.addClient(res);

  // If query parameter trigger=true is passed, run ingestion in background
  if (req.query.trigger === 'true') {
    ingestAllFeeds().catch((err) => {
      logStream.emitLog('error', `❌ Ingestion error: ${err.message}`);
    });
  }
}

/**
 * GET /api/v1/news/logs
 * Returns recent logs buffer as standard JSON
 */
export async function getRecentLogs(_req: Request, res: Response) {
  return res.json({
    success: true,
    logs: logStream.getRecentLogs(),
  });
}

/**
 * POST /api/v1/news/translate
 * Translates a 60-word news story into Indian Regional Languages using Gemini 3.5 Live Translate
 */
export async function translateNewsArticle(req: Request, res: Response) {
  try {
    const { headline, story, bullets, targetLang } = req.body;
    if (!headline || !story) {
      return res.status(400).json({ success: false, error: 'Headline and story are required' });
    }

    const { GeminiService } = await import('../services/geminiService.js');
    const result = await GeminiService.translateStory({
      headline,
      story,
      bullets: Array.isArray(bullets) ? bullets : [],
      targetLang: targetLang || 'hi',
    });

    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error in translateNewsArticle:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/v1/news/deep-dive
 * Generates an instant fact-checking and timeline deep dive using Gemini 3 Flash Live
 */
export async function getNewsDeepDive(req: Request, res: Response) {
  try {
    const { headline, content } = req.body;
    if (!headline) {
      return res.status(400).json({ success: false, error: 'Headline is required' });
    }

    const { GeminiService } = await import('../services/geminiService.js');
    const result = await GeminiService.generateDeepDive({
      headline,
      content: content || headline,
    });

    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error in getNewsDeepDive:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/v1/news/categories
 * Returns distinct active news categories with labels, emojis, and article counts
 */
export async function getCategories(_req: Request, res: Response) {
  try {
    const rawCategories = await prisma.article.groupBy({
      by: ['category'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const categoryEmojis: Record<string, string> = {
      Technology: '💻',
      Business: '📈',
      Science: '🚀',
      Sports: '🏏',
      Entertainment: '🎬',
      Health: '🩺',
      Politics: '🏛️',
      'Top Stories': '🔥',
      World: '🌍',
      Food: '🍔',
      Travel: '✈️',
      Environment: '🌱',
      General: '📰',
    };

    const categories = rawCategories.map((c) => ({
      id: c.category,
      label: c.category,
      emoji: categoryEmojis[c.category] || '📰',
      count: c._count.id,
    }));

    return res.json({ success: true, data: categories });
  } catch (error: any) {
    console.error('Error in getCategories:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
}

/**
 * GET /api/v1/news/article/:id
 * Fetches a single article by unique ID
 */
export async function getArticleById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const article = await prisma.article.findUnique({
      where: { id },
    });

    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    return res.json({ success: true, data: article });
  } catch (error: any) {
    console.error('Error in getArticleById:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch article' });
  }
}

/**
 * POST /api/v1/news/manual
 * Creates a user-authored or manual news story
 */
export async function createManualArticle(req: Request, res: Response) {
  try {
    const { title, summary, source, category, url, imageUrl, country } = req.body;
    if (!title || !summary) {
      return res.status(400).json({ success: false, error: 'Title and description are required' });
    }

    const crypto = await import('crypto');
    const articleUrl = url && url.trim() ? url.trim() : `https://newsflow.app/story/${Date.now()}`;
    const hash = crypto.createHash('md5').update(articleUrl + Date.now()).digest('hex');

    const article = await prisma.article.create({
      data: {
        hash,
        title: title.trim(),
        summary: summary.trim(),
        source: source && source.trim() ? source.trim() : 'NewsFlow Editor',
        category: category && category.trim() ? category.trim() : 'Top Stories',
        url: articleUrl,
        imageUrl: imageUrl && imageUrl.trim() ? imageUrl.trim() : null,
        country: country || 'GLOBAL',
        publishedAt: new Date(),
      },
    });

    // Invalidate caches
    await setCache(`news:feed:IN`, null, 1);
    await setCache(`news:feed:GLOBAL`, null, 1);

    return res.json({ success: true, data: article });
  } catch (error: any) {
    console.error('Error in createManualArticle:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * PUT /api/v1/news/article/:id
 * Updates an existing news story
 */
export async function updateArticle(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { title, summary, source, category, url, imageUrl } = req.body;

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    const updated = await prisma.article.update({
      where: { id },
      data: {
        ...(title ? { title: title.trim() } : {}),
        ...(summary ? { summary: summary.trim() } : {}),
        ...(source ? { source: source.trim() } : {}),
        ...(category ? { category: category.trim() } : {}),
        ...(url !== undefined ? { url: url.trim() || `https://newsflow.app/story/${existing.id}` } : {}),
        ...(imageUrl !== undefined ? { imageUrl: imageUrl.trim() || null } : {}),
      },
    });

    // Invalidate feed caches
    await setCache(`news:feed:IN`, null, 1);
    await setCache(`news:feed:GLOBAL`, null, 1);

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error in updateArticle:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
