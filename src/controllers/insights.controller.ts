import { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { getCache, setCache, deleteCache } from '../services/cacheService.js';

export async function getInsights(req: Request, res: Response) {
  const cacheKey = 'insights:all';
  const cached = await getCache<any>(cacheKey);
  if (cached) {
    return res.json({ success: true, source: 'cache', data: cached });
  }

  try {
    const insights = await prisma.insightStory.findMany({
      orderBy: { createdAt: 'desc' },
    });

    await setCache(cacheKey, insights, 600); // 10 minutes cache
    return res.json({ success: true, source: 'database', data: insights });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch insights' });
  }
}

export async function createInsight(req: Request, res: Response) {
  const { title, subtitle, coverImage, slides } = req.body;

  if (!title || !coverImage || !slides || !Array.isArray(slides)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid insight story payload: title, coverImage, and slides array are required.',
    });
  }

  try {
    const newStory = await prisma.insightStory.create({
      data: {
        title,
        subtitle: subtitle || null,
        coverImage,
        slides,
      },
    });

    await deleteCache('insights:all');
    await deleteCache('news:feed:main');

    return res.status(201).json({ success: true, data: newStory });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
