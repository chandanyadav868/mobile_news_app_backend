import { Router } from 'express';
import { getTimelines } from '../controllers/timelines.controller.js';

const router = Router();

router.get('/', getTimelines);

export default router;
