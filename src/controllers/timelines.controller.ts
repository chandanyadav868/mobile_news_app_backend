import { Request, Response } from 'express';
import { TimelineService } from '../services/timelineService.js';
import { getCache, setCache } from '../services/cacheService.js';

export async function getTimelines(req: Request, res: Response) {
  const cacheKey = 'news:timelines:v3';
  const cached = await getCache<any>(cacheKey);
  if (cached) {
    return res.json({ success: true, source: 'cache', data: cached });
  }

  try {
    const topics = await TimelineService.getAllTimelines();
    await setCache(cacheKey, topics, 300); // 5 minutes cache
    return res.json({ success: true, source: 'database', count: topics.length, data: topics });
  } catch (error: any) {
    console.error('Error in getTimelines:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch timelines: ' + error.message });
  }
}

export async function trackKeyword(req: Request, res: Response) {
  try {
    const { keyword } = req.body;
    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({ success: false, error: 'Keyword is required' });
    }

    const topic = await TimelineService.trackKeywordTimeline(keyword);
    return res.status(201).json({
      success: true,
      message: `Synthesized timeline for "${keyword}"`,
      data: topic,
    });
  } catch (error: any) {
    console.error('Error in trackKeyword:', error);
    return res.status(500).json({ success: false, error: 'Failed to synthesize timeline: ' + error.message });
  }
}
