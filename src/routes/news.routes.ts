import { Router } from 'express';
import {
  getFeed,
  getCategoryNews,
  triggerManualIngest,
  checkNewArticles,
  streamIngestLogs,
  getRecentLogs,
  translateNewsArticle,
  getNewsDeepDive,
} from '../controllers/news.controller.js';

const router = Router();

router.get('/feed', getFeed);
router.get('/check-new', checkNewArticles);
router.get('/category/:category', getCategoryNews);
router.post('/refresh', triggerManualIngest);
router.post('/translate', translateNewsArticle);
router.post('/deep-dive', getNewsDeepDive);

// Live Streaming Logs & Polling Endpoints
router.get('/stream-logs', streamIngestLogs);
router.get('/logs', getRecentLogs);

export default router;
