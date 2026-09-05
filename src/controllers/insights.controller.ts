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
    return res.status(500).json({ success: false, error: 'Failed to create insight' });
  }
}

export async function getInsightById(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const insight = await prisma.insightStory.findUnique({
      where: { id },
    });
    if (!insight) {
      return res.status(404).json({ success: false, error: 'Insight story not found' });
    }
    return res.json({ success: true, data: insight });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateInsight(req: Request, res: Response) {
  const { id } = req.params;
  const { title, subtitle, coverImage, slides } = req.body;

  try {
    const updated = await prisma.insightStory.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(subtitle !== undefined && { subtitle }),
        ...(coverImage !== undefined && { coverImage }),
        ...(slides !== undefined && { slides }),
      },
    });

    await deleteCache('insights:all');
    await deleteCache('news:feed:main');

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
