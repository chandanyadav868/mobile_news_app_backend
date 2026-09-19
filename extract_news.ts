import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchHtml(url: string): Promise<string> {
  // Strip URL fragments/hashes like #google_vignette
  const cleanUrl = url.split('#')[0];

  try {
    const response = await axios.get(cleanUrl, {
      timeout: 10000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      maxRedirects: 5,
    });
    return response.data;
  } catch (error: any) {
    // If blocked by anti-bot/Cloudflare (403 Forbidden), retry with Search Crawler headers
    if (error.response?.status === 403 || error.response?.status === 401) {
      console.log('⚠️ Direct browser request was blocked (403 Forbidden). Retrying with search-crawler bypass...');
      const fallback = await axios.get(cleanUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        maxRedirects: 5,
      });
      return fallback.data;
    }
    throw error;
  }
}

/**
 * Strips indentation, redundant leading spaces, captions, and formats clean paragraphs.
 */
function cleanArticleParagraphs(article: { content?: string | null; textContent?: string | null }): string {
  if (!article) return '';

  // 1. Preferred: Extract structured block-level paragraphs from Readability's clean HTML
  if (article.content) {
    try {
      const dom = new JSDOM(article.content);
      const doc = dom.window.document;

      // Remove photo credits, figures, captions, scripts, styles
      doc.querySelectorAll('figure, figcaption, script, style, noscript, [class*="credit"], [class*="caption"]').forEach((el) => el.remove());

      const blocks = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, li');
      const paragraphs: string[] = [];

      blocks.forEach((el) => {
        // Strip non-breaking spaces and normalize horizontal whitespace
        const text = (el.textContent || '')
          .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        // Filter out empty lines, photo credits, and "ALSO READ" banners
        if (text.length > 0 && !/^\|?\s*photo credit/i.test(text) && !/^also read\s*:/i.test(text)) {
          paragraphs.push(text);
        }
      });

      if (paragraphs.length > 0) {
        return paragraphs.join('\n\n');
      }
    } catch (e) {
      // Fallback to textContent below
    }
  }

  // 2. Fallback: Parse raw textContent line-by-line
  const raw = article.textContent || '';
  return raw
    .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0 && !/^\|?\s*photo credit/i.test(line) && !/^also read\s*:/i.test(line))
    .join('\n\n');
}

/**
 * Loads a website, extracts only the clean article text using @mozilla/readability,
 * and saves it into extract_news.txt in the same folder.
 */
export async function extractAndSaveArticle(
  url: string,
  outputFilePath: string = path.join(__dirname, 'extract_news.txt')
) {
  console.log(`\n🌐 Fetching webpage: ${url}`);

  // 1. Fetch raw HTML (with anti-bot 403 fallback)
  const html = await fetchHtml(url);

  // 2. Load the HTML into JSDOM virtual DOM
  const dom = new JSDOM(html, { url });
  console.log(`📄 Webpage loaded into DOM (${html.length} characters HTML)`);

  // 3. Run Mozilla Readability to strip ads, sidebars, navbars, and popups
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  console.log('📰 Article parsed by Readability:', {
    title: article?.title,
    byline: article?.byline,
    siteName: article?.siteName,
    length: article?.length,
  });


  if (!article || !article.textContent?.trim()) {
    throw new Error('Could not extract an article. The page might be behind a paywall or lacks readable text.');
  }

  // 4. Format clean paragraphs without leading spaces, indentation, or squished text
  const cleanArticleBody = cleanArticleParagraphs(article);

  const content = [
    `SOURCE URL: ${url}`,
    `EXTRACTED AT: ${new Date().toLocaleString()}`,
    `TITLE: ${article.title || 'N/A'}`,
    `AUTHOR / BYLINE: ${article.byline || 'N/A'}`,
    `SITE NAME: ${article.siteName || 'N/A'}`,
    `EXCERPT: ${article.excerpt || 'N/A'}`,
    '='.repeat(70),
    'CLEAN EXTRACTED ARTICLE (ADS & CLUTTER REMOVED):',
    '='.repeat(70),
    cleanArticleBody,
  ].join('\n\n');

  // 5. Save to extract_news.txt at the same directory level
  fs.writeFileSync(outputFilePath, content, 'utf-8');
  console.log(`✅ Extracted article successfully saved to: ${outputFilePath}`);
  console.log(`📝 Title: ${article.title}`);
  console.log(`📊 Word count: ${article.textContent.trim().split(/\s+/).length} words\n`);

  return article;
}

// Self-executing runner for quick command-line testing
// if (require.main === module) {
const targetUrl = process.argv[2] || 'https://www.thehindu.com/entertainment/movies/city-lights-movie-review-kannada-vinay-rajkumar-monisha-vijaykumar-duniya-vijay-charan-raj/article71482391.ece';
extractAndSaveArticle(targetUrl).catch((err) => {
  console.error('❌ Error during extraction:', err.message);
});
// }
