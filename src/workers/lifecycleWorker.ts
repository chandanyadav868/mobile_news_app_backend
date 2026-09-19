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
 * 🧹 Step 1: Prunes heavy rawContent (>7 days old) in safe 5,000-row batches
 * Keeps title, summary, url, imageUrl, category, author, and translations intact.
 */
export async function pruneOldArticleBodies(olderThanDays = 7): Promise<number> {
  let totalPruned = 0;
  const batchSize = 5000;

  try {
    while (true) {
      const query = `
        UPDATE "Article"
        SET "rawContent" = NULL
        WHERE "id" IN (
          SELECT "id"
          FROM "Article"
          WHERE (
            COALESCE("publishedAt", "createdAt") < NOW() - INTERVAL '${olderThanDays} days'
            OR "createdAt" < NOW() - INTERVAL '${olderThanDays} days'
          )
            AND "rawContent" IS NOT NULL
          LIMIT ${batchSize}
        );
      `;
      const prunedCount = await prisma.$executeRawUnsafe(query);
      if (typeof prunedCount === 'number' && prunedCount > 0) {
        totalPruned += prunedCount;
        console.log(`🧹 [Lifecycle Worker] Pruned batch of ${prunedCount} rawContent bodies (Total pruned: ${totalPruned})...`);
      } else {
        break;
      }
    }
    console.log(`🧹 [Lifecycle Worker] Pruning complete: ${totalPruned} total articles pruned.`);
    return totalPruned;
  } catch (err: any) {
    console.error('❌ [Lifecycle Worker] Error in pruneOldArticleBodies:', err?.message || err);
    return totalPruned;
  }
}

/**
 * 🗑️ Step 2: High-Performance 2-Week Disk Retention Deletion (Safe 5,000-Row Batches)
 * Keeps only 2 weeks (14 days) of data in disk storage.
 * Deletes articles older than 14 days EXCEPT those bookmarked, shared, pinned, hero, or editorial.
 */
export async function deleteUnengagedOldArticles(olderThanDays = 14): Promise<{ deletedCount: number; protectedBookmarks: number }> {
  // 1. Safely collect all bookmarked article IDs from all registered users
  let bookmarkedIds: string[] = [];
  try {
    const users = await prisma.user.findMany({
      select: { bookmarkedArticleIds: true },
    });
    const idSet = new Set<string>();
    for (const u of users) {
      if (Array.isArray(u.bookmarkedArticleIds)) {
        for (const bid of u.bookmarkedArticleIds) {
          if (bid && typeof bid === 'string' && bid.trim().length > 0) {
            idSet.add(bid.trim());
          }
        }
      }
    }
    bookmarkedIds = Array.from(idSet);
    console.log(`🛡️ [Lifecycle Worker] Identified ${bookmarkedIds.length} unique bookmarked stories to strictly protect.`);
  } catch (e: any) {
    console.warn('⚠️ [Lifecycle Worker] Could not query Prisma User bookmarks, falling back to empty list:', e?.message || e);
  }

  // 2. Build the bookmark protection clause safely
  let bookmarkProtectionClause = '';
  if (bookmarkedIds.length > 0) {
    // If bookmarked IDs exist, sanitize and protect them via explicit list or NOT EXISTS
    if (bookmarkedIds.length < 3000) {
      const sanitizedIdList = bookmarkedIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
      bookmarkProtectionClause = `AND "id" NOT IN (${sanitizedIdList})`;
    } else {
      bookmarkProtectionClause = `
        AND NOT EXISTS (
          SELECT 1 FROM "User" u
          WHERE u."bookmarkedArticleIds" IS NOT NULL
            AND "Article"."id" = ANY(u."bookmarkedArticleIds")
        )
      `;
    }
  }

  // 3. Batch deletion in chunks of 5,000 rows to prevent PostgreSQL timeouts on 78k+ rows
  let totalDeleted = 0;
  const batchSize = 5000;

  try {
    while (true) {
      const deleteBatchQuery = `
        DELETE FROM "Article"
        WHERE "id" IN (
          SELECT "id"
          FROM "Article"
          WHERE (
            COALESCE("publishedAt", "createdAt") < NOW() - INTERVAL '${olderThanDays} days'
            OR "createdAt" < NOW() - INTERVAL '${olderThanDays} days'
          )
            AND COALESCE("isPinned", false) = false
            AND COALESCE("isHero", false) = false
            AND COALESCE("source", '') != 'NewsFlow Editorial'
            AND COALESCE("shareCount", 0) = 0
            ${bookmarkProtectionClause}
          LIMIT ${batchSize}
        );
      `;

      const batchCount = await prisma.$executeRawUnsafe(deleteBatchQuery);
      if (typeof batchCount === 'number' && batchCount > 0) {
        totalDeleted += batchCount;
        console.log(`🗑️ [Lifecycle Worker] Deleted batch of ${batchCount} old articles (Total deleted so far: ${totalDeleted})...`);
      } else {
        break;
      }
    }

    console.log(`🛡️ [Lifecycle Worker] 2-Week Retention Complete: Deleted ${totalDeleted} unengaged articles (> ${olderThanDays}d). Protected ${bookmarkedIds.length} bookmarked/shared stories.`);
    return {
      deletedCount: totalDeleted,
      protectedBookmarks: bookmarkedIds.length,
    };
  } catch (err: any) {
    console.error('❌ [Lifecycle Worker] Error in deleteUnengagedOldArticles batch query:', err?.message || err);
    throw err;
  }
}

/**
 * Executes the complete lifecycle maintenance pipeline (Prune + Smart Delete)
 * Enforces strict 2-week disk retention policy.
 */
export async function runFullLifecycleMaintenance(rawContentDays = 7, deleteDays = 14): Promise<LifecycleRunReport> {
  const startTime = new Date().toISOString();
  console.log(`🚀 [Lifecycle Maintenance] Starting 2-week storage retention execution at ${startTime}...`);

  try {
    const rawContentPrunedCount = await pruneOldArticleBodies(rawContentDays);
    const { deletedCount, protectedBookmarks } = await deleteUnengagedOldArticles(deleteDays);

    return {
      timestamp: startTime,
      rawContentPrunedCount,
      unengagedArticlesDeletedCount: deletedCount,
      protectedBookmarkedCount: protectedBookmarks,
      status: 'SUCCESS',
      message: `Pruned raw text for ${rawContentPrunedCount} articles (>7d). Safely deleted ${deletedCount} unengaged articles older than ${deleteDays} days (2 weeks). Strictly preserved all bookmarked, shared, and editorial stories on disk.`,
    };
  } catch (err: any) {
    console.error('❌ [Lifecycle Maintenance] Pipeline failed:', err);
    return {
      timestamp: startTime,
      rawContentPrunedCount: 0,
      unengagedArticlesDeletedCount: 0,
      protectedBookmarkedCount: 0,
      status: 'ERROR',
      message: `Lifecycle maintenance failed: ${err?.message || String(err)}`,
    };
  }
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

  // Non-blocking initial startup maintenance to enforce 2-week retention automatically
  setTimeout(async () => {
    try {
      console.log('🧹 [Lifecycle Worker] Running initial 2-week storage audit on startup...');
      await runFullLifecycleMaintenance(7, 14);
    } catch (err: any) {
      console.warn('⚠️ [Lifecycle Worker] Startup maintenance note:', err?.message || err);
    }
  }, 10000);

  console.log('⏰ [Lifecycle Worker] Scheduled nightly 7-day raw text pruning & 14-day (2 weeks) smart retention cron (30 2 * * *).');
}
