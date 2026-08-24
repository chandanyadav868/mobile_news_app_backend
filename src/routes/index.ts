import { Router, Request, Response } from 'express';
import newsRoutes from './news.routes.js';
import insightsRoutes from './insights.routes.js';
import timelinesRoutes from './timelines.routes.js';
import notificationRoutes from './notification.routes.js';

const router = Router();

router.use('/news', newsRoutes);
router.use('/insights', insightsRoutes);
router.use('/timelines', timelinesRoutes);
router.use('/notifications', notificationRoutes);

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    service: 'newsflow-backend',
    timestamp: new Date().toISOString(),
  });
});

export default router;
