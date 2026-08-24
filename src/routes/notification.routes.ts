import { Router } from 'express';
import {
  subscribeDevice,
  getSubscription,
  broadcastCategoryAlert,
  sendDirectTestPush,
} from '../controllers/notification.controller.js';

const router = Router();

// Device Subscription
router.post('/subscribe', subscribeDevice);
router.get('/subscription/:pushToken', getSubscription);

// Push Notification Dispatchers
router.post('/broadcast', broadcastCategoryAlert);
router.post('/test-push', sendDirectTestPush);

export default router;
