import { Request, Response } from 'express';
import crypto from 'crypto';
import { extractArticleContent } from '../services/articleExtractor.js';
import { getCache, setCache } from '../services/cacheService.js';

/**
 * POST /api/v1/news/extract
 * Extracts clean full-article text, HD hero image, and 60-word narrative using Mozilla Readability
 */
export async function extractArticle(req: Request, res: Response) {
  try {
    const { url, title, snippet, image } = req.body;

    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return res.status(400).json({
        success: false,
        error: 'Valid HTTP/HTTPS URL is required for article extraction',
      });
    }

    const urlHash = crypto.createHash('md5').update(url).digest('hex');
    const cacheKey = `news:extract:${urlHash}`;

    const cached = await getCache<any>(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        source: 'cache',
        data: cached,
      });
    }

    const extracted = await extractArticleContent(
      url,
      title || '',
      snippet || '',
      image || null
    );

    // Calculate approximate reading time (avg 200 wpm)
    const wordCount = (extracted.rawContent || '').split(/\s+/).filter(Boolean).length;
    const readingMinutes = Math.max(1, Math.round(wordCount / 200));
    const readingTime = `${readingMinutes} min read`;

    const responseData = {
      ...extracted,
      readingTime,
      wordCount,
      url,
    };

    // Cache extraction result for 1 hour
    await setCache(cacheKey, responseData, 3600);

    return res.json({
      success: true,
      source: 'live-extract',
      data: responseData,
    });
  } catch (error: any) {
    console.error('Error in article extraction:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to extract article content',
    });
  }
}
