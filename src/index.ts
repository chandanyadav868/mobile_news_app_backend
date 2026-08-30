import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env.js';
import { connectDB, prisma } from './config/db.js';
import { redis } from './config/redis.js';
import { initIngestWorker } from './workers/ingestWorker.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { apiRateLimiter } from './middlewares/rateLimiter.js';
import { renderDatabaseAdmin } from './controllers/admin.controller.js';
import { DashboardController } from './controllers/dashboardController.js';
import { CmsDashboardController } from './controllers/cmsDashboard.controller.js';

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

// Morgan HTTP request logging commented out to keep terminal focused on audio telemetry
// if (env.NODE_ENV !== 'test') {
//   app.use(morgan('dev'));
// }

// ─── Visual Dashboards & Admin UI ─────────────────────────────────────────────
app.get('/cms', CmsDashboardController.renderPortal);
app.get('/admin/cms', CmsDashboardController.renderPortal);
app.get('/dashboard', DashboardController.renderDashboard);
app.get('/admin/telemetry', DashboardController.renderDashboard);
app.get('/admin/database', renderDatabaseAdmin);

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

  const server = app.listen(env.PORT, () => {
    console.log(`
  🚀 ====================================================
  🌟  NewsFlow Production Backend Server is Live!
  📡  Listening on:   http://localhost:${env.PORT}
  📊  DB Explorer:    http://localhost:${env.PORT}/admin/database
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
