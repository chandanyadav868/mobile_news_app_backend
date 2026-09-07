import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { connectDB, prisma } from './config/db.js';
import { redis } from './config/redis.js';
import { initSentry } from './config/sentry.js';
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
import { PrivacyController } from './controllers/privacy.controller.js';
import { adminWebGuard } from './middleware/adminWebGuard.js';

import { CmsSeedService } from './services/cmsSeedService.js';

// ─── Initialize Threat & Error APM Monitoring ─────────────────────────────────
initSentry();

const app = express();

// ─── Global Security Middlewares ──────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows inline styles in admin portals while enforcing X-Frame, XSS protection, and MIME sniffing prevention
  })
);
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'x-admin-key'],
  })
);
app.options('*', cors());
app.use(compression());
app.use(cookieParser());

// Clamped payload limits: 2MB protects against Out-Of-Memory DOS attacks
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── Static Uploads Folder ────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ─── Public Beta Tester Registration & Legal Pages ───────────────────────────
app.get('/privacy-policy', PrivacyController.renderPrivacyPolicy);
app.get('/privacy', PrivacyController.renderPrivacyPolicy);
app.get('/join-beta', BetaController.renderPublicLanding);
app.get('/beta-testers', BetaController.renderPublicLanding);
app.post('/api/beta/register', BetaController.registerTester);

// ─── Protected Beta Campaign Studio & Administration ──────────────────────────
app.get('/campaigns', adminWebGuard, BetaController.renderCampaignStudio);
app.get('/testers', adminWebGuard, BetaController.renderCampaignStudio);
app.get('/email-studio', adminWebGuard, BetaController.renderCampaignStudio);
app.get('/dashboard/testers', adminWebGuard, BetaController.renderCampaignStudio);
app.get('/api/beta/list', adminWebGuard, BetaController.getTesters);
app.get('/api/beta/template', adminWebGuard, BetaController.getTemplate);
app.post('/api/beta/template', adminWebGuard, BetaController.updateTemplate);
app.get('/api/beta/preview', adminWebGuard, BetaController.renderLivePreview);
app.post('/api/beta/preview', adminWebGuard, BetaController.renderLivePreview);
app.post('/api/beta/send-invite', adminWebGuard, BetaController.sendInvitation);
app.delete('/api/beta/:id', adminWebGuard, BetaController.deleteTester);

// ─── Protected Visual Dashboards & Admin Portals ──────────────────────────────
app.get('/cms', adminWebGuard, CmsDashboardController.renderPortal);
app.get('/admin/cms', adminWebGuard, CmsDashboardController.renderPortal);
app.get('/dashboard', adminWebGuard, DashboardController.renderDashboard);
app.get('/admin/telemetry', adminWebGuard, DashboardController.renderDashboard);
app.get('/admin/database', adminWebGuard, renderDatabaseAdmin);
app.get('/admin/users', adminWebGuard, AdminUsersController.renderAdminUsersPortal);
app.get('/users-admin', adminWebGuard, AdminUsersController.renderAdminUsersPortal);
app.get('/admin/images', adminWebGuard, MediaDashboardController.renderDashboard);
app.get('/admin/media', adminWebGuard, MediaDashboardController.renderDashboard);
app.get('/media', adminWebGuard, MediaDashboardController.renderDashboard);

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
