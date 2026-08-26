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
    // Multi-Provider Registry in Priority Failover Order (100% Free AI Tiers)
    private static getProviders(): LlmProviderConfig[] {
        const providers: LlmProviderConfig[] = [];

        // 2. Groq Cloud (Secondary LPU Engine)
        if (env.GROQ_API_KEY) {
            providers.push({
                id: 'groq',
                name: 'Groq Cloud',
                baseUrl: 'https://api.groq.com/openai/v1',
                apiKey: env.GROQ_API_KEY,
                models: [
                    'qwen/qwen3.8-27b',
                    'qwen/qwen3.6-27b',
                    'openai/gpt-oss-120b',
                    'openai/gpt-oss-20b',
                ],
            });
        }

        // 3. Mistral AI (Tertiary EU Engine)
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

        // 4. Cloudflare Workers AI (Global Edge Tier)
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
     * Summarizes news with automatic multi-provider cross-failover
     */
    public static async summarizeNews(params: {
        title: string;
        content: string;
        category?: string;
        preferredProvider?: string;
        preferredModel?: string;
    }): Promise<SummarizedNewsResult> {
        const cleanContent = this.sanitizeRawText(params.content);
        const cleanTitle = params.title.replace(/<[^>]*>/g, '').trim();

        const providers = this.getProviders();
        if (params.preferredProvider) {
            providers.sort((a, b) => (a.id === params.preferredProvider ? -1 : 1));
        }

        const systemPrompt = `You are a professional Inshorts news editor. Summarize the provided news into a punchy, ultra-crisp 60-word story with 3 key takeaway bullets.
Return strict JSON only without markdown:
{"headline":"Punchy headline (max 10 words)","story":"Crisp 60-word story providing full context without fluff.","bullets":["Key fact 1","Key fact 2","Key fact 3"]}`;

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
                        story: { type: 'string', description: '60-word news story' },
                        bullets: { type: 'array', items: { type: 'string' }, description: '3 key takeaway bullets' },
                    },
                    required: ['headline', 'story', 'bullets'],
                    additionalProperties: false,
                },
                strict: true,
            },
        };

        let lastError: any = null;

        // Iterate through Provider Chain (SambaNova -> Groq -> Mistral -> Cloudflare)
        for (const provider of providers) {
            const models = params.preferredModel && provider.models.includes(params.preferredModel)
                ? [params.preferredModel, ...provider.models.filter((m) => m !== params.preferredModel)]
                : provider.models;

            for (const model of models) {
                const startTime = Date.now();
                try {
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
                            max_tokens: 350,
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
                                max_tokens: 350,
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
                                max_tokens: 350,
                            }),
                        });
                    }

                    const latencyMs = Date.now() - startTime;

                    if (response.status === 429) {
                        console.warn(`⚠️ [${provider.name}] Rate limit (429) on model "${model}". Rotating to next model/provider...`);
                        TelemetryService.recordRateLimit(model, 30);
                        continue; // Rotate to next model/provider immediately
                    }

                    if (!response.ok) {
                        const errText = await response.text();
                        console.warn(`⚠️ [${provider.name}] Model "${model}" failed (${response.status}): ${errText.slice(0, 120)}`);
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
                    console.warn(`❌ [${provider.name}] Exception with model "${model}":`, err.message);
                }
            }
        }

        // Final Safety Net: Deterministic Lead-3 Extractive Fallback (0 Tokens)
        console.warn('⚠️ [UniversalLlmService] All AI providers exhausted. Utilizing deterministic extractive fallback.');
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
}

export default UniversalLlmService;
