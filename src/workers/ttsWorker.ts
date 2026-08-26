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
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    // Clean and normalize text, removing unprintable symbols, XML brackets, and emojis
    const cleanText = text
        .replace(/<[^>]*>/g, ' ')
        .replace(/[^\x20-\x7E\u0900-\u097F\u00A0-\u024F.,!?'"-\s]/g, ' ')
        .replace(/&/g, ' and ')
        .replace(/\s+/g, ' ')
        .trim();

    const words = cleanText.split(/\s+/).filter(Boolean);

    // Convert to streaming chunks
    const stream = tts.toStream(cleanText, {
        rate,
        pitch,
    });

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
        stream.audioStream.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
        });
        stream.audioStream.on('end', () => resolve());
        stream.audioStream.on('error', (err: any) => {
            if (chunks.length > 0) {
                console.warn('[TTSWorker] Stream ended with notice, recovered audio chunks:', chunks.length);
                resolve();
            } else {
                reject(err);
            }
        });
    });

    const audioBuffer = Buffer.concat(chunks);
    const audioBase64 = audioBuffer.toString('base64');

    // Approximate duration from MP3 length (48 kbps = 6,000 bytes/sec)
    const estimatedDurationMs = Math.max(1000, Math.round((audioBuffer.length / 6000) * 1000));

    // Calculate realistic word boundaries across the audio timeline
    let currentMs = 100;
    const totalChars = cleanText.length || 1;
    const timePerChar = (estimatedDurationMs - 200) / totalChars;

    const wordBoundaries: WordBoundary[] = words.map((word) => {
        const wordDuration = Math.max(150, Math.round(word.length * timePerChar));
        const boundary: WordBoundary = {
            word,
            start: currentMs,
            end: currentMs + wordDuration,
        };
        currentMs += wordDuration + 40; // 40ms pause between words
        return boundary;
    });

    return {
        audioBase64,
        durationMs: estimatedDurationMs,
        wordBoundaries,
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
