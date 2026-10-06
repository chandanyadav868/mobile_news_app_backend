import { redis, checkRedisHealth } from '../config/redis.js';

const DEFAULT_TTL = 300; // 5 minutes

export async function getCache<T>(key: string): Promise<T | null> {
  if (!checkRedisHealth() || !redis) return null;
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    return null;
  }
}

export async function setCache(key: string, data: any, ttlSeconds: number = DEFAULT_TTL): Promise<void> {
  if (!checkRedisHealth() || !redis) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
  } catch (error) {
    // Gracefully ignore cache writing errors
  }
}

export async function deleteCache(key: string): Promise<void> {
  if (!checkRedisHealth() || !redis) return;
  try {
    await redis.del(key);
  } catch (error) {
    // Ignore
  }
}

export async function invalidateFeedCache(): Promise<void> {
  if (!checkRedisHealth() || !redis) return;
  try {
    const allKeys = await redis.keys('news:*');
    // Strictly preserve ring buffers and unread tracking counters
    const keysToDelete = allKeys.filter((k) => {
      // 1. Never delete main ring buffer
      if (k === 'news:feed:main') return false;
      // 2. Never delete category unread counter hash
      if (k === 'news:category_new_counts') return false;
      // 3. Never delete category ring buffers (format: news:category:<name>, no colons afterwards)
      if (k.startsWith('news:category:') && !k.includes(':p') && !k.includes(':IN') && !k.includes(':GLOBAL') && !k.includes(':US')) {
        return false;
      }
      return true;
    });

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
      console.log(`🧹 [Cache] Cleared ${keysToDelete.length} cached API responses (strictly preserved Redis ring buffers)`);
    }
  } catch (error) {
    // Ignore
  }
}
