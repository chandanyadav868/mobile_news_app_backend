import TelemetryService from './telemetryService.js';
import { env } from '../config/env.js';

export interface SummarizedNewsResult {
    headline: string;
    crispyStory: string;
    bulletPoints: string[];
    modelUsed: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
    success: boolean;
}

export class GroqService {
    private static apiKey: string = env.GROQ_API_KEY || process.env.GROQ_API_KEY || '';

    // Fast completion model pool (excludes heavy compound reasoning models)
    private static modelPool: string[] = [
        'qwen/qwen3.8-27b',
        'qwen/qwen3.6-27b',
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b',
    ];

    /**
     * Sanitizes and caps raw text to lead 200 words (saves 80% prompt tokens)
     */
    public static sanitizeRawText(rawText: string): string {
        if (!rawText) return '';
        const cleaned = rawText
            .replace(/<[^>]*>/g, ' ') // Strip HTML tags
            .replace(/(published|updated|reported by|written by|follow us|subscribe|read more|click here|copyright|all rights reserved)[\s\S]{0,80}/gi, ' ')
            .replace(/http[s]?:\/\/\S+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Cap to lead 200 words
        const words = cleaned.split(' ');
        if (words.length > 200) {
            return words.slice(0, 200).join(' ') + '...';
        }
        return cleaned;
    }

    /**
     * Summarize raw news article into an Inshorts-crisp 60-word story with auto-model rotation
     */
    public static async summarizeNews(params: {
        title: string;
        content: string;
        category?: string;
        preferredModel?: string;
    }): Promise<SummarizedNewsResult> {
        const cleanContent = this.sanitizeRawText(params.content);
        const cleanTitle = params.title.replace(/<[^>]*>/g, '').trim();

        const modelsToTry = params.preferredModel
            ? [params.preferredModel, ...this.modelPool.filter((m) => m !== params.preferredModel)]
            : [...this.modelPool];

        const systemPrompt = `You are an Inshorts news editor. Summarize raw news into an ultra-crisp 60-word story with 3 key takeaway bullets.
Return strict JSON only:
{"headline":"Punchy headline (max 10 words)","story":"Crisp 60-word news story with full context.","bullets":["Key fact 1","Key fact 2","Key fact 3"]}
Do not include dates, author names, or fluff.`;

        const userPrompt = `Category: ${params.category || 'General'}
Headline: ${cleanTitle}

Text:
${cleanContent || cleanTitle}`;

        // Official Groq Structured Outputs specification (https://console.groq.com/docs/structured-outputs)
        const jsonSchemaFormat = {
            type: 'json_schema',
            json_schema: {
                name: 'inshorts_story_summary',
                schema: {
                    type: 'object',
                    properties: {
                        headline: {
                            type: 'string',
                            description: 'Ultra-crisp punchy headline (max 10 words)',
                        },
                        story: {
                            type: 'string',
                            description: 'Engaging, concise 60-word news story providing full factual context without fluff.',
                        },
                        bullets: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Exactly 3 key takeaway bullet points',
                        },
                    },
                    required: ['headline', 'story', 'bullets'],
                    additionalProperties: false,
                },
                strict: true,
            },
        };

        let lastError: any = null;

        for (const model of modelsToTry) {
            const startTime = Date.now();
            try {
                // 1. First attempt: Official Groq Structured Output (json_schema)
                let response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
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

                // 2. Fallback: json_object if json_schema is unsupported on specific model
                if (response.status === 400) {
                    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`,
                            'Content-Type': 'application/json',
                        },
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

                // 3. Fallback: standard completion without response_format if both fail
                if (response.status === 400) {
                    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            model,
                            messages: [
                                { role: 'system', content: `${systemPrompt}\n\nStrictly reply with valid JSON only.` },
                                { role: 'user', content: userPrompt },
                            ],
                            temperature: 0.1,
                            max_tokens: 350,
                        }),
                    });
                }

                const latencyMs = Date.now() - startTime;

                if (response.status === 429) {
                    console.warn(`⚠️ [GroqService] Rate limit 429 on model "${model}". Rotating to next tier model...`);
                    TelemetryService.recordRateLimit(model, 60);
                    continue; // Try next model in pool immediately
                }

                if (!response.ok) {
                    const errText = await response.text();
                    console.warn(`⚠️ [GroqService] Model "${model}" failed (${response.status}): ${errText.slice(0, 150)}`);
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
                    // Extract JSON substring if surrounded by markdown codeblocks
                    const jsonMatch = rawContentStr.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        try {
                            parsed = JSON.parse(jsonMatch[0]);
                        } catch {
                            parsed = {
                                headline: cleanTitle,
                                story: cleanContent.slice(0, 300),
                                bullets: [cleanTitle],
                            };
                        }
                    } else {
                        parsed = {
                            headline: cleanTitle,
                            story: cleanContent.slice(0, 300),
                            bullets: [cleanTitle],
                        };
                    }
                }

                const headline = parsed.headline || cleanTitle;
                const crispyStory = parsed.story || cleanContent.slice(0, 350);
                const bulletPoints = Array.isArray(parsed.bullets) && parsed.bullets.length > 0
                    ? parsed.bullets
                    : [cleanTitle];

                // Record usage in Telemetry
                TelemetryService.recordAiUsage({
                    model,
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
                    promptTokens: usage.prompt_tokens,
                    completionTokens: usage.completion_tokens,
                    totalTokens: usage.total_tokens,
                    latencyMs,
                    success: true,
                };
            } catch (err: any) {
                lastError = err;
                console.error(`❌ [GroqService] Exception with model "${model}":`, err.message);
            }
        }

        // Fallback: Lead-3 Heuristic Extractive Summarizer if all models fail
        console.warn('⚠️ [GroqService] All AI models exhausted. Utilizing deterministic extractive fallback.');
        TelemetryService.recordError('ai_request', `All models exhausted. Using extractive fallback. Details: ${lastError?.message}`);

        const sentences = cleanContent.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 15);
        const leadStory = sentences.slice(0, 3).join('. ') + '.';
        const bullets = sentences.slice(0, 3);

        return {
            headline: cleanTitle,
            crispyStory: leadStory || cleanTitle,
            bulletPoints: bullets.length > 0 ? bullets : [cleanTitle],
            modelUsed: 'deterministic-lead3-fallback',
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            latencyMs: 1,
            success: false,
        };
    }
}

export default GroqService;
