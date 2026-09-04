import axios from 'axios';
import crypto from 'crypto';
import { getCache, setCache } from './cacheService.js';

const CHROME_STREAM_HEADERS = {
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

// Patterns for static generic publisher logos that are NOT real article photos
const GENERIC_LOGO_PATTERNS = [
  'thehindu.com/theme/images/og-image.png',
  'thehindu.com/theme/images/th-online-logo.png',
  'ndtv.com/common/images/ndtv_logo.png',
  'indiatoday.in/resources/images/it-logo.png',
  'timesofindia.indiatimes.com/default.jpg',
  'timesofindia.indiatimes.com/toi_default.jpg',
  '1.gif',
  'pixel.gif',
  'beacon',
  'placeholder',
  'site-logo',
  'favicon',
];

function isGenericLogo(url: string): boolean {
  if (!url) return true;
  const lower = url.toLowerCase();
  return GENERIC_LOGO_PATTERNS.some((pattern) => lower.includes(pattern));
}

function isValidHttpImage(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  if (isGenericLogo(trimmed)) return false;
  return true;
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

function getUrlHash(url: string): string {
  return crypto.createHash('md5').update(normalizeUrl(url)).digest('hex');
}

/**
 * Ultra-fast, lightweight streaming head scanner.
 * Reads ONLY the first ~16KB of HTML or until </head>, then immediately aborts the stream!
 * Uses <10KB RAM per request (ZERO JSDOM overhead).
 */
export async function resolveSingleArticleImage(url: string): Promise<string | null> {
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return null;
  }

  const hash = getUrlHash(url);
  const cacheKey = `news:img:${hash}`;

  // 1. Check Redis Cache (7-day TTL)
  const cached = await getCache<string>(cacheKey);
  if (cached !== null && cached !== undefined) {
    return cached.length > 0 ? cached : null;
  }

  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 4000,
      headers: CHROME_STREAM_HEADERS,
      maxRedirects: 4,
    });

    let htmlChunk = '';
    const stream = response.data;

    const streamResult = await new Promise<string>((resolve) => {
      let resolved = false;

      const finish = (result: string) => {
        if (!resolved) {
          resolved = true;
          try {
            stream.destroy();
          } catch {}
          resolve(result);
        }
      };

      stream.on('data', (chunk: Buffer) => {
        htmlChunk += chunk.toString('utf-8');

        // Check if we hit </head> or exceeded 20KB
        if (htmlChunk.includes('</head>') || htmlChunk.length > 20480) {
          finish(htmlChunk);
        }
      });

      stream.on('end', () => finish(htmlChunk));
      stream.on('error', () => finish(htmlChunk));

      // Safety timeout for stream
      setTimeout(() => finish(htmlChunk), 3500);
    });

    // 2. High-speed regex extraction for OpenGraph and Twitter images
    let imageUrl: string | null = null;

    // A. og:image
    const ogMatch =
      streamResult.match(/<meta[^>]+property=["'](?:og:image|og:image:secure_url)["'][^>]+content=["']([^"']+)["']/i) ||
      streamResult.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["'](?:og:image|og:image:secure_url)["']/i);
    if (ogMatch && isValidHttpImage(ogMatch[1])) {
      imageUrl = ogMatch[1].trim();
    }

    // B. twitter:image fallback
    if (!imageUrl) {
      const twitterMatch =
        streamResult.match(/<meta[^>]+(?:name|property)=["'](?:twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["']/i) ||
        streamResult.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:twitter:image|twitter:image:src)["']/i);
      if (twitterMatch && isValidHttpImage(twitterMatch[1])) {
        imageUrl = twitterMatch[1].trim();
      }
    }

    // C. link rel="image_src"
    if (!imageUrl) {
      const imageSrcMatch = streamResult.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i);
      if (imageSrcMatch && isValidHttpImage(imageSrcMatch[1])) {
        imageUrl = imageSrcMatch[1].trim();
      }
    }

    // D. JSON-LD structured data ("image": "...")
    if (!imageUrl) {
      const jsonLdImageMatch = streamResult.match(/"image"\s*:\s*["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
      if (jsonLdImageMatch && isValidHttpImage(jsonLdImageMatch[1])) {
        imageUrl = jsonLdImageMatch[1].trim();
      }
    }

    // Unescape &amp; in image URL
    if (imageUrl) {
      imageUrl = imageUrl.replace(/&amp;/g, '&');
      // Cache valid image for 7 days
      await setCache(cacheKey, imageUrl, 7 * 86400);
      return imageUrl;
    }

    // Cache negative lookup for 1 day so we don't repeat scraping for image-less pages
    await setCache(cacheKey, '', 86400);
    return null;
  } catch {
    // Network/bot-block timeout -> cache empty for 2 hours
    await setCache(cacheKey, '', 7200);
    return null;
  }
}

/**
 * Concurrency-throttled batch image resolver.
 * Maximum 3 concurrent network requests at any given time to protect CPU and RAM.
 */
export async function batchResolveImages(urls: string[]): Promise<Record<string, string>> {
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return {};
  }

  // Deduplicate and filter valid URLs, cap at 16 per batch
  const uniqueUrls = Array.from(
    new Set(urls.filter((u) => typeof u === 'string' && u.startsWith('http')).map(normalizeUrl))
  ).slice(0, 16);

  const results: Record<string, string> = {};
  const CONCURRENCY_LIMIT = 3;

  for (let i = 0; i < uniqueUrls.length; i += CONCURRENCY_LIMIT) {
    const chunk = uniqueUrls.slice(i, i + CONCURRENCY_LIMIT);
    const chunkResults = await Promise.allSettled(
      chunk.map(async (url) => {
        const image = await resolveSingleArticleImage(url);
        return { url, image };
      })
    );

    chunkResults.forEach((res) => {
      if (res.status === 'fulfilled' && res.value.image) {
        results[res.value.url] = res.value.image;
      }
    });
  }

  return results;
}
