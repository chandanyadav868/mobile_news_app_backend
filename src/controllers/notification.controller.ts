import { Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../config/db.js';

const MIN_CATEGORIES = 5;

/**
 * POST /api/v1/notifications/subscribe
 * Registers or updates user push token with subscribed categories (minimum 5 enforced)
 */
export async function subscribeDevice(req: Request, res: Response) {
  try {
    const { pushToken, categories, country } = req.body;

    if (!pushToken || typeof pushToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Valid pushToken is required',
      });
    }

    if (!Array.isArray(categories) || categories.length < MIN_CATEGORIES) {
      return res.status(400).json({
        success: false,
        error: `Minimum ${MIN_CATEGORIES} categories must be selected for notifications. Received ${categories?.length || 0}.`,
      });
    }

    const countryCode = (country || 'IN').toUpperCase();

    // Upsert subscription in database
    const subscription = await prisma.deviceSubscription.upsert({
      where: { pushToken },
      update: {
        categories,
        country: countryCode,
        updatedAt: new Date(),
      },
      create: {
        pushToken,
        categories,
        country: countryCode,
      },
    });

    console.log(
      `🔔 [Push Notification Subscribed] Token: ${pushToken.substring(0, 15)}... Categories (${categories.length}): [${categories.join(', ')}]`
    );

    return res.json({
      success: true,
      message: 'Successfully subscribed to category breaking news alerts',
      data: subscription,
    });
  } catch (error: any) {
    console.error('Error in subscribeDevice:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save notification subscription',
    });
  }
}

/**
 * GET /api/v1/notifications/subscription/:pushToken
 * Returns current subscription details for device
 */
export async function getSubscription(req: Request, res: Response) {
  try {
    const { pushToken } = req.params;
    const subscription = await prisma.deviceSubscription.findUnique({
      where: { pushToken },
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
    }

    return res.json({
      success: true,
      data: subscription,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription',
    });
  }
}

/**
 * POST /api/v1/notifications/broadcast
 * Broadcasts a breaking news alert to all devices subscribed to that category
 */
export async function broadcastCategoryAlert(req: Request, res: Response) {
  try {
    const { category, title, body, articleUrl } = req.body;

    if (!category || !title || !body) {
      return res.status(400).json({
        success: false,
        error: 'category, title, and body are required to broadcast an alert',
      });
    }

    // Find all subscribers whose categories list contains the target category
    const subscribers = await prisma.deviceSubscription.findMany({
      where: {
        categories: {
          has: category,
        },
      },
      select: { pushToken: true },
    });

    if (subscribers.length === 0) {
      return res.json({
        success: true,
        message: 'No subscribers found for this category',
        deliveredCount: 0,
      });
    }

    // Prepare Expo Push Notification messages
    const messages = subscribers
      .filter((s) => s.pushToken.startsWith('ExponentPushToken'))
      .map((s) => ({
        to: s.pushToken,
        sound: 'default',
        title: `🚨 ${category.toUpperCase()}: ${title}`,
        body,
        data: { url: articleUrl, category },
      }));

    if (messages.length > 0) {
      // Send to Expo Push Service
      await axios.post('https://exp.host/--/api/v2/push/send', messages, {
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
      });
    }

    return res.json({
      success: true,
      message: `Alert broadcast to ${subscribers.length} subscribers`,
      deliveredCount: subscribers.length,
    });
  } catch (error: any) {
    console.error('Error in broadcastCategoryAlert:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to broadcast alert',
    });
  }
}

/**
 * POST /api/v1/notifications/test-push
 * Sends an instant real-time test push notification to a specific push token
 */
export async function sendDirectTestPush(req: Request, res: Response) {
  try {
    const { pushToken, title, body, category, article } = req.body;

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        error: 'pushToken is required for test push',
      });
    }

    const testCategory = category || 'Technology';
    const testTitle = title || 'ISRO Successfully Launches Advanced Earth Observation Satellite';
    const testBody =
      body ||
      'The satellite will provide high-resolution real-time imaging data across the subcontinent.';

    const message = {
      to: pushToken,
      sound: 'default',
      title: `🚨 ${testCategory.toUpperCase()}: ${testTitle}`,
      body: testBody,
      data: {
        category: testCategory,
        article: article || {
          id: `test-art-${Date.now()}`,
          title: testTitle,
          summary: testBody,
          content: testBody,
          category: testCategory,
          source: 'NewsFlow Alerts Desk',
          pubDate: new Date().toISOString(),
          image:
            'https://images.unsplash.com/photo-1517976487508-3729e2f47c0b?w=1000&auto=format&fit=crop&q=80',
          link: 'https://inshorts.com',
        },
      },
    };

    let expoResponse = null;
    if (pushToken.includes('Fallback') || pushToken.includes('Simulated')) {
      return res.json({
        success: true,
        message: 'Simulated push alert dispatched (Development/Fallback token)',
        payload: message,
        expoResponse: { data: { status: 'ok', id: 'simulated-ticket-id' } },
      });
    }

    if (pushToken.startsWith('ExponentPushToken')) {
      const response = await axios.post('https://exp.host/--/api/v2/push/send', [message], {
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
      });
      expoResponse = response.data;
    }

    return res.json({
      success: true,
      message: 'Test push notification dispatched successfully',
      payload: message,
      expoResponse,
    });
  } catch (error: any) {
    console.error('Error in sendDirectTestPush:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to dispatch test push notification',
      details: error?.message,
    });
  }
}

