import { Router } from 'express';
// @ts-ignore
import multer from 'multer';
import { PdfController } from '../controllers/pdfController.js';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
});

// POST /api/v1/pdf/extract (supports multipart 'file' field or JSON 'pdfBase64')
router.post('/extract', upload.single('file'), PdfController.extractPdf);

// POST /api/v1/pdf/summarize (Universal LLM 60-word briefing)
router.post('/summarize', PdfController.summarizePdf);

export default router;
