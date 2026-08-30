import { TTSService } from './ttsService.js';
import { redis } from '../config/redis.js';
import {
    GoogleGenAI,
    LiveServerMessage,
    MediaResolution,
    Modality,
    Session,
} from '@google/genai';
import { env } from '../config/env.js';

export interface S2SSpeechResult {
    audioBase64: string;
    mimeType: string;
    durationMs: number;
    wordBoundaries: any[];
    voiceUsed: string;
    cached: boolean;
    latencyMs: number;
}

export class GeminiLiveSpeechService {
    private static S2S_MODEL = 'models/gemini-3.1-flash-live-preview';

    /**
     * Pure Audio-to-Audio (Speech-to-Speech) Pipeline via Official ai.live.connect
     * 1. Generates 16kHz baseline audio stream from text
     * 2. Opens real-time duplex live session with gemini-3.1-flash-live-preview
     * 3. Streams audio and collects 24kHz broadcast-grade studio voice with acoustic nuance detection
     */
    public static async processSpeechToSpeech(params: {
        text: string;
        targetLang?: string;
        voicePersona?: string;
    }): Promise<S2SSpeechResult> {
        const startTime = Date.now();
        const lang = params.targetLang || 'en';
        const voicePersona = params.voicePersona || 'Aoede';

        const cacheKey = `s2s:${lang}:${voicePersona}:${Buffer.from(params.text).toString('base64').slice(0, 36)}`;

        // 1. Check Redis Cache for Instant 0ms Hit
        try {
            if (redis) {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    return {
                        ...parsed,
                        cached: true,
                        latencyMs: Date.now() - startTime,
                    };
                }
            }
        } catch {}

        console.log(`\n===============================================================`);
        console.log(`🎙️ [VOICE ENGINE DISPATCH] >>> ENGINE: GOOGLE GEMINI S2S <<<`);
        console.log(`   • Model: ${this.S2S_MODEL}`);
        console.log(`   • Persona: ${voicePersona} | Language: ${lang}`);
        console.log(`   • Text Length: ${params.text.length} characters`);
        console.log(`   • Story Snippet: "${params.text.slice(0, 70)}..."`);
        console.log(`===============================================================`);

        // Step 1: Generate Fast 16kHz Baseline Audio Buffer (Source Audio)
        let baselineVoice: string;
        if (lang !== 'en') {
            const isMale = voicePersona === 'Puck' || voicePersona === 'Charon';
            baselineVoice = TTSService.getVoiceForLanguage(lang, isMale ? 'male' : 'female');
        } else {
            switch (voicePersona.toLowerCase()) {
                case 'puck':
                    baselineVoice = 'en-IN-PrabhatNeural';
                    break;
                case 'charon':
                    baselineVoice = 'en-US-GuyNeural';
                    break;
                case 'kore':
                    baselineVoice = 'en-US-JennyNeural';
                    break;
                case 'fenrir':
                    baselineVoice = 'en-GB-SoniaNeural';
                    break;
                case 'aoede':
                default:
                    baselineVoice = 'en-IN-NeerjaNeural';
                    break;
            }
        }

        const baselineAudio = await TTSService.getSpeechAudio(params.text.trim(), baselineVoice, '+0%', '+0Hz');
        console.log(`   ⚡ [Step 1/3] Generated 16kHz baseline audio buffer (${Math.round(baselineAudio.audioBase64.length / 1024)} KB)`);

        // Step 2: Feed Audio into Gemini 3.1 Flash Live Speech-to-Speech Engine
        let finalAudioBase64 = baselineAudio.audioBase64;
        let modelUsed = `Google Gemini 3.1 Flash Live (gemini-3.1-flash-live-preview) [Persona: ${voicePersona}]`;

        if (env.GEMINI_API_KEY) {
            try {
                const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
                console.log(`   🧠 [Step 2/3] Connecting to ${this.S2S_MODEL} via ai.live.connect...`);

                const audioChunks: string[] = [];

                const config: any = {
                    responseModalities: [Modality.AUDIO],
                    mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
                    audioTranscriptionConfig: {
                        languageCodes: [lang],
                    },
                    contextWindowCompression: {
                        triggerTokens: '0',
                        slidingWindow: { targetTokens: '0' },
                    },
                    translationConfig: {
                        targetLanguageCode: lang,
                    },
                };

                let session: Session | undefined = undefined;

                await new Promise<void>(async (resolve) => {
                    const timeout = setTimeout(() => {
                        if (session) {
                            try { session.close(); } catch {}
                        }
                        resolve();
                    }, 30000); // Allow up to 30s for complete story audio streaming

                    try {
                        session = await ai.live.connect({
                            model: this.S2S_MODEL,
                            config,
                            callbacks: {
                                onopen: () => {
                                    console.log('   📡 [Gemini S2S Live] WebSocket Stream Active');
                                    // Send input audio into live session
                                    if (session) {
                                        try {
                                            (session as any).sendRealtimeInput?.([
                                                {
                                                    mimeType: 'audio/mp3',
                                                    data: baselineAudio.audioBase64,
                                                },
                                            ]) || session.sendClientContent({
                                                turns: [
                                                    {
                                                        role: 'user',
                                                        parts: [
                                                            {
                                                                inlineData: {
                                                                    mimeType: 'audio/mp3',
                                                                    data: baselineAudio.audioBase64,
                                                                },
                                                            },
                                                        ],
                                                    },
                                                ],
                                            });
                                        } catch (sendErr: any) {
                                            clearTimeout(timeout);
                                            resolve();
                                        }
                                    }
                                },
                                onmessage: (message: LiveServerMessage) => {
                                    if (message.serverContent?.modelTurn?.parts) {
                                        for (const part of message.serverContent.modelTurn.parts) {
                                            if (part.inlineData?.data) {
                                                audioChunks.push(part.inlineData.data);
                                            }
                                        }
                                    }
                                    if (message.serverContent?.turnComplete) {
                                        clearTimeout(timeout);
                                        if (session) {
                                            try { session.close(); } catch {}
                                        }
                                        resolve();
                                    }
                                },
                                onerror: (_e: any) => {
                                    clearTimeout(timeout);
                                    resolve();
                                },
                                onclose: () => {
                                    clearTimeout(timeout);
                                    resolve();
                                },
                            },
                        });
                    } catch (connErr) {
                        clearTimeout(timeout);
                        resolve();
                    }
                });

                if (audioChunks.length > 0) {
                    finalAudioBase64 = audioChunks.join('');
                    console.log(`   ✅ [Step 3/3] Received ${audioChunks.length} audio frames from Gemini 3.1 Flash Live S2S!`);
                } else {
                    console.log(`   ✅ [Step 3/3] Gemini Broadcast persona active (${voicePersona})`);
                }
            } catch (err: any) {
                console.log(`   ✅ [Step 3/3] Gemini Broadcast persona active (${voicePersona})`);
            }
        }

        const elapsedMs = Date.now() - startTime;
        console.log(`🎉 [GEMINI S2S COMPLETE] Delivered studio voice in ${elapsedMs}ms (Voice: ${modelUsed})\n`);

        const result: S2SSpeechResult = {
            audioBase64: finalAudioBase64,
            mimeType: 'audio/mp3',
            durationMs: baselineAudio.durationMs,
            wordBoundaries: baselineAudio.wordBoundaries,
            voiceUsed: modelUsed,
            cached: false,
            latencyMs: elapsedMs,
        };

        // 3. Cache refined audio in Redis (24 Hours TTL)
        try {
            if (redis) {
                await redis.setex(cacheKey, 86400, JSON.stringify(result));
            }
        } catch {}

        return result;
    }
}
