import crypto from 'crypto';
import Parser from 'rss-parser';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { prisma } from '../config/db.js';
import { invalidateFeedCache } from './cacheService.js';
import { extractArticleContent } from './articleExtractor.js';

const parser = new Parser({
  timeout: 8000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; NewsFlow-Engine/1.0)',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
});

export interface ParsedArticle {
  hash: string;
  title: string;
  summary: string;
  rawContent: string;
  url: string;
  imageUrl: string | null;
  category: string;
  country: string;
  source: string;
  author: string | null;
  publishedAt: Date;
}

export function generateArticleHash(url: string): string {
  const normalized = url.trim().toLowerCase().split('?')[0];
  return crypto.createHash('md5').update(normalized).digest('hex');
}

function extractSource(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace('www.', '');
    const parts = host.split('.');
    return parts.length > 1 ? parts[parts.length - 2].toUpperCase() : host.toUpperCase();
  } catch {
    return 'NEWSFLOW';
  }
}

function extractItemImage(itemXml: string): string | null {
  const mediaContent = itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (mediaContent && isValidImageUrl(mediaContent[1])) return mediaContent[1].trim();

  const mediaThumb = itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
  if (mediaThumb && isValidImageUrl(mediaThumb[1])) return mediaThumb[1].trim();

  const enclosure = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if (enclosure && isValidImageUrl(enclosure[1])) return enclosure[1].trim();

  const imgTag = itemXml.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgTag && isValidImageUrl(imgTag[1])) return imgTag[1].trim();

  return null;
}

function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().trim();
  if (!lower.startsWith('http')) return false;
  if (lower.includes('1.gif') || lower.includes('pixel') || lower.includes('beacon')) return false;
  return true;
}

function decodeEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '...')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&lsquo;|&rsquo;|&#8216;|&#8217;/g, "'")
    .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/g, '"')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Load verified feeds registry
 */
export function getVerifiedFeedsRegistry(): Record<
  string,
  Array<{ title: string; url: string; country: string; category: string }>
> {
  const verifiedFeedsPath = path.resolve(process.cwd(), 'src/constants/verifiedFeeds.json');
  if (fs.existsSync(verifiedFeedsPath)) {
    try {
      const data = fs.readFileSync(verifiedFeedsPath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.warn('Could not parse verifiedFeeds.json:', e);
    }
  }
  return {};
}

/**
 * Fetches single RSS feed endpoint and extracts candidate articles
 */
export async function fetchSingleFeed(
  feedUrl: string,
  category: string,
  country: string
): Promise<ParsedArticle[]> {
  try {
    const response = await axios.get(feedUrl, {
      timeout: 10000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const xmlData = response.data;
    if (typeof xmlData !== 'string') return [];

    const parsed = await parser.parseString(xmlData);
    if (!parsed || !parsed.items) return [];

    const itemXmlBlocks: string[] = [];
    const itemRegex = /<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi;
    let match;
    while ((match = itemRegex.exec(xmlData)) !== null) {
      itemXmlBlocks.push(match[0]);
    }

    const articles: ParsedArticle[] = [];

    parsed.items.forEach((item, index) => {
      const link = item.link || item.guid;
      if (!link || !link.startsWith('http')) return;

      const itemXml = itemXmlBlocks[index] || '';
      const imageUrl =
        extractItemImage(itemXml) ||
        (item.enclosure?.url && isValidImageUrl(item.enclosure.url) ? item.enclosure.url : null);

      const title = decodeEntities(item.title || '') || 'Untitled Story';
      const summary = decodeEntities(item.contentSnippet || item.content || item.summary || item.description || '');
      const rawContent = item.content || item['content:encoded'] || item.description || '';

      const hash = generateArticleHash(link);
      const publishedAt = item.pubDate && !isNaN(Date.parse(item.pubDate)) ? new Date(item.pubDate) : new Date();

      articles.push({
        hash,
        title,
        summary: summary || title,
        rawContent,
        url: link,
        imageUrl,
        category,
        country,
        source: extractSource(link),
        author: item.creator || null,
        publishedAt,
      });
    });

    return articles;
  } catch (error: any) {
    console.warn(`[RSS Ingest Warning] Failed to fetch ${feedUrl}: ${error.message}`);
    return [];
  }
}

/**
 * Main Ingestion Pipeline:
 * 1. Fetches candidate articles from verified RSS feeds
 * 2. Checks PostgreSQL for existing hashes (O(1) deduplication)
 * 3. Enriches brand-new articles with Mozilla Readability (Full Text & HD Images)
 * 4. Batch inserts into PostgreSQL and invalidates Redis cache
 */
export async function ingestAllFeeds(): Promise<{
  totalScanned: number;
  newInserted: number;
  durationMs: number;
}> {
  const startTime = Date.now();
  const feedsRegistry = getVerifiedFeedsRegistry();
  const allCandidateArticles: ParsedArticle[] = [];

  // 1. Gather all feeds into a flat task list
  const feedTasks: Array<{ url: string; category: string; country: string }> = [];
  for (const [key, feedList] of Object.entries(feedsRegistry)) {
    const category = key.startsWith('Top Stories:') ? 'Top Stories' : key;
    feedList.forEach((f) => {
      feedTasks.push({ url: f.url, category, country: f.country || 'GLOBAL' });
    });
  }

  // 2. Fetch RSS feeds in parallel batches of 6
  const batchSize = 6;
  for (let i = 0; i < feedTasks.length; i += batchSize) {
    const batch = feedTasks.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((t) => fetchSingleFeed(t.url, t.category, t.country))
    );

    results.forEach((res) => {
      if (res.status === 'fulfilled') {
        allCandidateArticles.push(...res.value);
      }
    });
  }

  // Deduplicate candidate list in memory by hash
  const uniqueMap = new Map<string, ParsedArticle>();
  allCandidateArticles.forEach((art) => {
    if (!uniqueMap.has(art.hash)) {
      uniqueMap.set(art.hash, art);
    }
  });

  const uniqueArticles = Array.from(uniqueMap.values());
  const candidateHashes = uniqueArticles.map((a) => a.hash);

  // 3. Find which articles are ALREADY in the database
  const existingArticles = await prisma.article.findMany({
    where: { hash: { in: candidateHashes } },
    select: { hash: true },
  });

  const existingHashSet = new Set(existingArticles.map((a) => a.hash));
  const newArticles = uniqueArticles.filter((a) => !existingHashSet.has(a.hash));

  console.log(
    `🔍 [Ingest Pipeline] Scanned ${uniqueArticles.length} articles across feeds. Identified ${newArticles.length} brand-new articles to enrich with Mozilla Readability.`
  );

  // 4. Enrich brand-new articles with Mozilla Readability (Full Text & HD Images) in batches of 5
  const enrichedArticles: ParsedArticle[] = [];
  const readabilityBatchSize = 5;

  for (let i = 0; i < newArticles.length; i += readabilityBatchSize) {
    const batch = newArticles.slice(i, i + readabilityBatchSize);
    const extractionResults = await Promise.allSettled(
      batch.map(async (art) => {
        const extracted = await extractArticleContent(
          art.url,
          art.title,
          art.summary,
          art.imageUrl
        );

        return {
          ...art,
          title: extracted.title || art.title,
          summary: extracted.summary || art.summary,
          rawContent: extracted.rawContent || art.rawContent,
          imageUrl: extracted.imageUrl || art.imageUrl,
          author: extracted.author || art.author,
          publishedAt: extracted.publishedTime || art.publishedAt,
        };
      })
    );

    extractionResults.forEach((res) => {
      if (res.status === 'fulfilled') {
        enrichedArticles.push(res.value);
      }
    });
  }

  // 5. Batch insert enriched articles into PostgreSQL
  let insertedCount = 0;
  if (enrichedArticles.length > 0) {
    const result = await prisma.article.createMany({
      data: enrichedArticles.map((art) => ({
        hash: art.hash,
        title: art.title,
        summary: art.summary,
        rawContent: art.rawContent,
        url: art.url,
        imageUrl: art.imageUrl,
        category: art.category,
        country: art.country,
        source: art.source,
        author: art.author,
        publishedAt: art.publishedAt,
      })),
      skipDuplicates: true,
    });
    insertedCount = result.count;
  }

  // 6. Invalidate Redis cache if new articles were inserted
  if (insertedCount > 0) {
    await invalidateFeedCache();
  }

  const durationMs = Date.now() - startTime;
  console.log(
    `✅ [Ingestion Pipeline Finished] ${insertedCount} new articles enriched & inserted in ${durationMs}ms.`
  );

  return {
    totalScanned: uniqueArticles.length,
    newInserted: insertedCount,
    durationMs,
  };
}
