import { Request, Response } from 'express';
import { MediaService } from '../services/mediaService.js';

export class MediaController {
  public static async getMedia(req: Request, res: Response): Promise<void> {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const format = typeof req.query.format === 'string' ? req.query.format : undefined;
      const sortBy = (req.query.sortBy as any) || 'newest';
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 24;

      const result = await MediaService.getAllMedia({ search, format, sortBy, page, limit });
      const stats = await MediaService.getStats();

      res.json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
        stats,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to fetch media' });
    }
  }

  public static async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No image file uploaded in field "image"' });
        return;
      }
      const title = req.body.title as string | undefined;
      const altText = req.body.altText as string | undefined;

      const media = await MediaService.uploadFile(req.file, title, altText);
      res.status(201).json({ success: true, data: media });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to process upload' });
    }
  }

  public static async registerUrl(req: Request, res: Response): Promise<void> {
    try {
      const { url, title, altText } = req.body;
      if (!url || typeof url !== 'string') {
        res.status(400).json({ success: false, error: 'Valid "url" string is required' });
        return;
      }

      const media = await MediaService.registerUrl(url, title, altText);
      res.status(201).json({ success: true, data: media });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to register image URL' });
    }
  }

  public static async updateMedia(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { title, altText, originalUrl } = req.body;

      const updated = await MediaService.updateMedia(id, { title, altText, originalUrl });
      if (!updated) {
        res.status(404).json({ success: false, error: `Media item #${id} not found` });
        return;
      }

      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to update media' });
    }
  }

  public static async deleteMedia(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await MediaService.deleteMedia(id);
      if (!deleted) {
        res.status(404).json({ success: false, error: `Media item #${id} not found` });
        return;
      }

      res.json({ success: true, message: `Media item #${id} deleted successfully` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to delete media' });
    }
  }

  public static async getStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await MediaService.getStats();
      res.json({ success: true, stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to get media stats' });
    }
  }

  public static async syncDatabaseImages(_req: Request, res: Response): Promise<void> {
    try {
      const added = await MediaService.syncDatabaseImages();
      const stats = await MediaService.getStats();
      res.json({ success: true, message: `Synced ${added} new images from database`, stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to sync database images' });
    }
  }
}
