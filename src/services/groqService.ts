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

    // Model Pool in strict Priority order
    private static modelPool: string[] = [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'qwen/qwen3.8-27b',
        'gemma2-9b-it',
        'mixtral-8x7b-32768',
    ];

    /**
     * Sanitizes raw HTML/Text, stripping dates, bylines, social links & boilerplate
     */
    public static sanitizeRawText(rawText: string): string {
        if (!rawText) return '';
        return rawText
            .replace(/<[^>]*>/g, ' ') // Strip HTML tags
            .replace(/(published|updated|reported by|written by|follow us|subscribe|read more|click here|copyright|all rights reserved)[\s\S]{0,80}/gi, ' ')
            .replace(/http[s]?:\/\/\S+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 3000); // Feed maximum 3000 chars for high speed
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

        const systemPrompt = `You are a world-class senior news editor for Inshorts.
Your job is to transform raw news into a punchy, ultra-crisp 60-word news story with 3 key takeaway bullet points.

CRITICAL RULES:
1. Output MUST be strict valid JSON only without markdown or codeblocks.
2. The JSON format must be:
{
  "headline": "Ultra crisp punchy headline (max 12 words)",
  "story": "Complete, engaging 60-word news story providing full context and outcome without fluff.",
  "bullets": [
    "Bullet point 1: Key fact or number",
    "Bullet point 2: Direct consequence or statement",
    "Bullet point 3: What happens next"
  ]
}
3. STRICTLY DO NOT include dates, reporter names, "In a recent statement", or boilerplate.
4. Keep the tone factual, unbiased, and modern.`;

        const userPrompt = `Category: ${params.category || 'General'}
Headline: ${cleanTitle}

Raw Content:
${cleanContent || cleanTitle}`;

        let lastError: any = null;

        for (const model of modelsToTry) {
            const startTime = Date.now();
            try {
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
                        temperature: 0.2,
                        max_tokens: 350,
                        response_format: { type: 'json_object' },
                    }),
                });

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
                const contentStr = data.choices?.[0]?.message?.content || '{}';
                const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

                let parsed: any;
                try {
                    parsed = JSON.parse(contentStr);
                } catch {
                    parsed = {
                        headline: cleanTitle,
                        story: cleanContent.slice(0, 300),
                        bullets: [cleanTitle],
                    };
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
