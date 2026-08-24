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
    const keys = await redis.keys('news:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`🧹 [Cache] Cleared ${keys.length} news cache keys`);
    }
  } catch (error) {
    // Ignore
  }
}
