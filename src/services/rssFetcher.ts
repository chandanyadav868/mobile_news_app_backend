import crypto from 'crypto';
import Parser from 'rss-parser';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { prisma } from '../config/db.js';
import { invalidateFeedCache } from './cacheService.js';
import { extractArticleContent } from './articleExtractor.js';
import { logStream } from './logStreamService.js';
import UniversalLlmService from './universalLlmService.js';
import TelemetryService from './telemetryService.js';
import { broadcastIngestPushToConnectedDevices } from './deviceRegistryService.js';
import { pushArticleToRingBuffer } from './redisFeedService.js';

const CHROME_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
};

const parser = new Parser({
  timeout: 10000,
  headers: CHROME_HEADERS,
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure'],
      ['image', 'imageTag'],
    ],
  },
});

export // Mutex lock to prevent duplicate overlapping scraping runs from maxing CPU
let isIngesting = false;

interface ParsedArticle {
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

/**
 * Fast-path check: if RSS item already contains rich summary and HD image, skip heavy JSDOM parsing
 */
function isRichRssItem(summary: string | null, imageUrl: string | null): boolean {
  if (!summary || summary.length < 120) return false;
  if (!imageUrl || imageUrl.includes('placeholder')) return false;
  // Tiny thumbnails (<200px) are not rich: trigger full OG image extraction
  if (imageUrl.includes('width=140') || imageUrl.includes('/tmb/') || imageUrl.includes('/240/')) return false;
  return true;
}

export function upgradeImageUrlToHighRes(url: string | null): string | null {
  if (!url) return null;
  let clean = url.trim();

  // 1. Decode HTML entities (The Verge, Vox, etc.)
  clean = clean.replace(/&#038;/g, '&').replace(/&amp;/g, '&');

  // 2. Phys.org / ScienceX: 1.6KB tiny thumbnail (/tmb/) -> 800px full image (/800w/)
  if (clean.includes('scx1.b-cdn.net') && clean.includes('/tmb/')) {
    clean = clean.replace('/tmb/', '/800w/');
  }

  // 3. BBC News CDN: 240px tiny thumbnail -> 976px HD photo
  if (clean.includes('ichef.bbci.co.uk') && clean.includes('/240/')) {
    clean = clean.replace('/240/', '/976/');
  }

  // 4. Google User Content: upgrade low-res size query to high-res
  if (clean.includes('googleusercontent.com')) {
    clean = clean.replace(/=w\d+(-h\d+)?(-c)?/, '=w1200');
    clean = clean.replace(/=s\d+(-c)?/, '=s1200');
  }

  // 5. The Verge / Vox: strip tiny crop parameter
  if (clean.includes('platform.theverge.com') && clean.includes('crop=')) {
    clean = clean.replace(/&crop=[^&]+/, '').replace(/\?crop=[^&]+&?/, '?');
  }

  return clean;
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
  if (
    lower.includes('1.gif') ||
    lower.includes('pixel') ||
    lower.includes('beacon') ||
    lower.includes('og-image.png') ||
    lower.includes('placeholder') ||
    lower.includes('site-logo')
  ) {
    return false;
  }
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

import { RSS_FEEDS } from '../constants/feeds.js';

export function normalizeFeedUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.search = '';
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, '');
  }
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
 * Resolves the absolute writable path to verifiedFeeds.json for dynamic updates
 */
export function getVerifiedFeedsFilePath(): string {
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
    if (fs.existsSync(p)) return p;
  }
  return path.resolve(process.cwd(), 'src/constants/verifiedFeeds.json');
}

/**
 * Returns unified, deduplicated feed task list combining verifiedFeeds.json AND feeds.ts
 */
export function getUnifiedFeedTasks(): Array<{ url: string; category: string; country: string; title?: string }> {
  const taskMap = new Map<string, { url: string; category: string; country: string; title?: string }>();

  // 1. Ingest from verifiedFeeds.json (primary structured registry)
  const registry = getVerifiedFeedsRegistry();
  for (const [key, feedList] of Object.entries(registry)) {
    const category = key.startsWith('Top Stories:') ? 'Top Stories' : key;
    feedList.forEach((f) => {
      const normalized = normalizeFeedUrl(f.url);
      taskMap.set(normalized, {
        url: f.url,
        category,
        country: f.country || 'GLOBAL',
        title: f.title,
      });
    });
  }

  // 2. Merge from feeds.ts (RSS_FEEDS) - add any additional/tested feeds not already registered
  if (RSS_FEEDS && typeof RSS_FEEDS === 'object') {
    for (const [category, urlList] of Object.entries(RSS_FEEDS)) {
      if (Array.isArray(urlList)) {
        urlList.forEach((url) => {
          const normalized = normalizeFeedUrl(url);
          if (!taskMap.has(normalized)) {
            taskMap.set(normalized, {
              url,
              category,
              country: 'IN', // Default country for tested feeds in feeds.ts
              title: `${category} Feed`,
            });
          }
        });
      }
    }
  }

  return Array.from(taskMap.values());
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
      timeout: 12000,
      headers: CHROME_HEADERS,
    });

    let xmlData = response.data;
    if (typeof xmlData !== 'string') return [];

    // Pre-sanitize unescaped ampersands to prevent XML entity parse errors
    xmlData = xmlData.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[a-f\d]+);)/gi, '&amp;');

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

      // 1. High-reliability extraction from parsed custom fields (The Hindu, NDTV, Times of India, etc.)
      let imageUrl: string | null = null;
      const rawMedia = (item as any).mediaContent;
      if (rawMedia) {
        if (Array.isArray(rawMedia)) {
          // Sort by width descending to always pick the highest-resolution media (e.g. 700/1200px vs 140px)
          const sorted = [...rawMedia].sort((a, b) => {
            const wA = parseInt(a?.$?.width || '0', 10);
            const wB = parseInt(b?.$?.width || '0', 10);
            return wB - wA;
          });
          const found = sorted.find((m: any) => m?.$?.url && isValidImageUrl(m.$.url));
          if (found) imageUrl = found.$.url.trim();
        } else if (rawMedia?.$?.url && isValidImageUrl(rawMedia.$.url)) {
          imageUrl = rawMedia.$.url.trim();
        }
      }

      if (!imageUrl) {
        const rawThumb = (item as any).mediaThumbnail;
        if (rawThumb) {
          if (Array.isArray(rawThumb)) {
            const sorted = [...rawThumb].sort((a, b) => {
              const wA = parseInt(a?.$?.width || '0', 10);
              const wB = parseInt(b?.$?.width || '0', 10);
              return wB - wA;
            });
            const found = sorted.find((m: any) => m?.$?.url && isValidImageUrl(m.$.url));
            if (found) imageUrl = found.$.url.trim();
          } else if (rawThumb?.$?.url && isValidImageUrl(rawThumb.$.url)) {
            imageUrl = rawThumb.$.url.trim();
          }
        }
      }

      if (!imageUrl && item.enclosure?.url && isValidImageUrl(item.enclosure.url)) {
        imageUrl = item.enclosure.url.trim();
      }

      if (!imageUrl) {
        imageUrl = extractItemImage(itemXml);
      }

      // Upgrade to crystal clear high-resolution asset
      imageUrl = upgradeImageUrlToHighRes(imageUrl);

      const rawItem = item as any;
      const title = decodeEntities(rawItem.title || '') || 'Untitled Story';
      const summary = decodeEntities(rawItem.contentSnippet || rawItem.content || rawItem.summary || rawItem.description || '');
      const rawContent = rawItem.content || rawItem['content:encoded'] || rawItem.description || '';

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
    // console.warn(`[RSS Ingest Warning] Failed to fetch ${feedUrl}: ${error.message}`);
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
let lastSuccessfulScrapeTime: Date | null = null;

export async function ingestAllFeeds(): Promise<{
  totalScanned: number;
  newInserted: number;
  durationMs: number;
}> {
  if (isIngesting) {
    console.log('ℹ️ [Ingest Lock] Pipeline is currently executing. Skipping duplicate run.');
    logStream.emitLog('info', 'ℹ️ Ingestion pipeline is currently active in background. Duplicate run skipped.');
    return { totalScanned: 0, newInserted: 0, durationMs: 0 };
  }

  isIngesting = true;
  const startTime = Date.now();

  try {
    logStream.emitLog('info', '🚀 Initializing live ingestion worker across unified feed registry...');
    const feedTasks = getUnifiedFeedTasks();
    const allCandidateArticles: ParsedArticle[] = [];

    logStream.emitLog(
      'scan',
      `📡 Loaded ${feedTasks.length} unified & deduplicated RSS endpoints across all categories. Starting XML fetch...`
    );

    // 2. Fetch RSS feeds in batches of 4 (throttled for low VPS CPU)
    const batchSize = 4;
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
      // Small pause between XML batches
      await new Promise((r) => setTimeout(r, 25));
    }

    // ─── STAGE 1: IN-MEMORY TIMESTAMP CUTOFF FILTERING ───
    // Rolling 36-hour window or 2-hour buffer before last successful run
    const cutoffDate = lastSuccessfulScrapeTime
      ? new Date(lastSuccessfulScrapeTime.getTime() - 2 * 3600 * 1000)
      : new Date(Date.now() - 36 * 3600 * 1000);

    const freshCandidates = allCandidateArticles.filter((art) => {
      const pub = new Date(art.publishedAt);
      return isNaN(pub.getTime()) || pub >= cutoffDate;
    });

    // Deduplicate fresh candidate list in memory by hash
    const uniqueMap = new Map<string, ParsedArticle>();
    freshCandidates.forEach((art) => {
      if (!uniqueMap.has(art.hash)) {
        uniqueMap.set(art.hash, art);
      }
    });

    const uniqueArticles = Array.from(uniqueMap.values());
    const candidateHashes = uniqueArticles.map((a) => a.hash);

    // ─── STAGE 2: POSTGRESQL GLOBAL HASH DEDUPLICATION (O(1) Indexed B-Tree) ───
    // Query global indexed hashes across the table to ensure 100% of candidate articles are genuinely new
    const existingArticles = await prisma.article.findMany({
      where: {
        hash: { in: candidateHashes },
      },
      select: { hash: true },
    });

    const existingHashSet = new Set(existingArticles.map((a: { hash: string }) => a.hash));
    const newArticles = uniqueArticles.filter((a: ParsedArticle) => !existingHashSet.has(a.hash));

    const scanMsg = `⚡ [Deduplication] Filtered ${allCandidateArticles.length} raw RSS items ➔ ${uniqueArticles.length} fresh candidate stories (cutoff: ${cutoffDate.toLocaleTimeString()}). Found ${newArticles.length} brand-new stories to enrich.`;
    console.log(`🔍 [Ingest Pipeline] ${scanMsg}`);
    logStream.emitLog('scan', scanMsg, {
      totalRaw: allCandidateArticles.length,
      freshScanned: uniqueArticles.length,
      newCount: newArticles.length,
    });

    TelemetryService.incrementFunnel('rssScanned', allCandidateArticles.length);
    TelemetryService.incrementFunnel('deduped', newArticles.length);

    TelemetryService.updateQueueMetrics({
      isIngesting: true,
      pendingArticles: newArticles.length,
      activeJobs: 1,
    });

    // 4. Enrich brand-new articles with Google Gemini AI (Safe 15-Article Batching with 3.5s Throttle to stay below 20 RPM limit)
    let insertedCount = 0;
    let currentChunk: ParsedArticle[] = [];
    const MAX_ENRICH_BATCH = 15;
    const articlesToProcess = newArticles.slice(0, MAX_ENRICH_BATCH);

    if (newArticles.length > MAX_ENRICH_BATCH) {
      console.log(`⏱️ [Quota Pacer] Processing top ${MAX_ENRICH_BATCH} of ${newArticles.length} new articles this cycle. ${newArticles.length - MAX_ENRICH_BATCH} safely deferred.`);
    }

    for (let i = 0; i < articlesToProcess.length; i++) {
      const art = articlesToProcess[i];
      TelemetryService.updateQueueMetrics({ pendingArticles: articlesToProcess.length - i });

      try {
        let fullBody = art.summary || art.rawContent || '';
        let finalImg = art.imageUrl;
        let finalAuthor = art.author;
        let finalPubTime = art.publishedAt;
        let finalTitle = art.title;

        // 1. Extract rich full text via Mozilla Readability if not already rich
        if (!isRichRssItem(art.summary, art.imageUrl)) {
          const extracted = await extractArticleContent(
            art.url,
            art.title,
            art.summary,
            art.imageUrl
          );
          fullBody = extracted.rawContent || extracted.summary || fullBody;
          finalImg = extracted.imageUrl || finalImg;
          finalAuthor = extracted.author || finalAuthor;
          finalPubTime = extracted.publishedTime || finalPubTime;
          finalTitle = extracted.title || finalTitle;
        }

        // 2. Smart Selective Summarization / AI Kill-Switch
        const isAiEnabled = TelemetryService.getAiEnabled();
        const wordCount = (art.summary || '').split(/\s+/).filter(Boolean).length;
        const isAlreadyCrisp =
          wordCount >= 45 &&
          wordCount <= 85 &&
          !art.summary.includes('<') &&
          !art.summary.includes('http');

        let headline = finalTitle;
        let story = fullBody;
        let bulletsText = '';
        let modelUsed = 'Direct (0 tokens)';

        if (!isAiEnabled) {
          // 🔴 AI Disabled by Admin: Direct Raw / Mozilla Save (0 Tokens Burned!)
          headline = finalTitle;
          story = fullBody.slice(0, 320);
          const sents = fullBody.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 15);
          bulletsText = sents.slice(0, 3).map((b) => `• ${b}`).join('\n');
          modelUsed = 'AI Paused (Direct Save)';
          TelemetryService.incrementFunnel('directSaved', 1);
        } else if (isAlreadyCrisp) {
          // 0 Tokens Used! Use clean RSS summary directly
          story = art.summary;
          headline = finalTitle;
          const sents = art.summary.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 15);
          bulletsText = sents.slice(0, 3).map((b) => `• ${b}`).join('\n');
          modelUsed = 'RSS-Direct (0 tokens)';
          TelemetryService.incrementFunnel('directSaved', 1);
        } else {
          // 🟢 High-Speed Multi-Model Rotation: Alternate dynamically between Groq Cloud & Mistral AI
          const rotatingEngines = [
            { provider: 'groq', model: 'qwen/qwen3.8-27b' },
            { provider: 'mistral', model: 'mistral-small-latest' },
            { provider: 'groq', model: 'openai/gpt-oss-120b' },
            { provider: 'mistral', model: 'open-mistral-nemo' },
            { provider: 'groq', model: 'openai/gpt-oss-20b' },
            { provider: 'mistral', model: 'mistral-large-latest' },
          ];
          const assigned = rotatingEngines[i % rotatingEngines.length];
          const preferredProvider = assigned.provider;
          const preferredModel = assigned.model;

          const aiResult = await UniversalLlmService.summarizeNews({
            title: finalTitle,
            content: fullBody,
            category: art.category,
            preferredProvider,
            preferredModel,
          });
          headline = aiResult.headline || finalTitle;
          story = aiResult.crispyStory || fullBody.slice(0, 300);
          bulletsText =
            aiResult.bulletPoints.length > 0
              ? aiResult.bulletPoints.map((b) => `• ${b}`).join('\n')
              : fullBody;
          modelUsed = `${aiResult.providerUsed} (${aiResult.modelUsed})`;
          TelemetryService.incrementFunnel('llmSummarized', 1);
        }

        const enrichedArticle: ParsedArticle = {
          ...art,
          title: headline,
          summary: story,
          rawContent: bulletsText || story,
          imageUrl: finalImg,
          author: finalAuthor,
          publishedAt: finalPubTime,
        };

        currentChunk.push(enrichedArticle);
        logStream.emitLog(
          'enrich',
          `📑 [${modelUsed}] "${enrichedArticle.title.slice(0, 45)}..." (${enrichedArticle.category})`
        );
      } catch (enrichErr: any) {
        console.warn(`[Enrich Warning] Failed to enrich "${art.title.slice(0, 30)}":`, enrichErr.message);
        currentChunk.push(art);
      }

      // Safe 3,500ms throttle between sequential AI calls to stay under 20 RPM Google Gemini limit
      await new Promise((resolve) => setTimeout(resolve, 3500));

      // Save incrementally to DB every 10 articles or at the end
      if (currentChunk.length >= 10 || i === articlesToProcess.length - 1) {
        if (currentChunk.length > 0) {
          const result = await prisma.article.createMany({
            data: currentChunk.map((item) => ({
              hash: item.hash,
              title: item.title,
              summary: item.summary,
              rawContent: item.rawContent,
              url: item.url,
              imageUrl: item.imageUrl,
              category: item.category,
              country: item.country,
              source: item.source,
              author: item.author,
              publishedAt: item.publishedAt,
            })),
            skipDuplicates: true,
          });
          insertedCount += result.count;
          TelemetryService.incrementFunnel('dbInserted', result.count);
          // Push into Redis ring buffers (capped at 20) for instant sub-millisecond serving
          for (const item of currentChunk) {
            pushArticleToRingBuffer(item).catch(() => {});
          }

          currentChunk = [];
        }
      }
    }

    // 5. Invalidate Redis cache & Broadcast breaking news to all connected mobile devices in Redis
    if (insertedCount > 0) {
      await invalidateFeedCache();
      logStream.emitLog('info', '⚡ Redis cache invalidated with fresh headlines.');

      // Fetch the latest inserted article for instant push broadcast
      const latestInserted = await prisma.article.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      if (latestInserted) {
        broadcastIngestPushToConnectedDevices({
          id: latestInserted.id,
          title: latestInserted.title,
          summary: latestInserted.summary,
          category: latestInserted.category,
          imageUrl: latestInserted.imageUrl,
          url: latestInserted.url,
        }).catch((e) => console.warn('[Push Broadcast Error]:', e.message));
      }
    }

    lastSuccessfulScrapeTime = new Date();

    const durationMs = Date.now() - startTime;
    TelemetryService.recordIngestCompletion(durationMs);
    TelemetryService.updateQueueMetrics({
      isIngesting: false,
      pendingArticles: 0,
      activeJobs: 0,
      completedToday: insertedCount,
    });

    const completeMsg = `🎉 Ingestion Complete! ${insertedCount} new articles enriched & saved in ${(durationMs / 1000).toFixed(1)}s!`;
    console.log(`🎉 [Ingestion Pipeline Complete] ${completeMsg}`);
    logStream.emitLog('complete', completeMsg, { totalInserted: insertedCount, durationMs });

    return {
      totalScanned: uniqueArticles.length,
      newInserted: insertedCount,
      durationMs,
    };
  } finally {
    isIngesting = false;
    TelemetryService.updateQueueMetrics({ isIngesting: false, activeJobs: 0, pendingArticles: 0 });
  }
}

/**
 * Trigger manual background ingestion from Dashboard Mission Control
 */
export async function triggerManualIngest(): Promise<{ success: boolean; message: string }> {
  if (isIngesting) {
    return { success: false, message: 'Ingestion is already running in background.' };
  }
  // Run asynchronously without blocking HTTP response
  ingestAllFeeds().catch((err) => console.error('[Manual Ingest Error]', err));
  return { success: true, message: 'Manual RSS Ingest pipeline triggered successfully!' };
}
