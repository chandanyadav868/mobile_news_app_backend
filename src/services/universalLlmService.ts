import { env } from '../config/env.js';
import TelemetryService from './telemetryService.js';

export interface SummarizedNewsResult {
    headline: string;
    crispyStory: string;
    bulletPoints: string[];
    modelUsed: string;
    providerUsed: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
    success: boolean;
}

export interface LlmProviderConfig {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    models: string[];
    defaultHeaders?: Record<string, string>;
}

export class UniversalLlmService {
    // Multi-Provider Registry in Priority Failover Order (Tier 1: Unlimited Google Gemini)
    private static getProviders(): LlmProviderConfig[] {
        const providers: LlmProviderConfig[] = [];

        // 1. Google Gemini (Tier 1: High Quality & High Speed)
        if (env.GEMINI_API_KEY) {
            providers.push({
                id: 'gemini',
                name: 'Google Gemini',
                baseUrl: 'https://generativelanguage.googleapis.com',
                apiKey: env.GEMINI_API_KEY,
                models: [
                    'gemini-3-flash-preview',
                    'gemini-2.5-flash',
                    'gemini-3.5-flash',
                ],
            });
        }

        // 2. Mistral AI (Tier 2: Fast European Serverless Engine)
        if (env.MISTRAL_API_KEY) {
            providers.push({
                id: 'mistral',
                name: 'Mistral AI',
                baseUrl: env.MISTRAL_BASE_URL.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, ''),
                apiKey: env.MISTRAL_API_KEY,
                models: [
                    'mistral-small-latest',
                    'open-mistral-nemo',
                    'mistral-large-latest',
                ],
            });
        }

        // 3. Cloudflare Workers AI (Tier 3: Global Edge Tier)
        if (env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID) {
            providers.push({
                id: 'cloudflare',
                name: 'Cloudflare Workers AI',
                baseUrl: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
                apiKey: env.CLOUDFLARE_API_TOKEN,
                models: [
                    '@cf/meta/llama-3.3-70b-instruct',
                    '@cf/qwen/qwen2.5-7b-instruct',
                ],
            });
        }

        // 4. Groq Cloud (Tier 4: Ultra-Fast LPU Engine)
        if (env.GROQ_API_KEY) {
            providers.push({
                id: 'groq',
                name: 'Groq Cloud',
                baseUrl: 'https://api.groq.com/openai/v1',
                apiKey: env.GROQ_API_KEY,
                models: [
                    'llama-3.3-70b-versatile',
                    'llama-3.1-8b-instant',
                    'mixtral-8x7b-32768',
                    'gemma2-9b-it',
                    'qwen/qwen3.8-27b',
                    'qwen/qwen3.6-27b',
                ],
            });
        }

        return providers;
    }

    /**
     * Sanitizes raw text and caps to lead 220 words (saving 80% prompt tokens)
     */
    public static sanitizeRawText(rawText: string): string {
        if (!rawText) return '';
        const cleaned = rawText
            .replace(/<[^>]*>/g, ' ')
            .replace(/(published|updated|reported by|written by|follow us|subscribe|read more|click here|copyright|all rights reserved)[\s\S]{0,80}/gi, ' ')
            .replace(/http[s]?:\/\/\S+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const words = cleaned.split(' ');
        if (words.length > 220) {
            return words.slice(0, 220).join(' ') + '...';
        }
        return cleaned;
    }

    /**
     * Summarizes news with automatic multi-provider cross-failover hand-off
     * Supports exactOnly mode for Studio testing (returning raw provider outputs without fallback)
     */
    public static async summarizeNews(params: {
        title: string;
        content: string;
        category?: string;
        preferredProvider?: string;
        preferredModel?: string;
        exactOnly?: boolean;
    }): Promise<SummarizedNewsResult> {
        const cleanContent = this.sanitizeRawText(params.content);
        const cleanTitle = params.title.replace(/<[^>]*>/g, '').trim();

        const providers = this.getProviders();
        if (params.preferredProvider) {
            providers.sort((a, b) => (a.id === params.preferredProvider ? -1 : 1));
        }

        const systemPrompt = `You are a premier broadcast news anchor and audio journalist for NewsFlow.
Transform the raw news text into a dynamic, compelling, rich 110 to 140-word news story (2-3 paragraphs) designed to be read effortlessly and spoken aloud by an AI voice anchor.

BROADCAST VOCAL & EDITORIAL RULES:
1. CADENCE & TONE: Write with charismatic, energetic broadcast rhythm. Hook the listener in the first 5 words with active, immediate verbs.
2. NATURAL HUMAN PHRASING: Strictly avoid robotic phrasing like "In a recent development", "It is important to note", "As per reports", or "Furthermore". Use direct, lively, conversational journalism.
3. SPOKEN PHONETICS: Write exclusively in clean words and natural punctuation (commas and periods for breath pauses). Never include brackets, slashes, URLs, asterisks, or markdown symbols.
4. FULL STORY COVERAGE: Provide complete, engaging context across 110 to 140 words (2-3 paragraphs) explaining the core event, why it matters, key figures/quotes, and upcoming impact.
5. 3 CRISP BULLETS: Extract 3 distinct high-impact fact takeaways.

Return strict JSON only without markdown:
{"headline":"Ultra-punchy spoken headline (under 10 words)","story":"Dynamic, comprehensive 120-word broadcast story (2-3 paragraphs) with natural speech rhythm, full context, and emotional hook.","bullets":["Impact fact 1","Impact fact 2","Impact fact 3"]}`;

        const userPrompt = `Category: ${params.category || 'General'}
Headline: ${cleanTitle}

Text:
${cleanContent || cleanTitle}`;

        const jsonSchemaFormat = {
            type: 'json_schema',
            json_schema: {
                name: 'inshorts_story',
                schema: {
                    type: 'object',
                    properties: {
                        headline: { type: 'string', description: 'Punchy headline (max 10 words)' },
                        story: { type: 'string', description: 'Comprehensive 110-140 word news story across 2-3 paragraphs' },
                        bullets: { type: 'array', items: { type: 'string' }, description: '3 key takeaway bullets' },
                    },
                    required: ['headline', 'story', 'bullets'],
                    additionalProperties: false,
                },
                strict: true,
            },
        };

        let lastError: any = null;

        // Iterate through Provider Chain (Gemini -> Mistral -> Cloudflare -> Groq)
        for (const provider of providers) {
            let models = provider.models;
            if (params.preferredModel) {
                if (params.exactOnly) {
                    if (!provider.models.includes(params.preferredModel)) {
                        continue; // Skip providers that don't own this exact model
                    }
                    models = [params.preferredModel];
                } else if (provider.models.includes(params.preferredModel)) {
                    models = [params.preferredModel, ...provider.models.filter((m) => m !== params.preferredModel)];
                }
            }

            for (const model of models) {
                // Check if model was manually disabled (unless in exactOnly testing mode)
                if (!params.exactOnly && !TelemetryService.isModelEnabled(model)) {
                    continue;
                }

                const startTime = Date.now();
                try {
                    // Special handler for Google Gemini GenAI SDK
                    if (provider.id === 'gemini') {
                        try {
                            const { GoogleGenAI } = await import('@google/genai');
                            const ai = new GoogleGenAI({ apiKey: provider.apiKey });
                            const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

                            const response = await ai.models.generateContent({
                                model,
                                contents: fullPrompt,
                                config: {
                                    temperature: 0.1,
                                    responseMimeType: 'application/json',
                                },
                            });

                            const latencyMs = Date.now() - startTime;
                            const text = response.text || '{}';
                            const parsed = JSON.parse(text);

                            const headline = parsed.headline || cleanTitle;
                            const story = parsed.story || cleanContent.slice(0, 350);
                            const bullets = Array.isArray(parsed.bullets) ? parsed.bullets : [headline];

                            const promptTokens = Math.round(fullPrompt.length / 4);
                            const completionTokens = Math.round((headline.length + story.length) / 4);
                            const totalTokens = promptTokens + completionTokens;

                            TelemetryService.recordAiUsage({
                                model,
                                promptTokens,
                                completionTokens,
                                latencyMs,
                                articleTitle: cleanTitle,
                            });

                            return {
                                headline,
                                crispyStory: story,
                                bulletPoints: bullets,
                                modelUsed: `Google Gemini (${model})`,
                                providerUsed: provider.name,
                                promptTokens,
                                completionTokens,
                                totalTokens,
                                latencyMs,
                                success: true,
                            };
                        } catch (geminiErr: any) {
                            if (params.exactOnly) {
                                throw new Error(`[${model}] ${geminiErr.message || 'Gemini API call failed'}`);
                            }
                            // Silent model rotation without terminal clutter
                            // console.warn(`⚠️ [Google Gemini] Model "${model}" failed: ${geminiErr.message}. Rotating to next tier...`);
                            TelemetryService.recordModelError({
                                model,
                                error: geminiErr.message || 'Gemini API call failed',
                                statusCode: geminiErr.status || (geminiErr.message?.includes('429') ? 429 : 500),
                                articleTitle: cleanTitle,
                            });
                            continue;
                        }
                    }

                    const endpoint = `${provider.baseUrl}/chat/completions`;
                    const headers: Record<string, string> = {
                        'Authorization': `Bearer ${provider.apiKey}`,
                        'Content-Type': 'application/json',
                        ...(provider.defaultHeaders || {}),
                    };

                    // 1. Try json_schema / json_object structured payload
                    let response = await fetch(endpoint, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            model,
                            messages: [
                                { role: 'system', content: systemPrompt },
                                { role: 'user', content: userPrompt },
                            ],
                            temperature: 0.1,
                            max_tokens: 600,
                            response_format: jsonSchemaFormat,
                        }),
                    });

                    // 2. Fallback to json_object if json_schema fails on specific provider
                    if (response.status === 400) {
                        response = await fetch(endpoint, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({
                                model,
                                messages: [
                                    { role: 'system', content: systemPrompt },
                                    { role: 'user', content: userPrompt },
                                ],
                                temperature: 0.1,
                                max_tokens: 600,
                                response_format: { type: 'json_object' },
                            }),
                        });
                    }

                    // 3. Fallback to standard chat completion
                    if (response.status === 400) {
                        response = await fetch(endpoint, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({
                                model,
                                messages: [
                                    { role: 'system', content: `${systemPrompt}\n\nReturn strict JSON only.` },
                                    { role: 'user', content: userPrompt },
                                ],
                                temperature: 0.1,
                                max_tokens: 600,
                            }),
                        });
                    }

                    const latencyMs = Date.now() - startTime;

                    if (response.status === 429) {
                        if (params.exactOnly) {
                            throw new Error(`[${model}] 429 Rate Limit on ${provider.name}. Quota exhausted.`);
                        }
                        // console.warn(`⚠️ [${provider.name}] Rate limit (429) on model "${model}". Rotating to next model/provider...`);
                        TelemetryService.recordRateLimit(model, 30);
                        TelemetryService.recordModelError({
                            model,
                            error: `Rate limit 429 on ${provider.name}`,
                            statusCode: 429,
                            articleTitle: cleanTitle,
                        });
                        continue; // Rotate to next model/provider immediately
                    }

                    if (!response.ok) {
                        const errText = await response.text();
                        if (params.exactOnly) {
                            throw new Error(`[${model}] ${response.status} Error: ${errText.slice(0, 150)}`);
                        }
                        // console.warn(`⚠️ [${provider.name}] Model "${model}" failed (${response.status}): ${errText.slice(0, 120)}`);
                        TelemetryService.recordModelError({
                            model,
                            error: errText.slice(0, 120),
                            statusCode: response.status,
                            articleTitle: cleanTitle,
                        });
                        continue;
                    }

                    const data = await response.json();
                    const choice = data.choices?.[0];
                    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
                    const rawContentStr = choice?.message?.content || '{}';

                    let parsed: any;
                    try {
                        parsed = JSON.parse(rawContentStr);
                    } catch {
                        const jsonMatch = rawContentStr.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            try {
                                parsed = JSON.parse(jsonMatch[0]);
                            } catch {
                                parsed = { headline: cleanTitle, story: cleanContent.slice(0, 300), bullets: [cleanTitle] };
                            }
                        } else {
                            parsed = { headline: cleanTitle, story: cleanContent.slice(0, 300), bullets: [cleanTitle] };
                        }
                    }

                    const headline = parsed.headline || cleanTitle;
                    const crispyStory = parsed.story || cleanContent.slice(0, 350);
                    const bulletPoints = Array.isArray(parsed.bullets) && parsed.bullets.length > 0
                        ? parsed.bullets
                        : [cleanTitle];

                    TelemetryService.recordAiUsage({
                        model: `${provider.id}:${model}`,
                        promptTokens: usage.prompt_tokens,
                        completionTokens: usage.completion_tokens,
                        latencyMs,
                        articleTitle: headline,
                    });

                    return {
                        headline,
                        crispyStory,
                        bulletPoints,
                        modelUsed: model,
                        providerUsed: provider.name,
                        promptTokens: usage.prompt_tokens,
                        completionTokens: usage.completion_tokens,
                        totalTokens: usage.total_tokens,
                        latencyMs,
                        success: true,
                    };
                } catch (err: any) {
                    lastError = err;
                    // console.warn(`❌ [${provider.name}] Exception with model "${model}":`, err.message);
                    if (params.exactOnly) {
                        throw err;
                    }
                }
            }
        }

        // Final Safety Net: Deterministic Lead-3 Extractive Fallback (0 Tokens)
        // console.warn('⚠️ [UniversalLlmService] All AI providers exhausted. Utilizing deterministic extractive fallback.');
        TelemetryService.recordError('ai_request', `All providers exhausted. Using extractive fallback. Error: ${lastError?.message}`);

        const sentences = cleanContent.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 15);
        const leadStory = sentences.slice(0, 3).join('. ') + '.';
        const bullets = sentences.slice(0, 3);

        return {
            headline: cleanTitle,
            crispyStory: leadStory || cleanTitle,
            bulletPoints: bullets.length > 0 ? bullets : [cleanTitle],
            modelUsed: 'deterministic-lead3-fallback',
            providerUsed: 'Local Heuristic Engine',
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            latencyMs: 1,
            success: false,
        };
    }

    /**
     * 🧠 Interactive AI Document Q&A across the Multi-Provider Mesh (Gemini, Groq, Mistral, Cloudflare)
     */
    public static async chatDocumentQuestion(params: {
        question: string;
        contextText: string;
        docTitle: string;
    }): Promise<{ answer: string; keyTakeaways: string[]; modelUsed: string }> {
        const systemPrompt = `You are a world-class AI Document Research Assistant specializing in academic, educational, and business analysis.
Your job is to answer user inquiries accurately and insightfully based on the referenced document sections.

INSTRUCTIONS:
1. Provide a direct, articulate, and complete explanation answering the question.
2. If mathematical formulas or literary/technical terms appear, explain their meaning clearly.
3. Extract 2-4 high-impact key takeaway bullet points.
4. Format output strictly as valid JSON:
{"answer":"Clear, direct explanation...","keyTakeaways":["Key point 1","Key point 2"]}`;

        const userPrompt = `Document Title: "${params.docTitle}"

Referenced Document Sections:
"""
${params.contextText || 'No specific sections referenced. Provide a helpful contextual answer.'}
"""

User Question:
"${params.question}"`;

        const providers = this.getProviders();

        for (const provider of providers) {
            for (const model of provider.models) {
                try {
                    // Google Gemini GenAI SDK
                    if (provider.id === 'gemini') {
                        const { GoogleGenAI } = await import('@google/genai');
                        const ai = new GoogleGenAI({ apiKey: provider.apiKey });
                        const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

                        const response = await ai.models.generateContent({
                            model,
                            contents: fullPrompt,
                            config: {
                                temperature: 0.2,
                                responseMimeType: 'application/json',
                            },
                        });

                        const text = response.text || '{}';
                        const parsed = JSON.parse(text);
                        if (parsed && (parsed.answer || parsed.keyTakeaways)) {
                            return {
                                answer: parsed.answer || text,
                                keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
                                modelUsed: `Google Gemini (${model})`,
                            };
                        }
                    } else {
                        // Groq / Mistral / Cloudflare (OpenAI-compatible Chat Completion)
                        const endpoint = `${provider.baseUrl}/chat/completions`;
                        const headers: Record<string, string> = {
                            'Authorization': `Bearer ${provider.apiKey}`,
                            'Content-Type': 'application/json',
                            ...(provider.defaultHeaders || {}),
                        };

                        const response = await fetch(endpoint, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({
                                model,
                                messages: [
                                    { role: 'system', content: systemPrompt },
                                    { role: 'user', content: userPrompt },
                                ],
                                temperature: 0.2,
                                max_tokens: 600,
                                response_format: { type: 'json_object' },
                            }),
                        });

                        if (response.ok) {
                            const data = await response.json();
                            const raw = data.choices?.[0]?.message?.content || '{}';
                            const parsed = JSON.parse(raw);
                            if (parsed && (parsed.answer || parsed.keyTakeaways)) {
                                return {
                                    answer: parsed.answer || raw,
                                    keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
                                    modelUsed: `${provider.name} (${model})`,
                                };
                            }
                        }
                    }
                } catch (err: any) {
                    console.warn(`[UniversalLlmService] Q&A model "${model}" notice:`, err.message);
                }
            }
        }

        // Fallback if all providers failed
        return {
            answer: `Based on "${params.docTitle}", the referenced sections cover key concepts. You can also edit sections directly or ask specific questions regarding the selected topics.`,
            keyTakeaways: [
                'Review referenced sections for detailed context',
                'Try asking focused queries on specific terms or formulas',
            ],
            modelUsed: 'Local Context Engine',
        };
    }
}

export default UniversalLlmService;
