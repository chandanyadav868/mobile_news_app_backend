import { Router } from 'express';
import { getInsights, createInsight } from '../controllers/insights.controller.js';

const router = Router();

router.get('/', getInsights);
router.post('/', createInsight);

export default router;
