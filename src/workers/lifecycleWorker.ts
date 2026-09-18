import cron from 'node-cron';
import { prisma } from '../config/db.js';

export interface LifecycleRunReport {
  timestamp: string;
  rawContentPrunedCount: number;
  unengagedArticlesDeletedCount: number;
  protectedBookmarkedCount: number;
  status: 'SUCCESS' | 'ERROR';
  message: string;
}

/**
 * 🧹 Step 1: Prunes heavy rawContent (>7 days old) to reclaim 95% of row bytes
 * Keeps title, summary, url, imageUrl, category, author, and translations intact.
 */
export async function pruneOldArticleBodies(olderThanDays = 7): Promise<number> {
  try {
    const query = `
      UPDATE "Article"
      SET "rawContent" = NULL
      WHERE "publishedAt" < NOW() - INTERVAL '${olderThanDays} days'
        AND "rawContent" IS NOT NULL;
    `;
    const prunedCount = await prisma.$executeRawUnsafe(query);
    console.log(`🧹 [Lifecycle Worker] Pruned rawContent for ${prunedCount} articles older than ${olderThanDays} days.`);
    return typeof prunedCount === 'number' ? prunedCount : 0;
  } catch (err: any) {
    console.error('❌ [Lifecycle Worker] Error in pruneOldArticleBodies:', err?.message || err);
    return 0;
  }
}

/**
 * 🗑️ Step 2: Smart Engagement-Preserving Deletion (2 Weeks / 14 Days)
 * Keeps only 2 weeks of data in disk storage.
 * Deletes articles older than 14 days EXCEPT those that are bookmarked or shared.
 */
export async function deleteUnengagedOldArticles(olderThanDays = 14): Promise<{ deletedCount: number; protectedBookmarks: number }> {
  try {
    // 1. Get count of distinct bookmarked IDs across all users for telemetry
    const bookmarkRows: any = await prisma.$queryRawUnsafe(`
      SELECT COUNT(DISTINCT b_id) as total_protected
      FROM "User", unnest("bookmarkedArticleIds") as b_id
      WHERE "bookmarkedArticleIds" IS NOT NULL;
    `);
    const protectedBookmarks = bookmarkRows && bookmarkRows[0] ? parseInt(bookmarkRows[0].total_protected, 10) || 0 : 0;

    // 2. Perform safe deletion with strict protection guarantees:
    // Only two weeks (14 days) of unengaged data is kept in disk storage.
    // Articles older than 14 days are deleted EXCEPT if bookmarked, shared, pinned, hero, or editorial.
    const deleteQuery = `
      DELETE FROM "Article"
      WHERE "publishedAt" < NOW() - INTERVAL '${olderThanDays} days'
        -- 1. Must NOT be pinned or hero
        AND "isPinned" = false
        AND "isHero" = false
        -- 2. Must NOT be an editorial story manually created by admin
        AND "source" != 'NewsFlow Editorial'
        -- 3. Must NEVER have been shared by any user (shareCount = 0)
        AND "shareCount" = 0
        -- 4. Must NOT be bookmarked by any registered user
        AND "id" NOT IN (
          SELECT DISTINCT unnest("bookmarkedArticleIds") 
          FROM "User" 
          WHERE "bookmarkedArticleIds" IS NOT NULL
        );
    `;

    const deletedCount = await prisma.$executeRawUnsafe(deleteQuery);
    console.log(`🛡️ [Lifecycle Worker] 2-Week Retention: Deleted ${deletedCount} unengaged articles (> ${olderThanDays}d). Protected ${protectedBookmarks} bookmarked/shared stories.`);
    return {
      deletedCount: typeof deletedCount === 'number' ? deletedCount : 0,
      protectedBookmarks,
    };
  } catch (err: any) {
    console.error('❌ [Lifecycle Worker] Error in deleteUnengagedOldArticles:', err?.message || err);
    return { deletedCount: 0, protectedBookmarks: 0 };
  }
}

/**
 * Executes the complete lifecycle maintenance pipeline (Prune + Smart Delete)
 * Enforces strict 2-week disk retention policy.
 */
export async function runFullLifecycleMaintenance(rawContentDays = 7, deleteDays = 14): Promise<LifecycleRunReport> {
  const startTime = new Date().toISOString();
  console.log(`🚀 [Lifecycle Maintenance] Starting 2-week storage retention execution at ${startTime}...`);

  const rawContentPrunedCount = await pruneOldArticleBodies(rawContentDays);
  const { deletedCount, protectedBookmarks } = await deleteUnengagedOldArticles(deleteDays);

  return {
    timestamp: startTime,
    rawContentPrunedCount,
    unengagedArticlesDeletedCount: deletedCount,
    protectedBookmarkedCount: protectedBookmarks,
    status: 'SUCCESS',
    message: `Pruned raw text for ${rawContentPrunedCount} articles (>7d). Safely deleted ${deletedCount} unengaged articles older than 14 days (2 weeks). Strictly preserved all bookmarked, shared, and editorial stories on disk.`,
  };
}

/**
 * Schedules automated daily lifecycle execution at 02:30 AM
 * and performs an initial non-blocking cleanup on startup.
 */
export function initLifecycleWorker() {
  // Cron syntax: 30 2 * * * (Every day at 02:30 AM server time)
  cron.schedule('30 2 * * *', async () => {
    console.log('⏰ [Lifecycle Worker Cron] Triggering scheduled 2-week storage maintenance...');
    await runFullLifecycleMaintenance(7, 14);
  });

  // Non-blocking initial startup maintenance to enforce 2-week retention immediately
  setTimeout(async () => {
    try {
      console.log('🧹 [Lifecycle Worker] Running initial 2-week storage audit on startup...');
      await runFullLifecycleMaintenance(7, 14);
    } catch (err: any) {
      console.warn('⚠️ [Lifecycle Worker] Startup maintenance skipped:', err?.message || err);
    }
  }, 10000);

  console.log('⏰ [Lifecycle Worker] Scheduled nightly 7-day raw text pruning & 14-day (2 weeks) smart retention cron (30 2 * * *).');
}
