import { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { getCache, setCache } from '../services/cacheService.js';

export async function getTimelines(req: Request, res: Response) {
  const cacheKey = 'timelines:all';
  const cached = await getCache<any>(cacheKey);
  if (cached) {
    return res.json({ success: true, source: 'cache', data: cached });
  }

  try {
    const topics = await prisma.timelineTopic.findMany({
      include: {
        events: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    await setCache(cacheKey, topics, 600);
    return res.json({ success: true, source: 'database', data: topics });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch timelines' });
  }
}
