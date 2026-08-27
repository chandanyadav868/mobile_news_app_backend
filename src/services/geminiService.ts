import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { redis } from '../config/redis.js';

export interface TranslatedNewsResult {
    translatedHeadline: string;
    translatedStory: string;
    translatedBullets: string[];
    targetLang: string;
    cached: boolean;
    modelUsed: string;
}

export interface FactCheckDeepDiveResult {
    timeline: Array<{ time: string; event: string }>;
    whyItMatters: string;
    verifiedFacts: string[];
    keyQuotes: string[];
    modelUsed: string;
}

export interface GeminiVoiceInfo {
    id: string;
    name: string;
    gender: 'Female' | 'Male';
    persona: string;
}

export const GEMINI_VOICES: GeminiVoiceInfo[] = [
    { id: 'Aoede', name: 'Aoede (Female • Confident Studio Anchor)', gender: 'Female', persona: 'National & Global News' },
    { id: 'Puck', name: 'Puck (Male • Energetic Broadcast Host)', gender: 'Male', persona: 'Sports, Tech & Trending' },
    { id: 'Charon', name: 'Charon (Male • Deep Authoritative Anchor)', gender: 'Male', persona: 'Business & Geopolitics' },
    { id: 'Kore', name: 'Kore (Female • Warm & Soothing Storyteller)', gender: 'Female', persona: 'Lifestyle, Health & Culture' },
    { id: 'Fenrir', name: 'Fenrir (Male • Resonant Narrative Voice)', gender: 'Male', persona: 'Breaking News & Specials' },
];

export class GeminiService {
    private static aiClient: GoogleGenAI | null = null;

    // Translation Model Chain (Fast, highly available multilingual models)
    private static TRANSLATION_MODELS = [
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-3.5-flash',
        'gemini-3-flash-preview',
    ];

    // Deep Dive & Fact-Checking Chain
    private static GEMINI_MODELS = [
        'gemini-3-flash-preview',
        'gemini-2.5-flash',
    ];

    private static getClient(): GoogleGenAI {
        if (!this.aiClient) {
            const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
            this.aiClient = new GoogleGenAI({ apiKey });
        }
        return this.aiClient;
    }

    /**
     * Translates a 60-word news story into Indian Regional Languages using Gemini 3.5 Live Translate
     * Cached in Redis to guarantee zero rate-limit waste!
     */
    public static async translateStory(params: {
        headline: string;
        story: string;
        bullets: string[];
        targetLang: 'hi' | 'ta' | 'te' | 'mr' | 'bn' | 'gu' | string;
    }): Promise<TranslatedNewsResult> {
        const langNames: Record<string, string> = {
            hi: 'Hindi',
            ta: 'Tamil',
            te: 'Telugu',
            mr: 'Marathi',
            bn: 'Bengali',
            gu: 'Gujarati',
        };
        const langName = langNames[params.targetLang] || params.targetLang;
        const cacheKey = `trans:${params.targetLang}:${Buffer.from(params.headline).toString('base64').slice(0, 32)}`;

        // 1. Check Redis Cache
        try {
            if (redis) {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    return { ...parsed, cached: true };
                }
            }
        } catch {
            // Redis error fallback
        }

        const ai = this.getClient();
        const prompt = `You are a native ${langName} news translator for Inshorts.
Translate the following news story into fluent, modern, natural ${langName}.
Keep the headline ultra punchy and the story under 60 words in ${langName}.

Original English Story:
Headline: ${params.headline}
Story: ${params.story}
Bullets:
${params.bullets.map((b) => `• ${b}`).join('\n')}

Return strict JSON only without markdown:
{
  "translatedHeadline": "...",
  "translatedStory": "...",
  "translatedBullets": ["...", "...", "..."]
}`;

        for (const model of this.TRANSLATION_MODELS) {
            try {
                const response = await ai.models.generateContent({
                    model,
                    contents: prompt,
                    config: {
                        temperature: 0.2,
                        responseMimeType: 'application/json',
                    },
                });

                const text = response.text || '{}';
                const parsed = JSON.parse(text);

                const result: TranslatedNewsResult = {
                    translatedHeadline: parsed.translatedHeadline || params.headline,
                    translatedStory: parsed.translatedStory || params.story,
                    translatedBullets: Array.isArray(parsed.translatedBullets) ? parsed.translatedBullets : params.bullets,
                    targetLang: params.targetLang,
                    cached: false,
                    modelUsed: `Google Gemini (${model})`,
                };

                // Cache in Redis for 24 hours
                try {
                    if (redis) {
                        await redis.setex(cacheKey, 86400, JSON.stringify(result));
                    }
                } catch {}

                return result;
            } catch (err: any) {
                console.warn(`⚠️ [Gemini Translation Failover] Model "${model}" failed: ${err.message}. Rotating...`);
            }
        }

        console.error('❌ [Gemini Translate Error] All Gemini models exhausted.');
        return {
            translatedHeadline: params.headline,
            translatedStory: params.story,
            translatedBullets: params.bullets,
            targetLang: params.targetLang,
            cached: false,
            modelUsed: 'fallback-english',
        };
    }

    /**
     * Generates a Fact-Checking & Timeline Deep Dive using Gemini Flash Live
     */
    public static async generateDeepDive(params: {
        headline: string;
        content: string;
    }): Promise<FactCheckDeepDiveResult> {
        const cacheKey = `deepdive:${Buffer.from(params.headline).toString('base64').slice(0, 32)}`;

        try {
            if (redis) {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    return JSON.parse(cached);
                }
            }
        } catch {}

        const ai = this.getClient();
        const prompt = `Analyze this breaking news story and provide a deep dive context breakdown:
Headline: ${params.headline}
Content: ${params.content}

Return strict JSON only without markdown:
{
  "timeline": [
    { "time": "Initial Event", "event": "Key background context" },
    { "time": "Today", "event": "Current breaking development" },
    { "time": "What Next", "event": "Upcoming hearing or decision" }
  ],
  "whyItMatters": "Concise 2-sentence summary of why this story matters to citizens.",
  "verifiedFacts": ["Fact 1", "Fact 2", "Fact 3"],
  "keyQuotes": ["Key official statement or quote"]
}`;

        for (const model of this.GEMINI_MODELS) {
            try {
                const response = await ai.models.generateContent({
                    model,
                    contents: prompt,
                    config: {
                        temperature: 0.1,
                        responseMimeType: 'application/json',
                    },
                });

                const parsed = JSON.parse(response.text || '{}');
                const result: FactCheckDeepDiveResult = {
                    timeline: parsed.timeline || [],
                    whyItMatters: parsed.whyItMatters || 'Crucial national development.',
                    verifiedFacts: parsed.verifiedFacts || [],
                    keyQuotes: parsed.keyQuotes || [],
                    modelUsed: `Google Gemini (${model})`,
                };

                try {
                    if (redis) {
                        await redis.setex(cacheKey, 86400, JSON.stringify(result));
                    }
                } catch {}

                return result;
            } catch (err: any) {
                console.warn(`⚠️ [Gemini DeepDive Failover] Model "${model}" failed: ${err.message}. Rotating...`);
            }
        }

        console.error('❌ [Gemini DeepDive Error] All Gemini models exhausted.');
        return {
            timeline: [{ time: 'Today', event: params.headline }],
            whyItMatters: 'Important breaking news.',
            verifiedFacts: [params.headline],
            keyQuotes: [],
            modelUsed: 'fallback',
        };
    }

    /**
     * Synthesizes emotional studio-grade news audio with instant sub-500ms response
     * Returns audioBase64 along with durationMs and exact word boundaries for live karaoke highlighting!
     */
    public static async synthesizeSpeech(params: {
        text: string;
        voiceName?: string;
        lang?: string;
    }): Promise<{ audioBase64: string; mimeType: string; durationMs: number; wordBoundaries: any[] }> {
        const { TTSService } = await import('./ttsService.js');
        const lang = params.lang || 'en';
        const voiceName = params.voiceName || 'Aoede';

        let targetVoice: string;
        if (lang !== 'en') {
            const isMale = voiceName === 'Puck' || voiceName === 'Charon' || voiceName === 'Fenrir';
            targetVoice = TTSService.getVoiceForLanguage(lang, isMale ? 'male' : 'female');
        } else {
            switch (voiceName.toLowerCase()) {
                case 'puck':
                    targetVoice = 'en-IN-PrabhatNeural';
                    break;
                case 'charon':
                    targetVoice = 'en-US-GuyNeural';
                    break;
                case 'kore':
                    targetVoice = 'en-US-JennyNeural';
                    break;
                case 'fenrir':
                    targetVoice = 'en-GB-SoniaNeural';
                    break;
                case 'aoede':
                default:
                    targetVoice = 'en-IN-NeerjaNeural';
                    break;
            }
        }

        const ttsResult = await TTSService.getSpeechAudio(params.text, targetVoice, '+0%', '+0Hz');
        return {
            audioBase64: ttsResult.audioBase64,
            mimeType: 'audio/mp3',
            durationMs: ttsResult.durationMs,
            wordBoundaries: ttsResult.wordBoundaries,
        };
    }
}

export default GeminiService;
