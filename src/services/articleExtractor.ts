import axios from 'axios';
import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';

const virtualConsole = new VirtualConsole();
virtualConsole.on('error', () => {});
virtualConsole.on('warn', () => {});
virtualConsole.on('jsdomError', () => {});

export interface ExtractedArticle {
  title: string;
  summary: string;
  rawContent: string;
  imageUrl: string | null;
  author: string | null;
  byline: string | null;
  publishedTime: Date | null;
  isExtracted: boolean;
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
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate a clean ~60-word Inshorts-style summary from full article text
 */
function generate60WordSummary(textContent: string, maxWords = 65): string {
  if (!textContent) return '';
  const clean = textContent.replace(/\s+/g, ' ').trim();
  const words = clean.split(' ');
  if (words.length <= maxWords) return clean;
  return words.slice(0, maxWords).join(' ') + '...';
}

function isValidHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().trim();
  if (!lower.startsWith('http')) return false;
  if (lower.includes('1.gif') || lower.includes('pixel') || lower.includes('beacon')) return false;
  return true;
}

/**
 * Extracts full article text, OpenGraph HD image, and summary using Mozilla Readability
 */
export async function extractArticleContent(
  url: string,
  fallbackTitle = '',
  fallbackSnippet = '',
  fallbackImage: string | null = null
): Promise<ExtractedArticle> {
  const defaultFallback: ExtractedArticle = {
    title: decodeEntities(fallbackTitle) || 'Untitled Story',
    summary: decodeEntities(fallbackSnippet),
    rawContent: decodeEntities(fallbackSnippet),
    imageUrl: fallbackImage,
    author: null,
    byline: null,
    publishedTime: null,
    isExtracted: false,
  };

  if (!url || !url.startsWith('http')) {
    return defaultFallback;
  }

  try {
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
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
      },
      maxRedirects: 5,
    });

    const html = response.data;
    if (typeof html !== 'string' || html.length < 200) {
      return defaultFallback;
    }

    const dom = new JSDOM(html, { url, virtualConsole });
    const doc = dom.window.document;

    // 1. Extract OpenGraph & Twitter HD Images
    let ogImage: string | null = null;
    const ogMeta =
      doc.querySelector('meta[property="og:image"]') ||
      doc.querySelector('meta[property="og:image:secure_url"]') ||
      doc.querySelector('meta[name="twitter:image"]') ||
      doc.querySelector('meta[name="twitter:image:src"]');

    if (ogMeta) {
      const candidate = ogMeta.getAttribute('content');
      if (candidate && isValidHttpUrl(candidate)) {
        ogImage = candidate.trim();
      }
    }

    // 2. Extract OpenGraph Published Time & Author
    let publishedTime: Date | null = null;
    const timeMeta =
      doc.querySelector('meta[property="article:published_time"]') ||
      doc.querySelector('meta[name="publish-date"]') ||
      doc.querySelector('meta[name="pubdate"]');
    if (timeMeta) {
      const timeContent = timeMeta.getAttribute('content');
      if (timeContent && !isNaN(Date.parse(timeContent))) {
        publishedTime = new Date(timeContent);
      }
    }

    const authorMeta =
      doc.querySelector('meta[name="author"]') ||
      doc.querySelector('meta[property="article:author"]') ||
      doc.querySelector('meta[name="twitter:creator"]');
    const author = authorMeta ? authorMeta.getAttribute('content')?.trim() || null : null;

    // 3. Run Mozilla Readability Parser
    const reader = new Readability(doc);
    const parsedArticle = reader.parse();

    if (parsedArticle && parsedArticle.textContent && parsedArticle.textContent.trim().length > 100) {
      const cleanFullText = decodeEntities(parsedArticle.textContent);
      const smartSummary = generate60WordSummary(cleanFullText, 65);
      const articleTitle = decodeEntities(parsedArticle.title || fallbackTitle);

      return {
        title: articleTitle,
        summary: smartSummary || decodeEntities(fallbackSnippet),
        rawContent: cleanFullText,
        imageUrl: ogImage || fallbackImage,
        author: author || parsedArticle.byline || null,
        byline: parsedArticle.byline || null,
        publishedTime,
        isExtracted: true,
      };
    }

    // Fallback if readability couldn't parse enough text (e.g. video pages or paywalls)
    return {
      title: decodeEntities(fallbackTitle),
      summary: decodeEntities(fallbackSnippet),
      rawContent: decodeEntities(fallbackSnippet),
      imageUrl: ogImage || fallbackImage,
      author,
      byline: null,
      publishedTime,
      isExtracted: false,
    };
  } catch (error) {
    // Graceful fallback on network/paywall error
    return defaultFallback;
  }
}
