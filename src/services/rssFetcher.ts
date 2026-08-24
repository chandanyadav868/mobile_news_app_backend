import crypto from 'crypto';
import Parser from 'rss-parser';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { prisma } from '../config/db.js';
import { invalidateFeedCache } from './cacheService.js';
import { extractArticleContent } from './articleExtractor.js';
import { logStream } from './logStreamService.js';

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
 * Load verified feeds registry with multi-path resolution (supports TS source, compiled dist, and Docker runtime)
 */
export function getVerifiedFeedsRegistry(): Record<
  string,
  Array<{ title: string; url: string; country: string; category: string }>
> {
  const baseDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

  const candidatePaths = [
    path.resolve(baseDir, '../constants/verifiedFeeds.json'),
    path.resolve(baseDir, '../../src/constants/verifiedFeeds.json'),
    path.resolve(baseDir, '../../dist/constants/verifiedFeeds.json'),
    path.resolve(process.cwd(), 'dist/constants/verifiedFeeds.json'),
    path.resolve(process.cwd(), 'src/constants/verifiedFeeds.json'),
    path.resolve(process.cwd(), 'constants/verifiedFeeds.json'),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const data = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(data);
        if (parsed && Object.keys(parsed).length > 0) {
          return parsed;
        }
      } catch (e) {
        console.warn(`⚠️ Could not parse verifiedFeeds.json from ${p}:`, e);
      }
    }
  }

  console.warn('⚠️ [RSS Registry Warning] verifiedFeeds.json not found in any candidate path!');
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
  logStream.emitLog('info', '🚀 Initializing live ingestion worker across all categories...');
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

  logStream.emitLog(
    'scan',
    `📡 Loaded ${feedTasks.length} verified RSS endpoints across ${Object.keys(feedsRegistry).length} categories. Starting XML fetch...`
  );

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

  const scanMsg = `🔍 Scanned ${uniqueArticles.length} candidate articles. Found ${newArticles.length} brand-new stories to enrich with Mozilla Readability.`;
  console.log(`🔍 [Ingest Pipeline] ${scanMsg}`);
  logStream.emitLog('scan', scanMsg, { totalScanned: uniqueArticles.length, newCount: newArticles.length });

  // 4. Enrich brand-new articles with Mozilla Readability (Full Text & HD Images) and stream-save to PostgreSQL in batches of 20
  const readabilityBatchSize = 10;
  let insertedCount = 0;
  let currentChunk: ParsedArticle[] = [];

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
        currentChunk.push(res.value);
        logStream.emitLog(
          'enrich',
          `📑 [Mozilla Readability] Extracted "${res.value.title.slice(0, 45)}..." (${res.value.category})`
        );
      }
    });

    // Save incrementally to DB every 20 articles so users get fresh content immediately
    if (currentChunk.length >= 20 || i + readabilityBatchSize >= newArticles.length) {
      if (currentChunk.length > 0) {
        const result = await prisma.article.createMany({
          data: currentChunk.map((art) => ({
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
        insertedCount += result.count;
        const saveMsg = `💾 [PostgreSQL Sync] Saved ${insertedCount}/${newArticles.length} enriched articles to database...`;
        console.log(`📥 [Mozilla Parser ➔ DB Sync] ${saveMsg}`);
        logStream.emitLog('save', saveMsg, { current: insertedCount, total: newArticles.length });
        currentChunk = [];
      }
    }
  }

  // 5. Invalidate Redis cache so frontend immediately gets freshest stories
  if (insertedCount > 0) {
    await invalidateFeedCache();
    logStream.emitLog('info', '⚡ Redis cache invalidated with fresh headlines.');
  }

  const durationMs = Date.now() - startTime;
  const completeMsg = `🎉 Ingestion Complete! ${insertedCount} new articles enriched & saved in ${(durationMs / 1000).toFixed(1)}s!`;
  console.log(`🎉 [Ingestion Pipeline Complete] ${completeMsg}`);
  logStream.emitLog('complete', completeMsg, { totalInserted: insertedCount, durationMs });

  return {
    totalScanned: uniqueArticles.length,
    newInserted: insertedCount,
    durationMs,
  };
}
