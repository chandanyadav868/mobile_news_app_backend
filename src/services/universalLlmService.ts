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
    // Concurrency Lock: Indicates if the local container LLM is actively evaluating a job
    public static isLocalLlmBusy = false;

    // Multi-Provider AI Mesh: Local Ollama (Qwen 2.5) + Groq Cloud LPU + Mistral AI Serverless
    private static getProviders(): LlmProviderConfig[] {
        const providers: LlmProviderConfig[] = [];

        // 0. Local Containerized LLM (Ollama - Qwen2.5-0.5B: 100% Free, Unlimited 24/7 Summarization)
        if (env.OLLAMA_BASE_URL && env.LOCAL_LLM_ENABLED !== 'false') {
            providers.push({
                id: 'ollama',
                name: 'Local Ollama (Qwen 2.5)',
                baseUrl: env.OLLAMA_BASE_URL.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, ''),
                apiKey: 'ollama-local',
                models: [
                    env.OLLAMA_MODEL || 'qwen2.5:0.5b',
                ],
            });
        }

        // 1. Groq Cloud (Ultra-Fast LPU Engine: 500+ Tokens/sec)
        if (env.GROQ_API_KEY) {
            providers.push({
                id: 'groq',
                name: 'Groq Cloud',
                baseUrl: 'https://api.groq.com/openai/v1',
                apiKey: env.GROQ_API_KEY,
                models: [
                    'qwen/qwen3.8-27b',
                    'openai/gpt-oss-120b',
                    'openai/gpt-oss-20b',
                ],
            });
        }

        // 2. Mistral AI (High-Speed European Serverless Engine)
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

    public static sanitizeOutputText(text: string): string {
        if (!text) return '';
        return text.replace(/\*{1,}/g, '').replace(/_{2,}/g, '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Ensures stories and bullets form complete, meaningful sentences without abrupt cut-offs.
     * Drops trailing fragmented words or clauses and guarantees terminal punctuation.
     */
    public static cleanSentenceCompletion(text: string, minWords = 25): string {
        if (!text) return '';
        let cleaned = this.sanitizeOutputText(text);

        // Remove any dangling punctuation at the end like commas, hyphens, colons
        cleaned = cleaned.replace(/[\s,;:\-\–—]+$/, '');

        // If text does not end with terminal punctuation (. ! ? " '), look for the last complete sentence
        if (!/[.!?]["']?$/.test(cleaned)) {
            const lastPeriod = cleaned.lastIndexOf('.');
            const lastExcl = cleaned.lastIndexOf('!');
            const lastQues = cleaned.lastIndexOf('?');
            const lastTerminator = Math.max(lastPeriod, lastExcl, lastQues);

            if (lastTerminator > 0) {
                const candidate = cleaned.slice(0, lastTerminator + 1).trim();
                const wordCount = candidate.split(/\s+/).filter(Boolean).length;
                if (wordCount >= minWords) {
                    cleaned = candidate;
                } else {
                    cleaned = cleaned + '.';
                }
            } else {
                cleaned = cleaned + '.';
            }
        }
        return cleaned;
    }

    /**
     * Smart JSON extractor and repairer for LLM output strings that may miss closing brackets
     */
    public static parseOrRepairJson(rawStr: string, fallback: any): any {
        if (!rawStr) return fallback;
        try {
            return JSON.parse(rawStr);
        } catch {
            // Attempt regex extraction
            const jsonMatch = rawStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch {
                    // Try auto-repair missing braces
                    try {
                        let candidate = jsonMatch[0].trim();
                        if (candidate.endsWith(',')) candidate = candidate.slice(0, -1);
                        if (!candidate.endsWith('}')) {
                            if (candidate.includes('"bullets"') && !candidate.includes(']')) {
                                candidate += '"]}';
                            } else {
                                candidate += '"}';
                            }
                        }
                        return JSON.parse(candidate);
                    } catch {
                        // proceed
                    }
                }
            }
            // Try extracting from first { to end of text
            const firstBrace = rawStr.indexOf('{');
            if (firstBrace !== -1) {
                let partial = rawStr.slice(firstBrace).trim();
                if (!partial.endsWith('}')) {
                    partial = partial.replace(/,\s*$/, '');
                    if (partial.includes('"bullets"') && !partial.includes(']')) {
                        partial += '"]}';
                    } else {
                        partial += '"}';
                    }
                }
                try {
                    return JSON.parse(partial);
                } catch {
                    // ignore
                }
            }
        }
        return fallback;
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

        const systemPrompt = `You are an expert news editor who explains news in simple, crystal-clear, everyday English (Grade 6–8 reading level).
Your mission: Make every story easy to read and understand in under 45 seconds using simple, familiar words.

STRICT EDITORIAL RULES:
1. SIMPLE WORDS ONLY: Use simple, everyday words that any reader can understand effortlessly. Avoid difficult, academic, legal, or dense jargon. (For example, use "stopped" instead of "halted", "danger" instead of "peril", "agree" instead of "concur", "job" instead of "vocation").
2. CRISP LENGTH & COMPLETION: Exactly 55 to 75 words across 2 to 3 complete, well-formed sentences. Never stop mid-sentence. Always finish your thoughts with terminal punctuation. Never leave hanging words.
3. CLEAR & DIRECT: Write short, active sentences. Hook the reader immediately with what happened and why it matters.
4. SPOKEN PHONETICS: Write exclusively in clean words and natural punctuation. Never include brackets, slashes, URLs, asterisks, or markdown symbols.
5. 3 COMPLETE BULLETS: Provide 3 distinct key takeaway bullets written in plain, complete sentences (8 to 15 words each).

Return strict JSON only without markdown:
{"headline":"Simple, clear headline under 10 words","story":"Clear 55 to 75-word story in simple everyday English with complete sentences.","bullets":["Simple fact 1","Simple fact 2","Simple fact 3"]}`;

        // High-precision compact system prompt for local 0.5B container to guarantee complete, meaningful sentences without cutting off
        const localCompactSystemPrompt = `You are a professional Inshorts news editor. Summarize this news story into an engaging, complete, and meaningful summary in simple English.
RULES:
1. Story: Exactly 55 to 70 words across 2 to 3 complete, coherent sentences. Never stop mid-sentence. Always finish thoughts with a full stop.
2. Bullets: Exactly 3 complete, insightful takeaway facts (each 8 to 15 words).
3. Headline: Catchy, clear headline under 10 words.
4. Output STRICT JSON ONLY with keys "headline", "story", "bullets". No markdown, no preambles, no unfinished sentences.`;

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
                        headline: { type: 'string', description: 'Simple, clear headline (max 10 words)' },
                        story: { type: 'string', description: 'Clear 60-75 word news story in simple everyday English across 1-2 paragraphs' },
                        bullets: { type: 'array', items: { type: 'string' }, description: '3 simple key takeaway bullets' },
                    },
                    required: ['headline', 'story', 'bullets'],
                    additionalProperties: false,
                },
                strict: true,
            },
        };

        let lastError: any = null;

        // Iterate through Provider Chain (Ollama -> Groq -> Mistral)
        for (const provider of providers) {
            // Concurrency Protection: If local Ollama is busy and this is an auto-rotate request, skip directly to fast cloud providers!
            if (provider.id === 'ollama' && !params.exactOnly && UniversalLlmService.isLocalLlmBusy) {
                console.log('⚡ [AI Mesh] Local Ollama is busy with active inference. Auto-routing to cloud provider...');
                continue;
            }

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
                const isOllama = provider.id === 'ollama';

                if (isOllama) {
                    UniversalLlmService.isLocalLlmBusy = true;
                }

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

                            const headline = UniversalLlmService.sanitizeOutputText(parsed.headline || cleanTitle);
                            const story = UniversalLlmService.sanitizeOutputText(parsed.story || cleanContent.slice(0, 350));
                            const bullets = (Array.isArray(parsed.bullets) ? parsed.bullets : [headline]).map((b: string) => UniversalLlmService.sanitizeOutputText(b));

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

                    // Local CPU inference needs generous 75s headroom for cold start or queue
                    const requestTimeoutMs = isOllama ? 75000 : 25000;
                    const activeResponseFormat = isOllama ? { type: 'json_object' } : jsonSchemaFormat;
                    const activeMaxTokens = isOllama ? 350 : 600;
                    const activeSystemPrompt = isOllama ? localCompactSystemPrompt : systemPrompt;

                    const basePayload: any = {
                        model,
                        messages: [
                            { role: 'system', content: activeSystemPrompt },
                            { role: 'user', content: userPrompt },
                        ],
                        temperature: isOllama ? 0.15 : 0.1,
                        max_tokens: activeMaxTokens,
                        response_format: activeResponseFormat,
                    };

                    // Optimize context slots and token predictions so local Ollama never cuts off mid-sentence
                    if (isOllama) {
                        basePayload.options = {
                            num_ctx: 2048,
                            num_predict: 350,
                            temperature: 0.15,
                            repeat_penalty: 1.1,
                            top_p: 0.9,
                        };
                    }

                    // 1. Try json_schema / json_object structured payload
                    let response = await fetch(endpoint, {
                        method: 'POST',
                        headers,
                        signal: AbortSignal.timeout(requestTimeoutMs),
                        body: JSON.stringify(basePayload),
                    });

                    // 2. Fallback to json_object if json_schema fails on specific provider
                    if (response.status === 400 && !isOllama) {
                        response = await fetch(endpoint, {
                            method: 'POST',
                            headers,
                            signal: AbortSignal.timeout(requestTimeoutMs),
                            body: JSON.stringify({
                                ...basePayload,
                                response_format: { type: 'json_object' },
                            }),
                        });
                    }

                    // 3. Fallback to standard chat completion
                    if (response.status === 400 && !isOllama) {
                        response = await fetch(endpoint, {
                            method: 'POST',
                            headers,
                            signal: AbortSignal.timeout(requestTimeoutMs),
                            body: JSON.stringify({
                                model,
                                messages: [
                                    { role: 'system', content: `${activeSystemPrompt}\n\nReturn strict JSON only.` },
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

                    const parsed = UniversalLlmService.parseOrRepairJson(rawContentStr, {
                        headline: cleanTitle,
                        story: cleanContent.slice(0, 300),
                        bullets: [cleanTitle],
                    });

                    const headline = UniversalLlmService.sanitizeOutputText(parsed.headline || cleanTitle);
                    let crispyStory = UniversalLlmService.cleanSentenceCompletion(parsed.story || cleanContent.slice(0, 350));

                    // Length & Quality Enforcement: If story is under 35 words and original text is rich, supplement it cleanly
                    const storyWords = crispyStory.split(/\s+/).filter(Boolean).length;
                    if (storyWords < 35 && cleanContent.length > 120) {
                        const backupSentences = cleanContent.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 20);
                        for (const sent of backupSentences) {
                            if (!crispyStory.toLowerCase().includes(sent.toLowerCase().slice(0, 25))) {
                                crispyStory = UniversalLlmService.cleanSentenceCompletion(`${crispyStory} ${sent}`);
                                if (crispyStory.split(/\s+/).filter(Boolean).length >= 50) break;
                            }
                        }
                    }

                    // Bullet Points Enhancement: Strip bullet symbols, numbers, and filter trivial entries
                    let bulletPoints: string[] = [];
                    if (Array.isArray(parsed.bullets) && parsed.bullets.length > 0) {
                        bulletPoints = parsed.bullets
                            .map((b: any) => UniversalLlmService.sanitizeOutputText(String(b || '')))
                            .map((b: string) => b.replace(/^[\s•\-\*\d\.\)]+/, '').trim())
                            .filter((b: string) => b.length > 6);
                    }
                    if (bulletPoints.length === 0) {
                        const sentences = (crispyStory || cleanContent || cleanTitle).split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 15);
                        bulletPoints = sentences.slice(0, 3);
                    }

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
                } finally {
                    if (isOllama) {
                        UniversalLlmService.isLocalLlmBusy = false;
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
            headline: UniversalLlmService.sanitizeOutputText(cleanTitle),
            crispyStory: UniversalLlmService.sanitizeOutputText(leadStory || cleanTitle),
            bulletPoints: (bullets.length > 0 ? bullets : [cleanTitle]).map((b) => UniversalLlmService.sanitizeOutputText(b)),
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
