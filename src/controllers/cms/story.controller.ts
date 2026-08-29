import { Response } from 'express';
import { prisma } from '../../config/db.js';
import { AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';

export class CmsStoryController {
    /**
     * List Visual Stories
     */
    static async listStories(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const stories = await prisma.visualStory.findMany({
                include: { slides: { orderBy: { sortOrder: 'asc' } } },
                orderBy: { createdAt: 'desc' },
            });
            return res.json({ success: true, stories });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Create Visual Story with Slides
     */
    static async createStory(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { title, subtitle, category, coverImage, slides = [] } = req.body;
            if (!title || !category || !coverImage) {
                return res.status(400).json({
                    success: false,
                    error: 'Title, category, and cover image are required.',
                });
            }

            const story = await prisma.visualStory.create({
                data: {
                    title: title.trim(),
                    subtitle: subtitle?.trim() || null,
                    category: category.trim(),
                    coverImage: coverImage.trim(),
                    slides: {
                        create: slides.map((s: any, idx: number) => ({
                            image: s.image?.trim() || coverImage.trim(),
                            headline: s.headline?.trim() || title.trim(),
                            subheadline: s.subheadline?.trim() || null,
                            content: s.content?.trim() || '',
                            sortOrder: idx,
                        })),
                    },
                },
                include: { slides: true },
            });

            return res.status(201).json({ success: true, story });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Update Visual Story
     */
    static async updateStory(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { id } = req.params;
            const { title, subtitle, category, coverImage, isActive, slides } = req.body;

            const existing = await prisma.visualStory.findUnique({ where: { id } });
            if (!existing) return res.status(404).json({ success: false, error: 'Story not found.' });

            // If new slides provided, replace existing slides
            if (Array.isArray(slides)) {
                await prisma.storySlide.deleteMany({ where: { storyId: id } });
            }

            const updated = await prisma.visualStory.update({
                where: { id },
                data: {
                    title: title?.trim(),
                    subtitle: subtitle?.trim(),
                    category: category?.trim(),
                    coverImage: coverImage?.trim(),
                    isActive: isActive !== undefined ? Boolean(isActive) : undefined,
                    slides: Array.isArray(slides)
                        ? {
                              create: slides.map((s: any, idx: number) => ({
                                  image: s.image?.trim() || coverImage?.trim() || existing.coverImage,
                                  headline: s.headline?.trim() || existing.title,
                                  subheadline: s.subheadline?.trim() || null,
                                  content: s.content?.trim() || '',
                                  sortOrder: idx,
                              })),
                          }
                        : undefined,
                },
                include: { slides: { orderBy: { sortOrder: 'asc' } } },
            });

            return res.json({ success: true, story: updated });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Delete Visual Story
     */
    static async deleteStory(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { id } = req.params;
            await prisma.visualStory.delete({ where: { id } });
            return res.json({ success: true, message: 'Visual story deleted.' });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
}
