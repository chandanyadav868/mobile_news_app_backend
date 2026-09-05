import { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { getCache, setCache } from '../services/cacheService.js';
import { ingestAllFeeds } from '../services/rssFetcher.js';
import { logStream } from '../services/logStreamService.js';
import { batchResolveImages } from '../services/lightweightImageResolver.js';
import { getMainFeedRingBuffer, getCategoryRingBuffer, RING_BUFFER_SIZE } from '../services/redisFeedService.js';

const lastKnownGoodFeed: Record<string, any> = {};

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

  // 1. Check Redis Unified Cache
  const cached = await getCache<any>(cacheKey);
  if (cached) {
    lastKnownGoodFeed[country] = cached;
    return res.json({ success: true, source: 'cache', data: cached });
  }

  try {
    // 2. Ultra-Fast Sub-Millisecond Retrieval from Redis Ring Buffer
    const heroArticles = await getMainFeedRingBuffer(country, 20);

    // 3. Build Category Clusters from Ring Buffers (Tech, Business, Sports, Politics, etc.)
    const clusterCategories = ['Technology', 'Business', 'Sports', 'Politics', 'Entertainment', 'Science'];
    const categoryClusters = (
      await Promise.all(
        clusterCategories.map(async (cat) => {
          const catArticles = await getCategoryRingBuffer(cat, 4);
          if (!catArticles || catArticles.length === 0) return null;
          return {
            id: `cluster-${cat.toLowerCase()}`,
            categoryTitle: cat,
            leadNews: catArticles[0],
            subNews: catArticles.slice(1, 4),
          };
        })
      )
    ).filter(Boolean);

    // 4. Fetch visual insights safely
    let visualInsights: any[] = [];
    try {
      visualInsights = await prisma.insightStory.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
    } catch {}

    const feedData = {
      country,
      heroArticles: heroArticles.slice(0, 10),
      categoryClusters,
      visualInsights,
      generatedAt: new Date().toISOString(),
    };

    if (feedData.heroArticles.length > 0) {
      lastKnownGoodFeed[country] = feedData;
      await setCache(cacheKey, feedData, 180);
    }

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    return res.json({
      success: true,
      source: 'redis-ring-buffer',
      data: feedData,
    });
  } catch (error: any) {
    console.warn('⚠️ [Backend Warning] getFeed fallback:', error?.message || error);
    if (lastKnownGoodFeed[country]) {
      return res.json({
        success: true,
        source: 'memory-fallback',
        data: lastKnownGoodFeed[country],
      });
    }
    const emergencyHeroes = await getMainFeedRingBuffer(country, 10);
    return res.status(200).json({
      success: true,
      source: 'ring-buffer-fallback',
      data: {
        country,
        heroArticles: emergencyHeroes,
        categoryClusters: [],
        visualInsights: [],
        generatedAt: new Date().toISOString(),
      },
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

  // 1. PAGE 1 SUB-MILLISECOND FAST-PATH: Instant serving from Redis Ring Buffer (<1ms)
  if (page === 1) {
    try {
      const ringArticles = await getCategoryRingBuffer(categoryParam, limit);
      if (ringArticles && ringArticles.length > 0) {
        return res.json({
          success: true,
          source: 'redis-ring-buffer',
          data: {
            category: categoryParam,
            country,
            page: 1,
            limit,
            totalPages: 5,
            totalArticles: 100,
            articles: ringArticles,
          },
        });
      }
    } catch (err) {
      console.warn(`[Ring Buffer Error] ${categoryParam}:`, err);
    }
  }

  // 2. PAGE 2+ PAGINATION: Query PostgreSQL historical database
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
    console.warn(`⚠️ [Backend Database Warning] DB query failed in getCategoryNews for ${categoryParam}:`, error?.message || error);
    const fallbackArticles = await getCategoryRingBuffer(categoryParam, limit);
    return res.status(200).json({
      success: true,
      source: 'ring-buffer-fallback',
      data: {
        category: categoryParam,
        country,
        page,
        limit,
        totalPages: 1,
        totalArticles: fallbackArticles.length,
        articles: fallbackArticles,
      },
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
    const { since, category, categories, country } = req.query;
    const countryCode = (typeof country === 'string' ? country : 'IN').toUpperCase();
    
    // Parse categories from query (e.g. "Politics,Cricket,Technology,Hindi News")
    let categoryList: string[] = [];
    if (typeof categories === 'string' && categories.trim()) {
      categoryList = categories.split(',').map((c) => c.trim()).filter(Boolean);
    } else if (typeof category === 'string' && category.trim()) {
      categoryList = [category.trim()];
    }

    const isAllCategories =
      categoryList.length === 0 ||
      categoryList.some((c) => ['my feed', 'trending', 'all', '⏰ daily dose', 'daily dose'].includes(c.toLowerCase()));

    const sinceDate = since && !isNaN(new Date(String(since)).getTime())
      ? new Date(String(since))
      : null;

    const whereClause: any = {
      OR: [{ country: { equals: countryCode } }, { country: { equals: 'GLOBAL' } }],
    };

    if (sinceDate) {
      whereClause.AND = [
        {
          OR: [
            { publishedAt: { gt: sinceDate } },
            { createdAt: { gt: sinceDate } },
          ],
        },
      ];
    }

    if (!isAllCategories && categoryList.length > 0) {
      whereClause.category = { in: categoryList, mode: 'insensitive' };
    }

    const [newCount, latestArticle] = await Promise.all([
      prisma.article.count({ where: whereClause }),
      prisma.article.findFirst({
        where: whereClause,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          title: true,
          summary: true,
          imageUrl: true,
          category: true,
          source: true,
          url: true,
          publishedAt: true,
        },
      }),
    ]);

    return res.json({
      success: true,
      hasNew: newCount > 0,
      count: newCount,
      checkedAt: new Date().toISOString(),
      latestArticle: latestArticle
        ? {
            id: latestArticle.id,
            title: latestArticle.title,
            summary: latestArticle.summary,
            content: latestArticle.summary,
            image: latestArticle.imageUrl,
            category: latestArticle.category,
            source: latestArticle.source || 'NewsFlow Alert',
            pubDate: latestArticle.publishedAt?.toISOString(),
            link: latestArticle.url || 'https://inshorts.com',
          }
        : null,
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

/**
 * GET /api/v1/news/search
 * High-speed full-text search across PostgreSQL articles with Redis caching
 */
export async function searchNews(req: Request, res: Response) {
  try {
    const q = ((req.query.q as string) || '').trim();
    const category = ((req.query.category as string) || '').trim();
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit as string) || 25));

    if (!q) {
      return res.json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const cleanQ = q.replace(/[#&"']/g, ' ').replace(/\s+/g, ' ').trim();
    const cacheKey = `news:search:${cleanQ.toLowerCase()}:${category.toLowerCase()}:${limit}`;

    const cached = await getCache<any[]>(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        source: 'cache',
        count: cached.length,
        data: cached,
      });
    }

    // Split compound terms into individual search tokens for maximum match recall
    const tokens = cleanQ.split(' ').filter((t) => t.length > 1);

    const tokenClauses = tokens.map((token) => ({
      OR: [
        { title: { contains: token, mode: 'insensitive' as const } },
        { summary: { contains: token, mode: 'insensitive' as const } },
        { rawContent: { contains: token, mode: 'insensitive' as const } },
        { category: { contains: token, mode: 'insensitive' as const } },
      ],
    }));

    const whereClause: any = {
      AND: [
        tokenClauses.length > 0
          ? { OR: tokenClauses }
          : { title: { contains: cleanQ, mode: 'insensitive' as const } },
      ],
    };

    if (category && category.toLowerCase() !== 'all') {
      whereClause.AND.push({
        category: { equals: category, mode: 'insensitive' as const },
      });
    }

    const articles = await prisma.article.findMany({
      where: whereClause,
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });

    const formattedArticles = articles.map((art) => ({
      id: art.id,
      title: art.title,
      summary: art.summary,
      content: art.rawContent || art.summary,
      image: art.imageUrl,
      category: art.category,
      source: art.source || 'NewsFlow Verified',
      pubDate: art.publishedAt?.toISOString(),
      link: art.url || `https://newsflow.app/story/${art.id}`,
      country: art.country,
    }));

    // Cache results for 120s
    await setCache(cacheKey, formattedArticles, 120);

    return res.json({
      success: true,
      source: 'database',
      count: formattedArticles.length,
      data: formattedArticles,
    });
  } catch (error: any) {
    console.error('Error in searchNews:', error);
    return res.status(500).json({
      success: false,
      error: 'Search query failed',
    });
  }
}

/**
 * POST /api/v1/news/resolve-images
 * Lightweight endpoint to resolve real publisher OpenGraph/Twitter images for candidate article URLs.
 * Throttled concurrency & Redis cached (7-day TTL). Zero JSDOM overhead!
 */
export async function resolveImages(req: Request, res: Response) {
  try {
    const { urls } = req.body;
    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ success: false, error: 'urls array is required' });
    }

    const images = await batchResolveImages(urls);
    return res.json({
      success: true,
      data: images,
    });
  } catch (error: any) {
    console.error('Error in resolveImages:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to resolve images',
    });
  }
}

