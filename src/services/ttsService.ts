import * as crypto from 'crypto';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { synthesizeSpeech, WordBoundary, TTSJobRequest, TTSJobResponse } from '../workers/ttsWorker.js';

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
     * Auto-detect regional Indian script from text characters
     */
    public static detectLanguageFromText(text: string): { lang: string; voice: string } {
        if (/[\u0900-\u097F]/.test(text)) return { lang: 'hi', voice: 'hi-IN-SwaraNeural' };
        if (/[\u0B80-\u0BFF]/.test(text)) return { lang: 'ta', voice: 'ta-IN-PallaviNeural' };
        if (/[\u0C00-\u0C7F]/.test(text)) return { lang: 'te', voice: 'te-IN-ShrutiNeural' };
        if (/[\u0980-\u09FF]/.test(text)) return { lang: 'bn', voice: 'bn-IN-TanishaaNeural' };
        if (/[\u0A80-\u0AFF]/.test(text)) return { lang: 'gu', voice: 'gu-IN-DhwaniNeural' };
        if (/[\u0C80-\u0CFF]/.test(text)) return { lang: 'kn', voice: 'kn-IN-SapnaNeural' };
        if (/[\u0D00-\u0D7F]/.test(text)) return { lang: 'ml', voice: 'ml-IN-SobhanaNeural' };
        return { lang: 'en', voice: 'en-IN-NeerjaNeural' };
    }

    /**
     * Map language code to corresponding regional native Edge-TTS neural voice
     */
    public static getVoiceForLanguage(lang: string = 'en', gender: 'female' | 'male' = 'female'): string {
        const langLower = (lang || 'en').toLowerCase().trim();
        switch (langLower) {
            case 'hi':
            case 'hindi':
                return gender === 'male' ? 'hi-IN-MadhurNeural' : 'hi-IN-SwaraNeural';
            case 'ta':
            case 'tamil':
                return gender === 'male' ? 'ta-IN-ValluvarNeural' : 'ta-IN-PallaviNeural';
            case 'te':
            case 'telugu':
                return gender === 'male' ? 'te-IN-MohanNeural' : 'te-IN-ShrutiNeural';
            case 'mr':
            case 'marathi':
                return gender === 'male' ? 'mr-IN-ManoharNeural' : 'mr-IN-AarohiNeural';
            case 'bn':
            case 'bengali':
                return gender === 'male' ? 'bn-IN-BashkarNeural' : 'bn-IN-TanishaaNeural';
            case 'gu':
            case 'gujarati':
                return gender === 'male' ? 'gu-IN-NiranjanNeural' : 'gu-IN-DhwaniNeural';
            case 'kn':
            case 'kannada':
                return gender === 'male' ? 'kn-IN-GaganNeural' : 'kn-IN-SapnaNeural';
            case 'ml':
            case 'malayalam':
                return gender === 'male' ? 'ml-IN-MidhunNeural' : 'ml-IN-SobhanaNeural';
            default:
                return gender === 'male' ? 'en-IN-PrabhatNeural' : 'en-IN-NeerjaNeural';
        }
    }

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

        // 2. Synthesize using Direct High-Performance Async Engine
        let result: { audioBase64: string; durationMs: number; wordBoundaries: WordBoundary[] };

        try {
            result = await synthesizeSpeech(text, voice, rate, pitch);
        } catch (err: any) {
            console.error('[TTSService] Speech synthesis error:', err?.message || err);
            throw err;
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
