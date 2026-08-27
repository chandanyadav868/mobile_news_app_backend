import { Router, Request, Response } from 'express';
import newsRoutes from './news.routes.js';
import insightsRoutes from './insights.routes.js';
import timelinesRoutes from './timelines.routes.js';
import notificationRoutes from './notification.routes.js';
import feedRoutes from './feed.routes.js';
import speechRoutes from './speech.routes.js';
import pdfRoutes from './pdf.routes.js';
import { DashboardController } from '../controllers/dashboardController.js';

const router = Router();

router.use('/news', newsRoutes);
router.use('/feeds', feedRoutes);
router.use('/speech', speechRoutes);
router.use('/pdf', pdfRoutes);
router.use('/insights', insightsRoutes);
router.use('/timelines', timelinesRoutes);
router.use('/notifications', notificationRoutes);

// ─── Live Telemetry, SSE Stream & Mission Control Endpoints ──────────────────
router.get('/dashboard/stats', DashboardController.getStats);
router.get('/dashboard/stream', DashboardController.streamTelemetry);
router.post('/dashboard/toggle-ai', DashboardController.toggleAi);
router.post('/dashboard/toggle-model', DashboardController.toggleModel);
router.post('/dashboard/trigger-ingest', DashboardController.triggerIngest);
router.post('/dashboard/clear-cache', DashboardController.clearCache);
router.post('/dashboard/summarize-test', DashboardController.summarizeTest);

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    service: 'newsflow-backend',
    timestamp: new Date().toISOString(),
  });
});

export default router;
