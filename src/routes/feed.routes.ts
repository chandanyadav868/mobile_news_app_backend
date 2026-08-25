import { Router } from 'express';
import {
  validateFeedUrl,
  addVerifiedFeed,
  getRegisteredFeeds,
} from '../controllers/feed.controller.js';

const router = Router();

// GET /api/v1/feeds - List all registered RSS feeds
router.get('/', getRegisteredFeeds);

// POST /api/v1/feeds/validate - Non-blocking probe to validate any RSS/Atom XML URL
router.post('/validate', validateFeedUrl);

// POST /api/v1/feeds/add - Atomically persist verified feed to verifiedFeeds.json
router.post('/add', addVerifiedFeed);

export default router;
