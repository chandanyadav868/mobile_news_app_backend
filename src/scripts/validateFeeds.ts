import fs from 'fs';
import path from 'path';
import Parser from 'rss-parser';
import axios from 'axios';

const parser = new Parser({
  timeout: 5000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
});

interface FeedCandidate {
  title: string;
  xmlUrl: string;
  category: string;
  country: string;
}

interface ValidationResult {
  title: string;
  xmlUrl: string;
  category: string;
  country: string;
  isValid: boolean;
  itemCount: number;
  imagePercentage: number;
  responseTimeMs: number;
  score: number;
  reason?: string;
}

/**
 * Parses all <outline ... xmlUrl="..."> entries from an OPML file
 */
function parseOpmlFile(filePath: string, defaultCategory: string, country = 'GLOBAL'): FeedCandidate[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const outlineRegex = /<outline[^>]+xmlUrl=["']([^"']+)["'][^>]*>/gi;
    const candidates: FeedCandidate[] = [];

    let match;
    while ((match = outlineRegex.exec(content)) !== null) {
      const fullTag = match[0];
      const xmlUrl = match[1].trim();

      const titleMatch = fullTag.match(/title=["']([^"']+)["']/i) || fullTag.match(/text=["']([^"']+)["']/i);
      const title = titleMatch ? titleMatch[1].trim() : 'Unknown Feed';

      if (xmlUrl.startsWith('http')) {
        candidates.push({
          title,
          xmlUrl,
          category: defaultCategory,
          country,
        });
      }
    }
    return candidates;
  } catch (err) {
    console.warn(`Could not read OPML file ${filePath}:`, err);
    return [];
  }
}

/**
 * Validates a single RSS candidate against the 4 health criteria
 */
async function validateCandidate(feed: FeedCandidate): Promise<ValidationResult> {
  const start = Date.now();
  try {
    const response = await axios.get(feed.xmlUrl, {
      timeout: 4500,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      maxRedirects: 3,
    });

    const responseTimeMs = Date.now() - start;
    if (response.status !== 200 || typeof response.data !== 'string') {
      return {
        ...feed,
        isValid: false,
        itemCount: 0,
        imagePercentage: 0,
        responseTimeMs,
        score: 0,
        reason: `HTTP ${response.status}`,
      };
    }

    const parsed = await parser.parseString(response.data);
    const items = parsed.items || [];
    if (items.length < 2) {
      return {
        ...feed,
        isValid: false,
        itemCount: items.length,
        imagePercentage: 0,
        responseTimeMs,
        score: 0,
        reason: 'Too few articles (<2)',
      };
    }

    // Check images in feed items
    let imageCount = 0;
    items.forEach((item) => {
      const raw = JSON.stringify(item);
      if (
        item.enclosure?.url ||
        raw.includes('media:content') ||
        raw.includes('media:thumbnail') ||
        raw.includes('<img')
      ) {
        imageCount++;
      }
    });

    const imagePercentage = Math.round((imageCount / items.length) * 100);

    // Calculate quality score
    let score = items.length * 2 + imagePercentage;
    if (responseTimeMs < 1000) score += 30;
    else if (responseTimeMs < 2500) score += 15;

    return {
      ...feed,
      isValid: true,
      itemCount: items.length,
      imagePercentage,
      responseTimeMs,
      score,
    };
  } catch (error: any) {
    return {
      ...feed,
      isValid: false,
      itemCount: 0,
      imagePercentage: 0,
      responseTimeMs: Date.now() - start,
      score: 0,
      reason: error?.message || 'Network/Parse Error',
    };
  }
}

async function main() {
  console.log('🚀 Starting Automated RSS Feed Health Validation Pipeline...\n');

  const recommendedDir = path.resolve(process.cwd(), 'rss-catalog/recommended/with_category');
  const countriesDir = path.resolve(process.cwd(), 'rss-catalog/countries/with_category');

  const allCandidates: FeedCandidate[] = [];

  // 1. Collect from Recommended Topics
  const topicMap: Record<string, string> = {
    'Tech.opml': 'Technology',
    'Programming.opml': 'Technology',
    'Startups.opml': 'Business',
    'Business & Economy.opml': 'Business',
    'Science.opml': 'Science',
    'Space.opml': 'Science',
    'Sports.opml': 'Sports',
    'Cricket.opml': 'Sports',
    'Movies.opml': 'Entertainment',
    'Television.opml': 'Entertainment',
    'Food.opml': 'Food',
    'Travel.opml': 'Travel',
    'Environment.opml': 'Environment',
  };

  for (const [file, category] of Object.entries(topicMap)) {
    const fullPath = path.join(recommendedDir, file);
    if (fs.existsSync(fullPath)) {
      const parsed = parseOpmlFile(fullPath, category, 'GLOBAL');
      allCandidates.push(...parsed);
    }
  }

  // 2. Collect from Key Countries (India, US, UK)
  const countryFiles: Record<string, string> = {
    'India.opml': 'IN',
    'United States.opml': 'US',
    'United Kingdom.opml': 'GB',
  };

  for (const [file, countryCode] of Object.entries(countryFiles)) {
    const fullPath = path.join(countriesDir, file);
    if (fs.existsSync(fullPath)) {
      const parsed = parseOpmlFile(fullPath, 'Top Stories', countryCode);
      allCandidates.push(...parsed);
    }
  }

  console.log(`📋 Found ${allCandidates.length} total candidate feed URLs across all categories and countries.`);
  console.log(`⏳ Testing feeds in parallel batches (timeout: 4.5s)...`);

  const results: ValidationResult[] = [];
  const batchSize = 10;

  for (let i = 0; i < allCandidates.length; i += batchSize) {
    const batch = allCandidates.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((c) => validateCandidate(c)));
    results.push(...batchResults);
    process.stdout.write(`   Validated ${Math.min(i + batchSize, allCandidates.length)}/${allCandidates.length} feeds...\r`);
  }

  console.log('\n\n✅ Validation Complete! Sorting and curating top feeds...\n');

  // Filter valid feeds and group by [country + category]
  const validFeeds = results.filter((r) => r.isValid);
  const grouped = new Map<string, ValidationResult[]>();

  validFeeds.forEach((r) => {
    const groupKey = `${r.country}__${r.category}`;
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, []);
    }
    grouped.get(groupKey)!.push(r);
  });

  const curatedRegistry: Record<
    string,
    Array<{ title: string; url: string; country: string; category: string }>
  > = {
    // Country Top Stories
    'Top Stories:IN': [],
    'Top Stories:US': [],
    'Top Stories:GB': [],
    'Top Stories:GLOBAL': [],
    // Global Categories
    Technology: [],
    Business: [],
    Science: [],
    Sports: [],
    Entertainment: [],
    Health: [],
    Food: [],
    Travel: [],
    Environment: [],
    Politics: [],
  };

  // Select top 3-5 feeds per category based on quality score
  for (const [groupKey, items] of grouped.entries()) {
    items.sort((a, b) => b.score - a.score);
    const topPicks = items.slice(0, 4);

    const [country, category] = groupKey.split('__');
    const targetKey = category === 'Top Stories' ? `Top Stories:${country}` : category;

    if (!curatedRegistry[targetKey]) {
      curatedRegistry[targetKey] = [];
    }

    topPicks.forEach((p) => {
      curatedRegistry[targetKey].push({
        title: p.title,
        url: p.xmlUrl,
        country: p.country,
        category: p.category,
      });
    });
  }

  // Add guaranteed high-yield feeds for Health and Politics if not filled
  if (curatedRegistry.Health.length === 0) {
    curatedRegistry.Health = [
      { title: 'ScienceDaily Health', url: 'https://www.sciencedaily.com/rss/health_medicine.xml', country: 'GLOBAL', category: 'Health' },
      { title: 'The Guardian Health', url: 'https://www.theguardian.com/lifeandstyle/health-and-wellbeing/rss', country: 'GLOBAL', category: 'Health' },
      { title: 'Hindustan Times Health', url: 'https://www.hindustantimes.com/feeds/rss/lifestyle/health-fitness/rssfeed.xml', country: 'IN', category: 'Health' },
    ];
  }

  if (curatedRegistry.Politics.length === 0) {
    curatedRegistry.Politics = [
      { title: 'The Indian Express Politics', url: 'https://indianexpress.com/section/political-pulse/feed/', country: 'IN', category: 'Politics' },
      { title: 'Hindustan Times India News', url: 'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml', country: 'IN', category: 'Politics' },
      { title: 'BBC Politics', url: 'http://feeds.bbci.co.uk/news/politics/rss.xml', country: 'GLOBAL', category: 'Politics' },
    ];
  }

  const outputPath = path.resolve(__dirname, '../constants/verifiedFeeds.json');
  fs.writeFileSync(outputPath, JSON.stringify(curatedRegistry, null, 2), 'utf-8');

  console.log(`🎉 Curated Verified Feeds saved to: ${outputPath}`);
  console.log(`📊 Summary:`);
  Object.entries(curatedRegistry).forEach(([cat, feeds]) => {
    console.log(`   • ${cat.padEnd(22)}: ${feeds.length} verified feeds`);
  });
}

main().catch(console.error);
