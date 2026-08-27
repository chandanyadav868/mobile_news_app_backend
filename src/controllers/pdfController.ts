import { Request, Response } from 'express';
import { PdfService } from '../services/pdfService.js';

export class PdfController {
    /**
     * POST /api/v1/pdf/extract
     * Handles multipart file upload OR base64 payload
     */
    public static async extractPdf(req: Request, res: Response): Promise<void> {
        try {
            let buffer: Buffer | null = null;
            let fileName = 'Document.pdf';
            const reqAny = req as any;

            if (reqAny.file && reqAny.file.buffer) {
                buffer = reqAny.file.buffer;
                fileName = reqAny.file.originalname || fileName;
            } else if (req.body && req.body.pdfBase64) {
                const cleanBase64 = req.body.pdfBase64.replace(/^data:application\/pdf;base64,/, '');
                buffer = Buffer.from(cleanBase64, 'base64');
                fileName = req.body.fileName || fileName;
            }

            if (!buffer || buffer.length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'No PDF data received. Provide a file upload or pdfBase64 string.',
                });
                return;
            }

            console.log(`📄 [PdfController] Parsing PDF "${fileName}" (${(buffer.length / 1024).toFixed(1)} KB)...`);
            const extractedDoc = await PdfService.extractFromBuffer(buffer, fileName);

            res.json({
                success: true,
                data: extractedDoc,
            });
        } catch (error: any) {
            console.error('❌ [PdfController] Extraction Error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to process PDF file',
            });
        }
    }

    /**
     * POST /api/v1/pdf/summarize
     * Generates Gemini / Universal LLM 60-word executive briefing
     */
    public static async summarizePdf(req: Request, res: Response): Promise<void> {
        try {
            const { text, title } = req.body;
            if (!text || text.trim().length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'Document text is required for AI summarization.',
                });
                return;
            }

            console.log(`🧠 [PdfController] Generating AI summary for "${title || 'PDF Document'}"...`);
            const summary = await PdfService.generateSummary(text, title || 'PDF Document');

            res.json({
                success: true,
                data: summary,
            });
        } catch (error: any) {
            console.error('❌ [PdfController] Summary Error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to generate PDF summary',
            });
        }
    }
}

export default PdfController;
