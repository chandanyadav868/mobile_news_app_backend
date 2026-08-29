import { Router } from 'express';
import { authenticateAdmin, requireRole } from '../middleware/adminAuth.js';
import { AdminRole } from '@prisma/client';
import { CmsAuthController } from '../controllers/cms/auth.controller.js';
import { CmsArticleController } from '../controllers/cms/article.controller.js';
import { CmsAiController } from '../controllers/cms/ai.controller.js';
import { CmsStoryController } from '../controllers/cms/story.controller.js';
import { CmsPollController } from '../controllers/cms/poll.controller.js';
import { CmsRssController } from '../controllers/cms/rss.controller.js';
import { CmsCategoryController } from '../controllers/cms/category.controller.js';
import { CmsPushController } from '../controllers/cms/push.controller.js';
import { CmsAnalyticsController } from '../controllers/cms/analytics.controller.js';

const router = Router();

// ==========================================
// 1. PUBLIC AUTH ROUTES
// ==========================================
router.post('/auth/login', CmsAuthController.login);

// ==========================================
// 2. PROTECTED CMS ROUTES (Require Admin Auth)
// ==========================================
router.use(authenticateAdmin);

// Auth & Staff Management
router.get('/auth/me', CmsAuthController.getMe);
router.get('/auth/users', requireRole([AdminRole.SUPER_ADMIN]), CmsAuthController.listUsers);
router.post('/auth/users', requireRole([AdminRole.SUPER_ADMIN]), CmsAuthController.createUser);

// Articles Management
router.get('/articles', CmsArticleController.listArticles);
router.get('/articles/:id', CmsArticleController.getArticle);
router.post('/articles', CmsArticleController.createArticle);
router.put('/articles/:id', CmsArticleController.updateArticle);
router.delete('/articles/:id', CmsArticleController.deleteArticle);
router.patch('/articles/:id/hero', CmsArticleController.toggleHero);
router.post('/articles/bulk', CmsArticleController.bulkAction);

// AI Copilot Studio
router.post('/ai/summarize', CmsAiController.summarize);
router.post('/ai/fact-check', CmsAiController.factCheck);

// Visual Stories Management
router.get('/stories', CmsStoryController.listStories);
router.post('/stories', CmsStoryController.createStory);
router.put('/stories/:id', CmsStoryController.updateStory);
router.delete('/stories/:id', CmsStoryController.deleteStory);

// Community Polls
router.get('/polls', CmsPollController.listPolls);
router.post('/polls', CmsPollController.createPoll);
router.put('/polls/:id', CmsPollController.updatePoll);
router.post('/polls/:id/reset', CmsPollController.resetPoll);
router.delete('/polls/:id', CmsPollController.deletePoll);

// RSS Ingestion & Feeds Control
router.get('/rss/sources', CmsRssController.listSources);
router.post('/rss/sources', CmsRssController.createSource);
router.put('/rss/sources/:id', CmsRssController.updateSource);
router.delete('/rss/sources/:id', CmsRssController.deleteSource);
router.post('/rss/trigger-all', CmsRssController.triggerAll);

// Categories & Taxonomy Control
router.get('/categories', CmsCategoryController.listCategories);
router.post('/categories', CmsCategoryController.createCategory);
router.put('/categories/:id', CmsCategoryController.updateCategory);
router.delete('/categories/:id', CmsCategoryController.deleteCategory);

// Push Notifications Studio
router.post('/push/broadcast', CmsPushController.broadcast);
router.get('/push/history', CmsPushController.history);

// Analytics & System Health
router.get('/analytics/overview', CmsAnalyticsController.getOverview);
router.get('/analytics/audit-logs', CmsAnalyticsController.getAuditLogs);
router.post('/analytics/flush-cache', CmsAnalyticsController.flushCache);

export default router;
