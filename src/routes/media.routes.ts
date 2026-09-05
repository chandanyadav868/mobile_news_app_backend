import { Router } from 'express';
// @ts-ignore
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { MediaController } from '../controllers/media.controller.js';

const router = Router();

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'images');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${cleanName}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (_req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WEBP, GIF) are allowed!'));
    }
  },
});

// GET /api/v1/media - Query list of all media items with pagination & metrics
router.get('/', MediaController.getMedia);

// GET /api/v1/media/stats - Aggregate storage savings and imgproxy health
router.get('/stats', MediaController.getStats);

// POST /api/v1/media/upload - Multipart image upload
router.post('/upload', upload.single('image'), MediaController.uploadFile);

// POST /api/v1/media/url - Direct web image URL ingestion
router.post('/url', MediaController.registerUrl);

// POST /api/v1/media/sync-db - Sync articles and visual stories from database
router.post('/sync-db', MediaController.syncDatabaseImages);

// PUT /api/v1/media/:id - Edit title, altText, or replace URL
router.put('/:id', MediaController.updateMedia);

// DELETE /api/v1/media/:id - Delete media item and local file
router.delete('/:id', MediaController.deleteMedia);

export default router;
