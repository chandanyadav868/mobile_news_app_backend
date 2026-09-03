import { Request, Response } from 'express';
import { TimelineService } from '../services/timelineService.js';

export async function getTimelinesController(req: Request, res: Response) {
  try {
    const timelines = await TimelineService.getAllTimelines();
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    return res.json({
      success: true,
      count: timelines.length,
      data: timelines,
    });
  } catch (error: any) {
    console.error('Error in getTimelinesController:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch timelines: ' + error.message,
    });
  }
}

export async function trackKeywordController(req: Request, res: Response) {
  try {
    const { keyword } = req.body;
    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Keyword string is required in request body.',
      });
    }

    const topic = await TimelineService.trackKeywordTimeline(keyword);
    return res.status(201).json({
      success: true,
      message: `Dynamic timeline synthesized for "${keyword}"`,
      data: topic,
    });
  } catch (error: any) {
    console.error('Error in trackKeywordController:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to synthesize timeline: ' + error.message,
    });
  }
}
