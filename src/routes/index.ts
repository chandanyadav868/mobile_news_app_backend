import { Router, Request, Response } from 'express';
import newsRoutes from './news.routes.js';
import insightsRoutes from './insights.routes.js';
import timelinesRoutes from './timelines.routes.js';
import notificationRoutes from './notification.routes.js';
import feedRoutes from './feed.routes.js';
import speechRoutes from './speech.routes.js';
import pdfRoutes from './pdf.routes.js';
import cmsRoutes from './cms.routes.js';
import authRoutes from './auth.routes.js';
import { DashboardController } from '../controllers/dashboardController.js';
import { BetaController } from '../controllers/betaController.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/cms', cmsRoutes);
router.use('/news', newsRoutes);
router.use('/feeds', feedRoutes);
router.use('/speech', speechRoutes);
router.use('/pdf', pdfRoutes);
router.use('/insights', insightsRoutes);
router.use('/timelines', timelinesRoutes);
router.use('/notifications', notificationRoutes);

// ─── Public Beta & Email Campaign Endpoints ──────────────────────────────────
router.post('/beta/register', BetaController.registerTester);
router.get('/beta/list', BetaController.getTesters);
router.get('/beta/template', BetaController.getTemplate);
router.post('/beta/template', BetaController.updateTemplate);
router.get('/beta/preview', BetaController.renderLivePreview);
router.post('/beta/preview', BetaController.renderLivePreview);
router.post('/beta/send-invite', BetaController.sendInvitation);
router.delete('/beta/:id', BetaController.deleteTester);

// ─── Live Telemetry, SSE Stream & Mission Control Endpoints ──────────────────
router.get('/dashboard/stats', DashboardController.getStats);
router.get('/dashboard/stream', DashboardController.streamTelemetry);
router.post('/dashboard/toggle-ai', DashboardController.toggleAi);
router.post('/dashboard/toggle-model', DashboardController.toggleModel);
router.post('/dashboard/trigger-ingest', DashboardController.triggerIngest);
router.post('/dashboard/clear-cache', DashboardController.clearCache);
router.post('/dashboard/reset-metrics', DashboardController.resetMetrics);
router.post('/dashboard/summarize-test', DashboardController.summarizeTest);

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    service: 'newsflow-backend',
    timestamp: new Date().toISOString(),
  });
});

export default router;
