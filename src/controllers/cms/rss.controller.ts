import { Response } from 'express';
import { prisma } from '../../config/db.js';
import { AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';
import { ingestAllFeeds } from '../../services/rssFetcher.js';

export class CmsRssController {
    /**
     * List RSS Feed Sources
     */
    static async listSources(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const sources = await prisma.rssFeedSource.findMany({
                orderBy: { createdAt: 'desc' },
            });
            return res.json({ success: true, sources });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Add RSS Feed Source
     */
    static async createSource(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { name, url, category, country = 'IN', fetchInterval = 15 } = req.body;
            if (!name || !url || !category) {
                return res.status(400).json({
                    success: false,
                    error: 'Source name, feed URL, and category are required.',
                });
            }

            const cleanUrl = url.trim();
            const source = await prisma.rssFeedSource.create({
                data: {
                    name: name.trim(),
                    url: cleanUrl,
                    category: category.trim(),
                    country: country.toUpperCase(),
                    fetchInterval: Number(fetchInterval) || 15,
                    isActive: true,
                },
            });

            return res.status(201).json({ success: true, source });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Update or Pause/Resume RSS Source
     */
    static async updateSource(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { id } = req.params;
            const { name, url, category, country, isActive, fetchInterval } = req.body;

            const updated = await prisma.rssFeedSource.update({
                where: { id },
                data: {
                    name: name?.trim(),
                    url: url?.trim(),
                    category: category?.trim(),
                    country: country?.toUpperCase(),
                    isActive: isActive !== undefined ? Boolean(isActive) : undefined,
                    fetchInterval: fetchInterval !== undefined ? Number(fetchInterval) : undefined,
                },
            });

            return res.json({ success: true, source: updated });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Delete RSS Source
     */
    static async deleteSource(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { id } = req.params;
            await prisma.rssFeedSource.delete({ where: { id } });
            return res.json({ success: true, message: 'RSS source removed.' });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Trigger Ingestion for All Active Sources
     */
    static async triggerAll(req: AuthenticatedAdminRequest, res: Response) {
        try {
            // Trigger background ingestion cycle
            ingestAllFeeds().catch((err: any) => console.error('Manual Ingestion Error:', err));

            if (req.admin) {
                await prisma.cmsAuditLog.create({
                    data: {
                        adminId: req.admin.id,
                        action: 'RSS_TRIGGER_ALL',
                        entityType: 'RssFeedSource',
                        details: { triggeredBy: req.admin.name },
                    },
                });
            }

            return res.json({
                success: true,
                message: 'Ingestion triggered successfully across all active RSS sources.',
            });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
}
