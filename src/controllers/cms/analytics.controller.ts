import { Response } from 'express';
import { prisma } from '../../config/db.js';
import { redis } from '../../config/redis.js';
import { AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';

export class CmsAnalyticsController {
    /**
     * Overview Statistics
     */
    static async getOverview(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const [
                totalArticles,
                publishedArticles,
                draftArticles,
                totalPolls,
                totalVisualStories,
                totalRssSources,
                categoryStats,
            ] = await Promise.all([
                prisma.article.count(),
                prisma.article.count({ where: { status: 'PUBLISHED' } }),
                prisma.article.count({ where: { status: 'DRAFT' } }),
                prisma.communityPoll.count(),
                prisma.visualStory.count(),
                prisma.rssFeedSource.count(),
                prisma.article.groupBy({
                    by: ['category'],
                    _count: { id: true },
                    orderBy: { _count: { id: 'desc' } },
                    take: 8,
                }),
            ]);

            return res.json({
                success: true,
                stats: {
                    totalArticles,
                    publishedArticles,
                    draftArticles,
                    totalPolls,
                    totalVisualStories,
                    totalRssSources,
                    categoryDistribution: categoryStats.map((c) => ({
                        category: c.category,
                        count: c._count.id,
                    })),
                },
            });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Audit Logs
     */
    static async getAuditLogs(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const logs = await prisma.cmsAuditLog.findMany({
                include: {
                    admin: {
                        select: { name: true, email: true, role: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
            });

            return res.json({ success: true, logs });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Flush Redis Cache
     */
    static async flushCache(req: AuthenticatedAdminRequest, res: Response) {
        try {
            if (redis) {
                const keys = await redis.keys('*');
                if (keys.length > 0) {
                    await redis.del(...keys);
                }
            }

            if (req.admin) {
                await prisma.cmsAuditLog.create({
                    data: {
                        adminId: req.admin.id,
                        action: 'REDIS_CACHE_FLUSH',
                        entityType: 'Redis',
                        details: { triggeredBy: req.admin.name },
                    },
                });
            }

            return res.json({ success: true, message: 'Redis cache successfully flushed.' });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
}
