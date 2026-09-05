import { Router } from 'express';
import {
  getFeed,
  getCategoryNews,
  triggerManualIngest,
  checkNewArticles,
  streamNewsUpdates,
  streamIngestLogs,
  getRecentLogs,
  translateNewsArticle,
  getNewsDeepDive,
  getCategories,
  getArticleById,
  createManualArticle,
  updateArticle,
  searchNews,
  resolveImages,
} from '../controllers/news.controller.js';
import { extractArticle } from '../controllers/articleExtractor.controller.js';

const router = Router();

router.get('/feed', getFeed);
router.get('/categories', getCategories);
router.get('/article/:id', getArticleById);
router.post('/manual', createManualArticle);
router.put('/article/:id', updateArticle);

router.get('/search', searchNews);
router.post('/extract', extractArticle);
router.post('/resolve-images', resolveImages);

router.get('/stream-updates', streamNewsUpdates);
router.get('/check-new', checkNewArticles);
router.get('/category/:category', getCategoryNews);
router.post('/refresh', triggerManualIngest);
router.post('/translate', translateNewsArticle);
router.post('/deep-dive', getNewsDeepDive);

// Live Streaming Logs & Polling Endpoints
router.get('/stream-logs', streamIngestLogs);
router.get('/logs', getRecentLogs);

export default router;
