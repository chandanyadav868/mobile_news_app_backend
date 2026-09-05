import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env.js';
import { connectDB, prisma } from './config/db.js';
import { redis } from './config/redis.js';
import { initIngestWorker } from './workers/ingestWorker.js';
import { initLifecycleWorker } from './workers/lifecycleWorker.js';
import { warmAllRingBuffers } from './services/redisFeedService.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { apiRateLimiter } from './middlewares/rateLimiter.js';
import { renderDatabaseAdmin } from './controllers/admin.controller.js';
import path from 'path';
import { DashboardController } from './controllers/dashboardController.js';
import { CmsDashboardController } from './controllers/cmsDashboard.controller.js';
import { BetaController } from './controllers/betaController.js';
import { AdminUsersController } from './controllers/adminUsers.controller.js';
import { MediaDashboardController } from './controllers/mediaDashboard.controller.js';

import { CmsSeedService } from './services/cmsSeedService.js';

const app = express();

// ─── Global Middlewares ───────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow visual admin scripts
  })
);
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  })
);
app.options('*', cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Static Uploads Folder ────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ─── Public Beta Tester Registration & Campaign Studio Routes ────────────────
app.get('/join-beta', BetaController.renderPublicLanding);
app.get('/beta-testers', BetaController.renderPublicLanding);
app.get('/campaigns', BetaController.renderCampaignStudio);
app.get('/testers', BetaController.renderCampaignStudio);
app.get('/email-studio', BetaController.renderCampaignStudio);
app.get('/dashboard/testers', BetaController.renderCampaignStudio);
app.post('/api/beta/register', BetaController.registerTester);
app.get('/api/beta/list', BetaController.getTesters);
app.get('/api/beta/template', BetaController.getTemplate);
app.post('/api/beta/template', BetaController.updateTemplate);
app.get('/api/beta/preview', BetaController.renderLivePreview);
app.post('/api/beta/preview', BetaController.renderLivePreview);
app.post('/api/beta/send-invite', BetaController.sendInvitation);
app.delete('/api/beta/:id', BetaController.deleteTester);

// ─── Visual Dashboards & Admin UI ─────────────────────────────────────────────
app.get('/cms', CmsDashboardController.renderPortal);
app.get('/admin/cms', CmsDashboardController.renderPortal);
app.get('/dashboard', DashboardController.renderDashboard);
app.get('/admin/telemetry', DashboardController.renderDashboard);
app.get('/admin/database', renderDatabaseAdmin);
app.get('/admin/users', AdminUsersController.renderAdminUsersPortal);
app.get('/users-admin', AdminUsersController.renderAdminUsersPortal);
app.get('/admin/images', MediaDashboardController.renderDashboard);
app.get('/admin/media', MediaDashboardController.renderDashboard);
app.get('/media', MediaDashboardController.renderDashboard);

// Apply rate limiting to API routes
app.use('/api', apiRateLimiter);

// ─── Mount API Routes ─────────────────────────────────────────────────────────
app.use('/api/v1', apiRouter);

// ─── Fallback & Error Handling ────────────────────────────────────────────────
app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});
app.use(errorHandler);

// ─── Bootstrap Server ─────────────────────────────────────────────────────────
async function startServer() {
  await connectDB();

  // Initialize default CMS entities if empty
  await CmsSeedService.seedDefaultsIfNeeded();

  // Start background RSS worker
  initIngestWorker();

  // Start automated storage lifecycle & smart retention worker (Pruning & Cleanup)
  initLifecycleWorker();

  // Pre-warm 20-item Redis ring buffers for all categories
  warmAllRingBuffers().catch((e) => console.warn('Ring buffer warmup note:', e?.message || e));

  const server = app.listen(env.PORT, () => {
    console.log(`
  🚀 ====================================================
  🌟  NewsFlow Production Backend Server is Live!
  📡  Listening on:   http://localhost:${env.PORT}
  📊  DB Explorer:    http://localhost:${env.PORT}/admin/database
  🖼️  Media Studio:   http://localhost:${env.PORT}/admin/images
  👥  User Admin:     http://localhost:${env.PORT}/admin/users
  📰  CMS Studio:     http://localhost:${env.PORT}/admin/cms
  🔗  Health Check:   http://localhost:${env.PORT}/api/v1/health
  📰  Home Feed:      http://localhost:${env.PORT}/api/v1/news/feed
  🌍  Environment:    ${env.NODE_ENV}
  ====================================================
    `);
  });

  // Graceful Shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}, gracefully shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      if (redis) {
        redis.disconnect();
      }
      console.log('✅ Server and database connections closed cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer();
