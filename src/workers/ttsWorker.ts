import { parentPort, isMainThread } from 'worker_threads';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import * as crypto from 'crypto';

export interface TTSJobRequest {
    jobId: string;
    text: string;
    voice?: string; // e.g. "en-IN-NeerjaNeural", "en-IN-PrabhatNeural", "en-US-JennyNeural"
    rate?: string;  // e.g. "+0%"
    pitch?: string; // e.g. "+0Hz"
}

export interface WordBoundary {
    word: string;
    start: number; // milliseconds
    end: number;   // milliseconds
}

export interface TTSJobResponse {
    jobId: string;
    success: boolean;
    audioBase64?: string;
    durationMs?: number;
    wordBoundaries?: WordBoundary[];
    error?: string;
}

/**
 * Synthesize speech buffer and word boundaries using Microsoft Edge Neural Voice
 */
export async function synthesizeSpeech(
    text: string,
    voice: string = 'en-IN-NeerjaNeural',
    rate: string = '+0%',
    pitch: string = '+0Hz'
): Promise<{ audioBase64: string; durationMs: number; wordBoundaries: WordBoundary[] }> {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
        wordBoundaryEnabled: true,
        sentenceBoundaryEnabled: true,
    });

    // Clean and normalize text, limiting oversized text chunks to 1200 characters to prevent Edge-TTS socket disconnect
    let cleanText = text
        .replace(/<[^>]*>/g, ' ')
        .replace(/[^\x20-\x7E\u0900-\u097F\u00A0-\u024F.,!?'"-\s]/g, ' ')
        .replace(/&/g, ' and ')
        .replace(/\s+/g, ' ')
        .trim();

    if (cleanText.length > 1200) {
        cleanText = cleanText.slice(0, 1200);
    }

    const words = cleanText.split(/\s+/).filter(Boolean);

    // Convert to streaming chunks
    const stream = tts.toStream(cleanText, {
        rate,
        pitch,
    });

    const chunks: Buffer[] = [];
    const nativeBoundaries: WordBoundary[] = [];

    if (stream.metadataStream) {
        stream.metadataStream.on('data', (metaChunk: Buffer) => {
            try {
                const str = metaChunk.toString();
                // Metadata can arrive with JSON strings or multiple records
                const lines = str.split(/\r?\n/).filter(Boolean);
                for (const line of lines) {
                    try {
                        const item = JSON.parse(line);
                        const records = Array.isArray(item) ? item : [item];
                        for (const r of records) {
                            if (r.Type === 'WordBoundary' && r.Data) {
                                const offsetMs = Math.round((r.Data.Offset || 0) / 10000);
                                const durMs = Math.max(120, Math.round((r.Data.Duration || 0) / 10000));
                                const wordText = r.Data.text?.Text || r.Data.Text || '';
                                if (wordText) {
                                    nativeBoundaries.push({
                                        word: wordText,
                                        start: offsetMs,
                                        end: offsetMs + durMs,
                                    });
                                }
                            }
                        }
                    } catch (e) {}
                }
            } catch (e) {}
        });
        stream.metadataStream.on('error', (err: any) => {
            console.warn('[TTSWorker] Metadata stream notice:', err?.message || err);
        });
    }

    await new Promise<void>((resolve, reject) => {
        let isResolved = false;
        let inactivityTimer: any = null;

        const finish = () => {
            if (!isResolved) {
                isResolved = true;
                if (inactivityTimer) clearTimeout(inactivityTimer);
                resolve();
            }
        };

        const resetInactivity = () => {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                if (chunks.length > 0) {
                    finish();
                }
            }, 600);
        };

        stream.audioStream.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
            resetInactivity();
        });

        stream.audioStream.on('end', () => finish());
        stream.audioStream.on('close', () => finish());
        stream.audioStream.on('finish', () => finish());

        stream.audioStream.on('error', (err: any) => {
            if (chunks.length > 0 || (err?.message && err.message.includes('Stream closed'))) {
                finish();
            } else {
                if (!isResolved) {
                    isResolved = true;
                    if (inactivityTimer) clearTimeout(inactivityTimer);
                    reject(err);
                }
            }
        });

        // Hard safety timeout: If chunks have arrived, resolve cleanly in 4s max
        setTimeout(() => {
            if (chunks.length > 0) finish();
            else if (!isResolved) {
                isResolved = true;
                reject(new Error('TTS audio stream timed out'));
            }
        }, 4000);
    });

    const audioBuffer = Buffer.concat(chunks);
    const audioBase64 = audioBuffer.toString('base64');

    // Approximate duration from MP3 length (48 kbps = 6,000 bytes/sec)
    const estimatedDurationMs = Math.max(1000, Math.round((audioBuffer.length / 6000) * 1000));

    // Use native Microsoft Neural word boundaries if captured, otherwise use smart weighted fallback
    let finalWordBoundaries: WordBoundary[] = [];
    if (nativeBoundaries.length >= Math.floor(words.length * 0.7)) {
        finalWordBoundaries = nativeBoundaries;
    } else {
        // High-precision pause-aware word boundaries
        let currentMs = 60;
        const totalChars = cleanText.length || 1;
        const netDuration = estimatedDurationMs - 120;
        const timePerChar = netDuration / totalChars;

        finalWordBoundaries = words.map((word) => {
            const hasPause = /[.,!?;:]$/.test(word);
            const wordDuration = Math.max(140, Math.round(word.length * timePerChar));
            const boundary: WordBoundary = {
                word,
                start: currentMs,
                end: currentMs + wordDuration,
            };
            currentMs += wordDuration + (hasPause ? 320 : 35);
            return boundary;
        });
    }

    return {
        audioBase64,
        durationMs: estimatedDurationMs,
        wordBoundaries: finalWordBoundaries,
    };
}

// Worker Thread Handler
if (!isMainThread && parentPort) {
    parentPort.on('message', async (request: TTSJobRequest) => {
        try {
            const result = await synthesizeSpeech(
                request.text,
                request.voice || 'en-IN-NeerjaNeural',
                request.rate || '+0%',
                request.pitch || '+0Hz'
            );

            const response: TTSJobResponse = {
                jobId: request.jobId,
                success: true,
                audioBase64: result.audioBase64,
                durationMs: result.durationMs,
                wordBoundaries: result.wordBoundaries,
            };

            parentPort!.postMessage(response);
        } catch (err: any) {
            const response: TTSJobResponse = {
                jobId: request.jobId,
                success: false,
                error: err.message || 'Speech synthesis failed',
            };
            parentPort!.postMessage(response);
        }
    });
}
