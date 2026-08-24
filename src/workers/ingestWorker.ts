import cron from 'node-cron';
import { env } from '../config/env.js';
import { ingestAllFeeds } from '../services/rssFetcher.js';

let isJobRunning = false;

export function initIngestWorker(): void {
  console.log(`⏰ [Worker] Scheduling RSS Ingestion cron job (${env.INGEST_CRON_SCHEDULE})...`);

  // Scheduled recurring job
  cron.schedule(env.INGEST_CRON_SCHEDULE, async () => {
    if (isJobRunning) {
      console.log('⏳ [Worker] Previous ingestion is still in progress, skipping this run.');
      return;
    }

    isJobRunning = true;
    try {
      await ingestAllFeeds();
    } catch (e: any) {
      console.error('❌ [Worker] Ingestion job failed:', e.message);
    } finally {
      isJobRunning = false;
    }
  });

  // Initial startup sync (delayed 2s to allow DB connection to settle)
  setTimeout(async () => {
    console.log('🚀 [Worker] Triggering initial startup RSS ingestion...');
    try {
      await ingestAllFeeds();
    } catch (e: any) {
      console.warn('⚠️ [Worker] Initial ingestion failed (check if database is running):', e.message);
    }
  }, 2000);
}
