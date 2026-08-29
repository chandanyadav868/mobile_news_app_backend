import { Response } from 'express';
import { prisma } from '../../config/db.js';
import { AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';

export class CmsPollController {
    /**
     * List Polls with Vote Metrics
     */
    static async listPolls(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const polls = await prisma.communityPoll.findMany({
                include: { options: true },
                orderBy: { createdAt: 'desc' },
            });

            const enriched = polls.map((p) => {
                const totalVotes = p.options.reduce((sum, opt) => sum + opt.votes, 0);
                return {
                    ...p,
                    totalVotes,
                    options: p.options.map((opt) => ({
                        ...opt,
                        percentage: totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0,
                    })),
                };
            });

            return res.json({ success: true, polls: enriched });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Create Poll
     */
    static async createPoll(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { question, category, topicTag, authorName = 'NewsFlow Editorial', options } = req.body;
            if (!question || !category || !Array.isArray(options) || options.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'Question, category, and at least 2 options are required.',
                });
            }

            const poll = await prisma.communityPoll.create({
                data: {
                    question: question.trim(),
                    category: category.trim(),
                    topicTag: topicTag?.trim() || null,
                    authorName: authorName.trim(),
                    options: {
                        create: options.map((optText: string) => ({
                            text: String(optText).trim(),
                            votes: 0,
                        })),
                    },
                },
                include: { options: true },
            });

            return res.status(201).json({ success: true, poll });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Update Poll
     */
    static async updatePoll(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { id } = req.params;
            const { question, category, topicTag, isActive } = req.body;

            const updated = await prisma.communityPoll.update({
                where: { id },
                data: {
                    question: question?.trim(),
                    category: category?.trim(),
                    topicTag: topicTag?.trim(),
                    isActive: isActive !== undefined ? Boolean(isActive) : undefined,
                },
                include: { options: true },
            });

            return res.json({ success: true, poll: updated });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Reset Poll Votes
     */
    static async resetPoll(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { id } = req.params;
            await prisma.pollOption.updateMany({
                where: { pollId: id },
                data: { votes: 0 },
            });

            return res.json({ success: true, message: 'Poll votes reset to 0.' });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Delete Poll
     */
    static async deletePoll(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { id } = req.params;
            await prisma.communityPoll.delete({ where: { id } });
            return res.json({ success: true, message: 'Poll deleted.' });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
}
