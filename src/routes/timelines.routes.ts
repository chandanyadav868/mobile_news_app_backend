import { Router } from 'express';
import { getTimelines, trackKeyword } from '../controllers/timelines.controller.js';

const router = Router();

router.get('/', getTimelines);
router.post('/track', trackKeyword);

export default router;
