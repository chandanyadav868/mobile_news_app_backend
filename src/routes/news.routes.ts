import { Router } from 'express';
import {
  getFeed,
  getCategoryNews,
  triggerManualIngest,
  checkNewArticles,
} from '../controllers/news.controller.js';

const router = Router();

router.get('/feed', getFeed);
router.get('/check-new', checkNewArticles);
router.get('/category/:category', getCategoryNews);
router.post('/refresh', triggerManualIngest);

export default router;
