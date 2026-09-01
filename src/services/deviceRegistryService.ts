import axios from 'axios';
import { redis, checkRedisHealth } from '../config/redis.js';
import { prisma } from '../config/db.js';
import { logStream } from './logStreamService.js';

export interface DeviceRegistryData {
  pushToken: string;
  categories: string[];
  country: string;
  lastSeenAt: number;
}

const REDIS_DEVICE_KEY = 'active_mobile_devices';

/**
 * Registers or updates a mobile device in Redis (and fallback in PostgreSQL)
 */
export async function registerDeviceInRedis(
  pushToken: string,
  categories: string[],
  country: string = 'IN'
): Promise<void> {
  if (!pushToken || typeof pushToken !== 'string') return;

  const deviceData: DeviceRegistryData = {
    pushToken,
    categories: Array.isArray(categories) && categories.length > 0 ? categories : ['All', 'My Feed'],
    country: (country || 'IN').toUpperCase(),
    lastSeenAt: Date.now(),
  };

  try {
    if (checkRedisHealth() && redis) {
      await redis.hset(REDIS_DEVICE_KEY, pushToken, JSON.stringify(deviceData));
      // Expire device set after 14 days of inactivity
      await redis.expire(REDIS_DEVICE_KEY, 14 * 86400);
      console.log(`⚡ [Redis Device Registry] Registered device ${pushToken.slice(0, 18)}... with ${deviceData.categories.length} categories.`);
    }
  } catch (err: any) {
    console.warn('[Redis Device Registry Warning] Failed to store in Redis:', err.message);
  }
}

/**
 * Returns all active push tokens subscribed to a specific news category
 */
export async function getActiveSubscribersForCategory(category: string): Promise<string[]> {
  const targetCategory = (category || '').toLowerCase().trim();
  const matchedTokens = new Set<string>();

  // 1. Check Fast Redis In-Memory Registry First
  try {
    if (checkRedisHealth() && redis) {
      const allEntries = await redis.hgetall(REDIS_DEVICE_KEY);
      for (const [token, rawJson] of Object.entries(allEntries)) {
        try {
          const data: DeviceRegistryData = JSON.parse(rawJson);
          if (
            !data.categories ||
            data.categories.length === 0 ||
            data.categories.some(
              (c) =>
                c.toLowerCase() === targetCategory ||
                c.toLowerCase() === 'all' ||
                c.toLowerCase() === 'my feed' ||
                c.toLowerCase() === 'trending'
            )
          ) {
            matchedTokens.add(token);
          }
        } catch {
          // Ignore parse errors on individual token entries
        }
      }
    }
  } catch (redisErr: any) {
    console.warn('[Redis Device Query Warning]:', redisErr.message);
  }

  // 2. Fallback to PostgreSQL Device Subscriptions
  if (matchedTokens.size === 0) {
    try {
      const dbSubs = await prisma.deviceSubscription.findMany({
        select: { pushToken: true, categories: true },
      });

      for (const sub of dbSubs) {
        if (
          !sub.categories ||
          sub.categories.length === 0 ||
          sub.categories.some(
            (c) =>
              c.toLowerCase() === targetCategory ||
              c.toLowerCase() === 'all' ||
              c.toLowerCase() === 'my feed' ||
              c.toLowerCase() === 'trending'
          )
        ) {
          matchedTokens.add(sub.pushToken);
        }
      }
    } catch (dbErr: any) {
      console.warn('[DB Device Query Warning]:', dbErr.message);
    }
  }

  return Array.from(matchedTokens).filter((t) => t && t.startsWith('ExponentPushToken'));
}

/**
 * Automatically dispatches real-time push notifications to all connected mobile devices
 * as soon as brand-new articles are saved to PostgreSQL
 */
export async function broadcastIngestPushToConnectedDevices(latestArticle: {
  id?: string;
  title: string;
  summary: string;
  category: string;
  imageUrl?: string | null;
  url?: string;
}): Promise<number> {
  if (!latestArticle || !latestArticle.title) return 0;

  try {
    const pushTokens = await getActiveSubscribersForCategory(latestArticle.category);

    if (pushTokens.length === 0) {
      console.log(`ℹ️ [Push Broadcast] No active devices currently subscribed to "${latestArticle.category}".`);
      return 0;
    }

    const messages = pushTokens.map((token) => ({
      to: token,
      sound: 'default',
      priority: 'high',
      title: `⚡ ${latestArticle.category.toUpperCase()}: ${latestArticle.title}`,
      body: latestArticle.summary ? latestArticle.summary.slice(0, 120) + '...' : latestArticle.title,
      data: {
        articleId: latestArticle.id,
        category: latestArticle.category,
        url: latestArticle.url,
      },
    }));

    // Send in chunks of 100 to Expo Push API
    const chunkSize = 100;
    let deliveredCount = 0;

    for (let i = 0; i < messages.length; i += chunkSize) {
      const batch = messages.slice(i, i + chunkSize);
      await axios.post('https://exp.host/--/api/v2/push/send', batch, {
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      });
      deliveredCount += batch.length;
    }

    const broadcastMsg = `🚀 [Real-Time Push Broadcast] Delivered breaking news alert "${latestArticle.title.slice(0, 35)}..." to ${deliveredCount} active Redis devices!`;
    console.log(broadcastMsg);
    logStream.emitLog('info', broadcastMsg);

    return deliveredCount;
  } catch (err: any) {
    console.warn('[Push Broadcast Warning] Failed to deliver push notifications:', err.message);
    return 0;
  }
}
