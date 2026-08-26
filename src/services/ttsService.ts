import * as crypto from 'crypto';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { synthesizeSpeech, WordBoundary, TTSJobRequest, TTSJobResponse } from '../workers/ttsWorker';

interface CachedAudioItem {
    audioBase64: string;
    durationMs: number;
    wordBoundaries: WordBoundary[];
    createdAt: number;
}

// In-Memory LRU Cache (stores up to 150 synthesized breaking stories)
const audioMemoryCache = new Map<string, CachedAudioItem>();
const MAX_CACHE_ITEMS = 150;
const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 Hours TTL

export class TTSService {
    /**
     * Compute hash key for audio caching
     */
    public static computeHash(text: string, voice: string = 'en-IN-NeerjaNeural'): string {
        return crypto.createHash('md5').update(`${voice}:${text.trim().toLowerCase()}`).digest('hex');
    }

    /**
     * Periodic sweep to purge expired cache items and keep RAM minimal
     */
    private static sweepExpiredCache(): void {
        const now = Date.now();
        for (const [key, item] of audioMemoryCache.entries()) {
            if (now - item.createdAt > CACHE_TTL_MS) {
                audioMemoryCache.delete(key);
            }
        }
    }

    /**
     * Synthesize speech with caching and non-blocking worker thread offload
     */
    public static async getSpeechAudio(
        text: string,
        voice: string = 'en-IN-NeerjaNeural',
        rate: string = '+0%',
        pitch: string = '+0Hz'
    ): Promise<{ audioBase64: string; durationMs: number; wordBoundaries: WordBoundary[]; cached: boolean }> {
        this.sweepExpiredCache();
        const cacheKey = this.computeHash(text, voice);

        // 1. Check Memory Cache (Sub-1ms response)
        const cached = audioMemoryCache.get(cacheKey);
        if (cached && (Date.now() - cached.createdAt <= CACHE_TTL_MS)) {
            return {
                audioBase64: cached.audioBase64,
                durationMs: cached.durationMs,
                wordBoundaries: cached.wordBoundaries,
                cached: true,
            };
        }

        // 2. Synthesize using Worker Thread / Direct async fallback
        let result: { audioBase64: string; durationMs: number; wordBoundaries: WordBoundary[] };

        try {
            // Attempt Worker Thread dispatch
            result = await this.runInWorkerThread({
                jobId: cacheKey,
                text,
                voice,
                rate,
                pitch,
            });
        } catch (workerErr) {
            console.warn('[TTSService] Worker thread bypassed, running directly in async fallback:', (workerErr as any)?.message || workerErr);
            result = await synthesizeSpeech(text, voice, rate, pitch);
        }

        // 3. Store in LRU Cache
        if (audioMemoryCache.size >= MAX_CACHE_ITEMS) {
            const firstKey = audioMemoryCache.keys().next().value;
            if (firstKey) audioMemoryCache.delete(firstKey);
        }

        audioMemoryCache.set(cacheKey, {
            audioBase64: result.audioBase64,
            durationMs: result.durationMs,
            wordBoundaries: result.wordBoundaries,
            createdAt: Date.now(),
        });

        return {
            ...result,
            cached: false,
        };
    }

    /**
     * Dispatch to worker thread off the main event loop
     */
    private static runInWorkerThread(job: TTSJobRequest): Promise<{ audioBase64: string; durationMs: number; wordBoundaries: WordBoundary[] }> {
        return new Promise((resolve, reject) => {
            const isTsNode = __filename.endsWith('.ts');
            const workerPath = isTsNode
                ? path.resolve(__dirname, '../workers/ttsWorker.ts')
                : path.resolve(__dirname, '../workers/ttsWorker.js');

            try {
                const worker = new Worker(workerPath, {
                    execArgv: isTsNode ? ['-r', 'tsx'] : [],
                });

                const timeout = setTimeout(() => {
                    worker.terminate();
                    reject(new Error('TTS Worker execution timeout'));
                }, 8000);

                worker.on('message', (response: TTSJobResponse) => {
                    clearTimeout(timeout);
                    worker.terminate();
                    if (response.success && response.audioBase64) {
                        resolve({
                            audioBase64: response.audioBase64,
                            durationMs: response.durationMs || 3000,
                            wordBoundaries: response.wordBoundaries || [],
                        });
                    } else {
                        reject(new Error(response.error || 'TTS Worker failed'));
                    }
                });

                worker.on('error', (err) => {
                    clearTimeout(timeout);
                    worker.terminate();
                    reject(err);
                });

                worker.postMessage(job);
            } catch (e) {
                reject(e);
            }
        });
    }
}
