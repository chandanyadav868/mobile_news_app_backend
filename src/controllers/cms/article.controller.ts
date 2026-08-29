import { Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../config/db.js';
import { redis } from '../../config/redis.js';
import { AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';

export class CmsArticleController {
    /**
     * List Articles (Filtered & Paginated)
     */
    static async listArticles(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const page = Math.max(1, parseInt(req.query.page as string) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
            const category = req.query.category as string;
            const status = req.query.status as string;
            const country = req.query.country as string;
            const search = req.query.search as string;

            const where: any = {};

            if (category && category !== 'All') {
                where.category = { equals: category, mode: 'insensitive' };
            }
            if (status && status !== 'All') {
                where.status = status;
            }
            if (country && country !== 'All') {
                where.country = country.toUpperCase();
            }
            if (search && search.trim()) {
                const term = search.trim();
                where.OR = [
                    { id: { contains: term, mode: 'insensitive' } },
                    { title: { contains: term, mode: 'insensitive' } },
                    { source: { contains: term, mode: 'insensitive' } },
                ];
            }

            const [total, articles] = await Promise.all([
                prisma.article.count({ where }),
                prisma.article.findMany({
                    where,
                    orderBy: { publishedAt: 'desc' },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
            ]);

            return res.json({
                success: true,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                articles,
            });
        } catch (error: any) {
            console.error('CMS listArticles Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Get Single Article by ID
     */
    static async getArticle(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { id } = req.params;
            const article = await prisma.article.findUnique({
                where: { id },
            });

            if (!article) {
                return res.status(404).json({ success: false, error: 'Article not found.' });
            }

            return res.json({ success: true, article });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Create Article
     */
    static async createArticle(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const {
                title,
                summary,
                rawContent,
                category,
                country = 'IN',
                source = 'NewsFlow Editorial',
                author,
                url,
                imageUrl,
                status = 'PUBLISHED',
                isHero = false,
                isPinned = false,
                translations,
            } = req.body;

            if (!title || !summary || !category) {
                return res.status(400).json({
                    success: false,
                    error: 'Title, summary, and category are required.',
                });
            }

            const cleanUrl = url && url.trim() ? url.trim() : `https://newsflow.app/story/${Date.now()}`;
            const hash = crypto.createHash('md5').update(`${cleanUrl}-${title.slice(0, 30)}`).digest('hex');

            const article = await prisma.article.create({
                data: {
                    hash,
                    title: title.trim(),
                    summary: summary.trim(),
                    rawContent: rawContent?.trim() || summary.trim(),
                    category: category.trim(),
                    country: country.toUpperCase(),
                    source: source.trim(),
                    author: author?.trim() || req.admin?.name || 'NewsFlow Staff',
                    url: cleanUrl,
                    imageUrl: imageUrl?.trim() || undefined,
                    status,
                    isHero: Boolean(isHero),
                    isPinned: Boolean(isPinned),
                    translations: translations || undefined,
                    publishedAt: new Date(),
                },
            });

            // Flush Redis Feeds cache
            await CmsArticleController.flushFeedCaches(country, category);

            // Audit log
            if (req.admin) {
                await prisma.cmsAuditLog.create({
                    data: {
                        adminId: req.admin.id,
                        action: 'ARTICLE_CREATE',
                        entityType: 'Article',
                        entityId: article.id,
                        details: { title: article.title, category: article.category },
                    },
                });
            }

            return res.status(201).json({ success: true, article });
        } catch (error: any) {
            console.error('CMS createArticle Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Update Article
     */
    static async updateArticle(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { id } = req.params;
            const {
                title,
                summary,
                rawContent,
                category,
                country,
                source,
                author,
                url,
                imageUrl,
                status,
                isHero,
                isPinned,
                translations,
            } = req.body;

            const existing = await prisma.article.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ success: false, error: 'Article not found.' });
            }

            const dataToUpdate: any = {};
            if (title !== undefined) dataToUpdate.title = title.trim();
            if (summary !== undefined) dataToUpdate.summary = summary.trim();
            if (rawContent !== undefined) dataToUpdate.rawContent = rawContent.trim();
            if (category !== undefined) dataToUpdate.category = category.trim();
            if (country !== undefined) dataToUpdate.country = country.toUpperCase();
            if (source !== undefined) dataToUpdate.source = source.trim();
            if (author !== undefined) dataToUpdate.author = author.trim();
            if (url !== undefined) dataToUpdate.url = url.trim();
            if (imageUrl !== undefined) dataToUpdate.imageUrl = imageUrl.trim();
            if (status !== undefined) dataToUpdate.status = status;
            if (isHero !== undefined) dataToUpdate.isHero = Boolean(isHero);
            if (isPinned !== undefined) dataToUpdate.isPinned = Boolean(isPinned);
            if (translations !== undefined) dataToUpdate.translations = translations;

            const updated = await prisma.article.update({
                where: { id },
                data: dataToUpdate,
            });

            await CmsArticleController.flushFeedCaches(updated.country, updated.category);

            if (req.admin) {
                await prisma.cmsAuditLog.create({
                    data: {
                        adminId: req.admin.id,
                        action: 'ARTICLE_UPDATE',
                        entityType: 'Article',
                        entityId: updated.id,
                        details: dataToUpdate,
                    },
                });
            }

            return res.json({ success: true, article: updated });
        } catch (error: any) {
            console.error('CMS updateArticle Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Delete Article
     */
    static async deleteArticle(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { id } = req.params;
            const existing = await prisma.article.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ success: false, error: 'Article not found.' });
            }

            await prisma.article.delete({ where: { id } });
            await CmsArticleController.flushFeedCaches(existing.country, existing.category);

            if (req.admin) {
                await prisma.cmsAuditLog.create({
                    data: {
                        adminId: req.admin.id,
                        action: 'ARTICLE_DELETE',
                        entityType: 'Article',
                        entityId: id,
                        details: { title: existing.title },
                    },
                });
            }

            return res.json({ success: true, message: 'Article deleted successfully.' });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Toggle Hero Status
     */
    static async toggleHero(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { id } = req.params;
            const article = await prisma.article.findUnique({ where: { id } });
            if (!article) return res.status(404).json({ success: false, error: 'Article not found.' });

            const updated = await prisma.article.update({
                where: { id },
                data: { isHero: !article.isHero },
            });

            await CmsArticleController.flushFeedCaches(updated.country, updated.category);
            return res.json({ success: true, article: updated });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Bulk Action
     */
    static async bulkAction(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { ids, action, targetCategory, targetStatus } = req.body;
            if (!Array.isArray(ids) || ids.length === 0 || !action) {
                return res.status(400).json({ success: false, error: 'Article IDs array and action required.' });
            }

            if (action === 'DELETE') {
                await prisma.article.deleteMany({ where: { id: { in: ids } } });
            } else if (action === 'CHANGE_CATEGORY' && targetCategory) {
                await prisma.article.updateMany({
                    where: { id: { in: ids } },
                    data: { category: targetCategory },
                });
            } else if (action === 'CHANGE_STATUS' && targetStatus) {
                await prisma.article.updateMany({
                    where: { id: { in: ids } },
                    data: { status: targetStatus },
                });
            }

            await CmsArticleController.flushAllFeedCaches();

            return res.json({ success: true, count: ids.length, action });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    private static async flushFeedCaches(country: string, category: string) {
        try {
            if (redis) {
                await redis.del(`feed:${country}`);
                await redis.del(`feed:GLOBAL`);
                await redis.del(`category:${country}:${category}`);
            }
        } catch (e) { }
    }

    private static async flushAllFeedCaches() {
        try {
            if (redis) {
                const keys = await redis.keys('feed:*');
                if (keys.length > 0) await redis.del(...keys);
            }
        } catch (e) { }
    }
}
