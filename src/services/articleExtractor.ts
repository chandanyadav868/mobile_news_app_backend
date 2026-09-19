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
 * Strips indentation, redundant leading spaces, captions, and formats clean paragraphs.
 */
function cleanArticleParagraphs(article: { content?: string | null; textContent?: string | null }): string {
  if (!article) return '';

  if (article.content) {
    try {
      const dom = new JSDOM(article.content, { virtualConsole });
      const doc = dom.window.document;

      doc.querySelectorAll('figure, figcaption, script, style, noscript, [class*="credit"], [class*="caption"]').forEach((el) => el.remove());

      const blocks = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, li');
      const paragraphs: string[] = [];

      blocks.forEach((el) => {
        const text = decodeEntities(el.textContent || '')
          .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (text.length > 0 && !/^\|?\s*photo credit/i.test(text) && !/^also read\s*:/i.test(text)) {
          paragraphs.push(text);
        }
      });

      if (paragraphs.length > 0) {
        return paragraphs.join('\n\n');
      }
    } catch (e) {
      // Fallback
    }
  }

  const raw = decodeEntities(article.textContent || '');
  return raw
    .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0 && !/^\|?\s*photo credit/i.test(line) && !/^also read\s*:/i.test(line))
    .join('\n\n');
}

/**
 * Cleans and formats raw author / creator strings.
 * Removes URLs (e.g. https://ror.org/...), email addresses, institutional departments,
 * affiliations, long lists of co-authors, and formats into a crisp readable byline.
 */
export function cleanAuthorString(author?: string | null): string | null {
  if (!author || typeof author !== 'string') return null;

  let cleaned = decodeEntities(author)
    // Remove URLs
    .replace(/https?:\/\/\S+/gi, '')
    // Remove emails
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, '')
    // Remove institutional/academic boilerplate
    .replace(/(Section of|Department of|School of|Faculty of|College of|Division of|Institute of|Center for|Centre for|Laboratory of|Research Center|University|Hospital)[\s\S]*/gi, '')
    // Remove prefixes
    .replace(/^(By|Written by|Reported by|Author:?)\s+/i, '')
    .replace(/[\s,;:\-\–—]+$/, '')
    .trim();

  if (!cleaned) return null;

  const splitAuthors = cleaned.split(/[,;\n]|\band\b/i).map((s) => s.trim()).filter((s) => s.length > 2);
  if (splitAuthors.length > 1) {
    const primary = splitAuthors[0];
    if (primary.length <= 25) {
      return `${primary} et al.`;
    }
    return `${primary.slice(0, 22)}...`;
  }

  if (cleaned.length > 30) {
    const camelMatch = cleaned.match(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/);
    if (camelMatch && camelMatch[0].length >= 5) {
      return `${camelMatch[0]} et al.`;
    }
    return `${cleaned.slice(0, 25)}...`;
  }

  return cleaned;
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

  // Strip URL fragments (e.g. #google_vignette)
  const cleanUrl = url.split('#')[0];

  try {
    let html: string = '';
    const browserHeaders = {
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

    try {
      const response = await axios.get(cleanUrl, {
        timeout: 9000,
        headers: browserHeaders,
        maxRedirects: 5,
      });
      html = response.data;
    } catch (fetchErr: any) {
      // If blocked with 403 Forbidden or 401 Unauthorized (Cloudflare / bot-detection),
      // retry with search-crawler (Googlebot) headers which news sites whitelist
      if (fetchErr.response?.status === 403 || fetchErr.response?.status === 401) {
        const crawlerRes = await axios.get(cleanUrl, {
          timeout: 9000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          maxRedirects: 5,
        });
        html = crawlerRes.data;
      } else {
        throw fetchErr;
      }
    }

    if (typeof html !== 'string' || html.length < 200) {
      return defaultFallback;
    }

    const dom = new JSDOM(html, { url: cleanUrl, virtualConsole });
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
    const rawAuthor = authorMeta ? authorMeta.getAttribute('content')?.trim() || null : null;
    const author = cleanAuthorString(rawAuthor);

    // 3. Run Mozilla Readability Parser
    const reader = new Readability(doc);
    const parsedArticle = reader.parse();

    if (parsedArticle && parsedArticle.textContent && parsedArticle.textContent.trim().length > 100) {
      const cleanFullText = cleanArticleParagraphs(parsedArticle);
      const smartSummary = generate60WordSummary(cleanFullText, 65);
      const articleTitle = decodeEntities(parsedArticle.title || fallbackTitle);
      const cleanedByline = cleanAuthorString(parsedArticle.byline);

      return {
        title: articleTitle,
        summary: smartSummary || decodeEntities(fallbackSnippet),
        rawContent: cleanFullText,
        imageUrl: ogImage || fallbackImage,
        author: author || cleanedByline || null,
        byline: cleanedByline || null,
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
