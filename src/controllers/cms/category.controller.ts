import { Response } from 'express';
import { prisma } from '../../config/db.js';
import { AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';

export class CmsCategoryController {
    /**
     * List Categories
     */
    static async listCategories(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const categories = await prisma.categoryTaxonomy.findMany({
                orderBy: { sortOrder: 'asc' },
            });
            return res.json({ success: true, categories });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Create Category
     */
    static async createCategory(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { name, emoji = '📰', sortOrder = 0 } = req.body;
            if (!name) {
                return res.status(400).json({ success: false, error: 'Category name is required.' });
            }

            const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
            const category = await prisma.categoryTaxonomy.create({
                data: {
                    name: name.trim(),
                    slug,
                    emoji: emoji.trim(),
                    sortOrder: Number(sortOrder) || 0,
                    isActive: true,
                },
            });

            return res.status(201).json({ success: true, category });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Update Category
     */
    static async updateCategory(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { id } = req.params;
            const { name, emoji, sortOrder, isActive } = req.body;

            const updated = await prisma.categoryTaxonomy.update({
                where: { id },
                data: {
                    name: name?.trim(),
                    emoji: emoji?.trim(),
                    sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
                    isActive: isActive !== undefined ? Boolean(isActive) : undefined,
                },
            });

            return res.json({ success: true, category: updated });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Delete Category
     */
    static async deleteCategory(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { id } = req.params;
            await prisma.categoryTaxonomy.delete({ where: { id } });
            return res.json({ success: true, message: 'Category removed.' });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
}
