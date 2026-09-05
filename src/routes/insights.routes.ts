import { Router } from 'express';
import {
  getInsights,
  createInsight,
  getInsightById,
  updateInsight,
} from '../controllers/insights.controller.js';

const router = Router();

router.get('/', getInsights);
router.post('/', createInsight);
router.get('/:id', getInsightById);
router.put('/:id', updateInsight);

export default router;
