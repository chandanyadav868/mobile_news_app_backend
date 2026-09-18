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

  // 4. Format clean output
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
    article.textContent.trim(),
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
const targetUrl = process.argv[2] || 'https://indianexpress.com/article/cities/kolkata/nandigram-bypoll-congress-candidate-milan-pradhan-arrest-old-case-10884128/';
extractAndSaveArticle(targetUrl).catch((err) => {
  console.error('❌ Error during extraction:', err.message);
});
// }
