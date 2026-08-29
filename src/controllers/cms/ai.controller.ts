import { Response } from 'express';
import { AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';
import { UniversalLlmService } from '../../services/universalLlmService.js';

export class CmsAiController {
    /**
     * 1-Click AI Summarizer (110–140 words, 3 paragraphs)
     */
    static async summarize(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { title, content } = req.body;
            if (!title) {
                return res.status(400).json({ success: false, error: 'Title is required for AI summarization.' });
            }

            const rawText = content || title;
            const result = await UniversalLlmService.summarizeNews({ title, content: rawText });

            if (!result || !result.crispyStory) {
                return res.status(502).json({ success: false, error: 'Failed to generate AI summary.' });
            }

            return res.json({
                success: true,
                cleanTitle: result.headline || title,
                summary: result.crispyStory,
                bullets: result.bulletPoints || [],
                modelUsed: result.modelUsed,
            });
        } catch (error: any) {
            console.error('CMS AI Summarize Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * AI Document & Story Q&A / Deep Dive
     */
    static async factCheck(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { headline, story } = req.body;
            if (!headline) {
                return res.status(400).json({ success: false, error: 'Headline is required.' });
            }

            const deepDive = await UniversalLlmService.chatDocumentQuestion({
                docTitle: headline,
                contextText: story || headline,
                question: 'Analyze this news story for core verified facts, primary stakeholders, and chronological context.',
            });

            return res.json({
                success: true,
                deepDive,
            });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
}
