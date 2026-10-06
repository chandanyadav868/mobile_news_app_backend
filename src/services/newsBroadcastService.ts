import { Request, Response } from 'express';
import { redis } from '../config/redis.js';

export interface NewArticlesBroadcastPayload {
  count: number;
  categoryCounts?: Record<string, number>;
  categoriesWithNew?: string[];
  latestArticle: {
    id: string;
    title: string;
    summary: string;
    category: string;
    imageUrl?: string | null;
    url?: string;
    publishedAt?: string;
  } | null;
  checkedAt: string;
}

const REDIS_CHANNEL = 'news_stream_channel';
const REDIS_KEY_LATEST_TIME = 'news:latest_ingest_time';
const REDIS_KEY_LATEST_BATCH = 'news:latest_batch_summary';
const REDIS_KEY_CATEGORY_COUNTS = 'news:category_new_counts';

export class NewsBroadcastService {
  private static clients: Set<Response> = new Set();
  private static isSubscribedToRedis = false;
  private static keepaliveTimer: NodeJS.Timeout | null = null;

  /**
   * Register a new mobile client for real-time Server-Sent Events (SSE)
   */
  public static addClient(req: Request, res: Response): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-Accel-Buffering, Last-Event-ID');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Initial handshake packet
    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: new Date().toISOString() })}\n\n`);

    this.clients.add(res);
    console.log(`📡 [NewsBroadcast] Mobile client connected to live SSE stream. Active listeners: ${this.clients.size}`);

    // Ensure keepalive interval is running
    this.startKeepaliveIfNeeded();

    // Ensure Redis Pub/Sub subscription is active
    this.initRedisSubscriptionIfNeeded();

    req.on('close', () => {
      this.clients.delete(res);
      console.log(`📡 [NewsBroadcast] Mobile client disconnected. Active listeners: ${this.clients.size}`);
    });
  }

  /**
   * Heartbeat to prevent cellular carriers / Nginx from dropping idle TCP sockets
   */
  private static startKeepaliveIfNeeded(): void {
    if (this.keepaliveTimer) return;
    this.keepaliveTimer = setInterval(() => {
      if (this.clients.size === 0) return;
      this.clients.forEach((res) => {
        try {
          res.write(': keepalive\n\n');
        } catch {
          this.clients.delete(res);
        }
      });
    }, 25000);
  }

  /**
   * Listen on Redis channel to receive broadcasts from other cluster worker processes
   */
  private static initRedisSubscriptionIfNeeded(): void {
    if (this.isSubscribedToRedis || !redis) return;

    try {
      // Create duplicate subscriber connection for Redis Pub/Sub
      const subscriber = redis.duplicate();
      subscriber.subscribe(REDIS_CHANNEL, (err) => {
        if (err) {
          console.warn('[NewsBroadcast] Redis subscription warning:', err.message);
        } else {
          this.isSubscribedToRedis = true;
          console.log(`⚡ [NewsBroadcast] Subscribed to Redis cluster channel: ${REDIS_CHANNEL}`);
        }
      });

      subscriber.on('message', (channel, message) => {
        if (channel === REDIS_CHANNEL) {
          try {
            const payload: NewArticlesBroadcastPayload = JSON.parse(message);
            this.emitToLocalClients(payload);
          } catch (e) {
            console.warn('[NewsBroadcast] Failed to parse Redis message:', e);
          }
        }
      });
    } catch (err: any) {
      console.warn('[NewsBroadcast] Redis PubSub initialization note:', err.message);
    }
  }

  /**
   * Increment unread count for a category in Redis
   */
  public static async incrementCategoryNewCount(category: string, count: number): Promise<void> {
    if (!redis || !category || count <= 0) return;
    try {
      await redis.hincrby(REDIS_KEY_CATEGORY_COUNTS, category, count);
    } catch (err: any) {
      console.warn('[NewsBroadcast] Redis hincrby note:', err.message);
    }
  }

  /**
   * Retrieve current unread counts per category from Redis
   */
  public static async getCategoryUnreadCounts(): Promise<Record<string, number>> {
    if (!redis) return {};
    try {
      const data = await redis.hgetall(REDIS_KEY_CATEGORY_COUNTS);
      const result: Record<string, number> = {};
      for (const [cat, val] of Object.entries(data || {})) {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num > 0) result[cat] = num;
      }
      return result;
    } catch {
      return {};
    }
  }

  /**
   * Reset category unread counts in Redis after broadcasting to connected clients
   */
  public static async resetCategoryCounts(): Promise<void> {
    if (!redis) return;
    try {
      await redis.del(REDIS_KEY_CATEGORY_COUNTS);
    } catch (err: any) {
      console.warn('[NewsBroadcast] Redis del error:', err.message);
    }
  }

  /**
   * Broadcast new articles to all connected mobile devices
   * Called by RSS Ingest Worker whenever brand-new articles are saved
   */
  public static async notifyNewArticles(payload: NewArticlesBroadcastPayload): Promise<void> {
    const nowIso = payload.checkedAt || new Date().toISOString();

    const categoryCounts = payload.categoryCounts || {};
    const categoriesWithNew = payload.categoriesWithNew || Object.keys(categoryCounts).filter(
      (cat) => (categoryCounts[cat] || 0) > 0
    );

    const enrichedPayload: NewArticlesBroadcastPayload = {
      ...payload,
      categoryCounts,
      categoriesWithNew,
      checkedAt: nowIso,
    };

    // 1. Persist latest batch info in Redis for sub-millisecond HTTP polling gating
    if (redis) {
      try {
        await Promise.all([
          redis.set(REDIS_KEY_LATEST_TIME, nowIso),
          redis.set(REDIS_KEY_LATEST_BATCH, JSON.stringify(enrichedPayload)),
          redis.publish(REDIS_CHANNEL, JSON.stringify(enrichedPayload)),
        ]);
        // ⚡ Atomic Reset: Reset category unread counts in Redis right after broadcast
        // Prevents duplicate accumulation across consecutive cron runs
        await redis.del(REDIS_KEY_CATEGORY_COUNTS);
      } catch (err: any) {
        console.warn('[NewsBroadcast] Redis publish note:', err.message);
      }
    }

    // 2. Emit to locally connected SSE clients on this Node instance
    this.emitToLocalClients(enrichedPayload);
  }

  private static emitToLocalClients(payload: NewArticlesBroadcastPayload): void {
    if (this.clients.size === 0) return;

    const data = `event: new_articles\ndata: ${JSON.stringify(payload)}\n\n`;
    console.log(
      `⚡ [NewsBroadcast] Emitting new articles event (${payload.count} new, categories: ${(payload.categoriesWithNew || []).join(', ') || 'all'}) to ${this.clients.size} connected devices.`
    );

    this.clients.forEach((res) => {
      try {
        res.write(data);
      } catch {
        this.clients.delete(res);
      }
    });
  }

  /**
   * Fast-path check: returns latest ingest metadata from Redis RAM
   */
  public static async getLatestIngestTime(): Promise<string | null> {
    if (!redis) return null;
    try {
      return await redis.get(REDIS_KEY_LATEST_TIME);
    } catch {
      return null;
    }
  }

  public static async getLatestBatchSummary(): Promise<NewArticlesBroadcastPayload | null> {
    if (!redis) return null;
    try {
      const raw = await redis.get(REDIS_KEY_LATEST_BATCH);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public static getActiveClientCount(): number {
    return this.clients.size;
  }
}
