import { Redis } from 'ioredis';
import { env } from './env.js';

let redisClient: Redis | null = null;
let isRedisAvailable = false;

try {
  redisClient = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    retryStrategy(times: number) {
      if (times > 5) {
        console.warn('⚠️ Redis unreachable, falling back to direct DB queries');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
  });

  redisClient.on('connect', () => {
    isRedisAvailable = true;
    console.log('✅ Redis connected successfully for caching');
  });

  redisClient.on('error', (err: any) => {
    isRedisAvailable = false;
    if (env.NODE_ENV === 'development') {
      console.warn('⚠️ Redis error:', err?.message || err);
    }
  });
} catch (e: any) {
  console.warn('⚠️ Failed to initialize Redis client:', e.message);
}

export const redis = redisClient;
export const checkRedisHealth = () => isRedisAvailable;
