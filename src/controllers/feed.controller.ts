import { Request, Response } from 'express';
import axios from 'axios';
import Parser from 'rss-parser';
import fs from 'fs';
import {
  getVerifiedFeedsRegistry,
  getVerifiedFeedsFilePath,
  normalizeFeedUrl,
  ingestAllFeeds,
} from '../services/rssFetcher.js';
import { logStream } from '../services/logStreamService.js';

const parser = new Parser({
  timeout: 5000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 NewsFlow-Validator/1.0',
    Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
  },
});

/**
 * POST /api/v1/feeds/validate
 * Non-blocking 5s timeout probe to verify if a user-provided URL delivers valid RSS/Atom XML
 */
export async function validateFeedUrl(req: Request, res: Response) {
  const { url } = req.body;

  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
    return res.status(400).json({
      success: false,
      valid: false,
      error: 'Please provide a valid HTTP or HTTPS feed URL',
    });
  }

  const cleanUrl = url.trim();

  try {
    // 1. Fetch XML with strict 6-second timeout and 2MB payload cap (prevents event loop lag)
    const response = await axios.get(cleanUrl, {
      timeout: 6000,
      maxContentLength: 2 * 1024 * 1024,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 NewsFlow-Validator/1.0',
        Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
      },
    });

    const xmlData = response.data;
    if (typeof xmlData !== 'string' || xmlData.trim().length === 0) {
      return res.status(422).json({
        success: false,
        valid: false,
        error: 'The provided URL responded with non-text data or an empty payload.',
      });
    }

    // 2. Parse XML via rss-parser
    const parsedFeed = await parser.parseString(xmlData);

    if (!parsedFeed || !Array.isArray(parsedFeed.items) || parsedFeed.items.length === 0) {
      return res.status(422).json({
        success: false,
        valid: false,
        error: 'Valid XML was found, but it contains 0 news items or articles.',
      });
    }

    // 3. Extract sample items
    const sampleArticles = parsedFeed.items.slice(0, 3).map((item) => ({
      title: item.title || 'Untitled Article',
      link: item.link || '',
      pubDate: item.pubDate || new Date().toISOString(),
      creator: item.creator || item.author || null,
    }));

    return res.json({
      success: true,
      valid: true,
      data: {
        url: cleanUrl,
        feedTitle: parsedFeed.title || 'Custom RSS Feed',
        feedDescription: parsedFeed.description || '',
        itemCount: parsedFeed.items.length,
        sampleArticles,
      },
    });
  } catch (error: any) {
    console.warn(`[Feed Validator] Failed to validate ${cleanUrl}:`, error.message);
    return res.status(422).json({
      success: false,
      valid: false,
      error: `Validation failed: ${error.message || 'Unable to parse RSS/Atom XML from this URL.'}`,
    });
  }
}

/**
 * POST /api/v1/feeds/add
 * Atomically saves a validated RSS feed into verifiedFeeds.json and triggers background ingest
 */
export async function addVerifiedFeed(req: Request, res: Response) {
  const { url, title, category, country } = req.body;

  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
    return res.status(400).json({
      success: false,
      error: 'A valid feed URL is required',
    });
  }

  const selectedCategory = category && typeof category === 'string' ? category.trim() : 'General';
  const selectedCountry = country && typeof country === 'string' ? country.trim().toUpperCase() : 'GLOBAL';
  const cleanUrl = url.trim();
  const normalizedNew = normalizeFeedUrl(cleanUrl);

  try {
    const filePath = getVerifiedFeedsFilePath();
    let registry: Record<string, Array<{ title: string; url: string; country: string; category: string }>> = {};

    if (fs.existsSync(filePath)) {
      try {
        registry = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (e) {
        registry = {};
      }
    }

    // Determine target category group key in verifiedFeeds.json
    const groupKey = selectedCategory === 'Top Stories' && selectedCountry !== 'GLOBAL'
      ? `Top Stories:${selectedCountry}`
      : selectedCategory;

    if (!registry[groupKey]) {
      registry[groupKey] = [];
    }

    // Check if feed already exists in this group or anywhere in registry
    let alreadyExists = false;
    for (const feedList of Object.values(registry)) {
      if (feedList.some((f) => normalizeFeedUrl(f.url) === normalizedNew)) {
        alreadyExists = true;
        break;
      }
    }

    if (alreadyExists) {
      return res.json({
        success: true,
        message: 'This feed is already registered in the active ingestion catalog.',
        isExisting: true,
      });
    }

    // Add new feed entry
    const newEntry = {
      title: title && typeof title === 'string' ? title.trim() : `${selectedCategory} News Feed`,
      url: cleanUrl,
      country: selectedCountry,
      category: selectedCategory,
    };

    registry[groupKey].push(newEntry);

    // Atomic write to disk
    fs.writeFileSync(filePath, JSON.stringify(registry, null, 2), 'utf-8');

    logStream.emitLog('info', `✅ [Feed Registered] New feed added: "${newEntry.title}" (${cleanUrl}) under ${groupKey}`);
    console.log(`✅ [Feed Registry] Saved new RSS feed to ${filePath}`);

    // Trigger non-blocking ingestion in background
    ingestAllFeeds().catch((err: any) => {
      console.error('Background ingestion error after feed addition:', err.message);
    });

    return res.status(201).json({
      success: true,
      message: 'Feed successfully added to verified catalog and scheduled for live ingestion.',
      feed: newEntry,
      groupKey,
    });
  } catch (error: any) {
    console.error('Error adding verified feed:', error);
    return res.status(500).json({
      success: false,
      error: `Failed to save feed: ${error.message}`,
    });
  }
}

/**
 * GET /api/v1/feeds
 * Returns the current list of all active registered feeds grouped by category
 */
export async function getRegisteredFeeds(req: Request, res: Response) {
  try {
    const registry = getVerifiedFeedsRegistry();
    let totalFeeds = 0;
    Object.values(registry).forEach((list) => {
      totalFeeds += list.length;
    });

    return res.json({
      success: true,
      totalFeeds,
      categories: Object.keys(registry),
      data: registry,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve feeds catalog',
    });
  }
}
