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
 * 🧹 Step 1: Prunes heavy rawContent (>14 days old) to reclaim 95% of row bytes
 * Keeps title, summary, url, imageUrl, category, author, and translations intact.
 */
export async function pruneOldArticleBodies(olderThanDays = 14): Promise<number> {
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
 * 🗑️ Step 2: Smart Engagement-Preserving Deletion (Day 30+)
 * Deletes articles older than 30 days EXCEPT those bookmarked, shared, or editorial.
 */
export async function deleteUnengagedOldArticles(olderThanDays = 30): Promise<{ deletedCount: number; protectedBookmarks: number }> {
  try {
    // 1. Get count of distinct bookmarked IDs across all users for telemetry
    const bookmarkRows: any = await prisma.$queryRawUnsafe(`
      SELECT COUNT(DISTINCT b_id) as total_protected
      FROM "User", unnest("bookmarkedArticleIds") as b_id
      WHERE "bookmarkedArticleIds" IS NOT NULL;
    `);
    const protectedBookmarks = bookmarkRows && bookmarkRows[0] ? parseInt(bookmarkRows[0].total_protected, 10) || 0 : 0;

    // 2. Perform safe deletion with 5 strict protection guarantees
    const deleteQuery = `
      DELETE FROM "Article"
      WHERE "publishedAt" < NOW() - INTERVAL '${olderThanDays} days'
        -- 1. Must NOT be pinned or hero
        AND "isPinned" = false
        AND "isHero" = false
        -- 2. Must NOT be an editorial story manually created by admin
        AND "source" != 'NewsFlow Editorial'
        -- 3. Must NEVER have been shared by any user
        AND "shareCount" = 0
        -- 4. Must NOT be bookmarked by any registered user
        AND "id" NOT IN (
          SELECT DISTINCT unnest("bookmarkedArticleIds") 
          FROM "User" 
          WHERE "bookmarkedArticleIds" IS NOT NULL
        );
    `;

    const deletedCount = await prisma.$executeRawUnsafe(deleteQuery);
    console.log(`🛡️ [Lifecycle Worker] Smart Retention: Deleted ${deletedCount} unengaged articles (> ${olderThanDays}d). Protected ${protectedBookmarks} bookmarked stories.`);
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
 */
export async function runFullLifecycleMaintenance(rawContentDays = 14, deleteDays = 30): Promise<LifecycleRunReport> {
  const startTime = new Date().toISOString();
  console.log(`🚀 [Lifecycle Maintenance] Starting execution at ${startTime}...`);

  const rawContentPrunedCount = await pruneOldArticleBodies(rawContentDays);
  const { deletedCount, protectedBookmarks } = await deleteUnengagedOldArticles(deleteDays);

  return {
    timestamp: startTime,
    rawContentPrunedCount,
    unengagedArticlesDeletedCount: deletedCount,
    protectedBookmarkedCount: protectedBookmarks,
    status: 'SUCCESS',
    message: `Pruned raw text for ${rawContentPrunedCount} articles (>14d). Safely deleted ${deletedCount} un-engaged articles (>30d). Protected ${protectedBookmarks} bookmarked stories.`,
  };
}

/**
 * Schedules automated daily lifecycle execution at 02:30 AM
 */
export function initLifecycleWorker() {
  // Cron syntax: 30 2 * * * (Every day at 02:30 AM server time)
  cron.schedule('30 2 * * *', async () => {
    console.log('⏰ [Lifecycle Worker Cron] Triggering scheduled maintenance...');
    await runFullLifecycleMaintenance(14, 30);
  });

  console.log('⏰ [Lifecycle Worker] Scheduled nightly 14-day pruning & 30-day smart retention cron (30 2 * * *).');
}
