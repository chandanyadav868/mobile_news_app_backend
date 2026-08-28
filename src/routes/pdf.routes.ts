import { Router } from 'express';
// @ts-ignore
import multer from 'multer';
import { PdfController } from '../controllers/pdfController.js';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB max
});

// POST /api/v1/pdf/session-init (Fast initialization for large PDFs, returns totalPages in <200ms)
router.post('/session-init', upload.single('file'), PdfController.sessionInit);

// POST /api/v1/pdf/batch-extract (On-demand page range e.g. Pages 1-5, 6-10 with Math Verbalization)
router.post('/batch-extract', PdfController.batchExtract);

// POST /api/v1/pdf/extract (Single-shot extraction)
router.post('/extract', upload.single('file'), PdfController.extractPdf);

// POST /api/v1/pdf/summarize (Universal LLM 60-word briefing)
router.post('/summarize', PdfController.summarizePdf);

export default router;
