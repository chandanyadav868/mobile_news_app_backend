import * as os from 'os';
import * as fs from 'fs';

export interface ModelUsageMetric {
    model: string;
    displayName: string;
    tier: number;
    requestsToday: number;
    promptTokensToday: number;
    completionTokensToday: number;
    totalTokensToday: number;
    lastLatencyMs: number;
    status: 'ready' | 'active' | 'rate_limited' | 'error';
    lastUsedAt: string | null;
    errorsToday: number;
    rateLimitResetAt: string | null;
}

export interface TelemetryLogEntry {
    id: string;
    timestamp: string;
    type: 'ai_request' | 'rate_limit' | 'error' | 'tts_request';
    model?: string;
    tokens?: number;
    latencyMs?: number;
    status: 'success' | 'failed' | 'rotated';
    message: string;
    details?: any;
}

export class TelemetryService {
    private static startTime = Date.now();
    private static logs: TelemetryLogEntry[] = [];
    private static MAX_LOGS = 100;

    // Per-Model Accounting Map
    private static modelMetrics: Map<string, ModelUsageMetric> = new Map([
        [
            'llama-3.3-70b-versatile',
            {
                model: 'llama-3.3-70b-versatile',
                displayName: 'Llama 3.3 70B (Primary Editor)',
                tier: 1,
                requestsToday: 0,
                promptTokensToday: 0,
                completionTokensToday: 0,
                totalTokensToday: 0,
                lastLatencyMs: 0,
                status: 'ready',
                lastUsedAt: null,
                errorsToday: 0,
                rateLimitResetAt: null,
            },
        ],
        [
            'llama-3.1-8b-instant',
            {
                model: 'llama-3.1-8b-instant',
                displayName: 'Llama 3.1 8B (Sub-150ms Turbo)',
                tier: 2,
                requestsToday: 0,
                promptTokensToday: 0,
                completionTokensToday: 0,
                totalTokensToday: 0,
                lastLatencyMs: 0,
                status: 'ready',
                lastUsedAt: null,
                errorsToday: 0,
                rateLimitResetAt: null,
            },
        ],
        [
            'qwen/qwen3.8-27b',
            {
                model: 'qwen/qwen3.8-27b',
                displayName: 'Qwen 3.8 27B (High Accuracy)',
                tier: 3,
                requestsToday: 0,
                promptTokensToday: 0,
                completionTokensToday: 0,
                totalTokensToday: 0,
                lastLatencyMs: 0,
                status: 'ready',
                lastUsedAt: null,
                errorsToday: 0,
                rateLimitResetAt: null,
            },
        ],
        [
            'gemma2-9b-it',
            {
                model: 'gemma2-9b-it',
                displayName: 'Gemma 2 9B (Google Backup)',
                tier: 4,
                requestsToday: 0,
                promptTokensToday: 0,
                completionTokensToday: 0,
                totalTokensToday: 0,
                lastLatencyMs: 0,
                status: 'ready',
                lastUsedAt: null,
                errorsToday: 0,
                rateLimitResetAt: null,
            },
        ],
        [
            'mixtral-8x7b-32768',
            {
                model: 'mixtral-8x7b-32768',
                displayName: 'Mixtral 8x7B (MoE Deep Context)',
                tier: 5,
                requestsToday: 0,
                promptTokensToday: 0,
                completionTokensToday: 0,
                totalTokensToday: 0,
                lastLatencyMs: 0,
                status: 'ready',
                lastUsedAt: null,
                errorsToday: 0,
                rateLimitResetAt: null,
            },
        ],
    ]);

    /**
     * Record a successful AI request and update token accounting
     */
    public static recordAiUsage(params: {
        model: string;
        promptTokens: number;
        completionTokens: number;
        latencyMs: number;
        articleTitle?: string;
    }) {
        const metric = this.modelMetrics.get(params.model) || {
            model: params.model,
            displayName: params.model,
            tier: 99,
            requestsToday: 0,
            promptTokensToday: 0,
            completionTokensToday: 0,
            totalTokensToday: 0,
            lastLatencyMs: 0,
            status: 'ready',
            lastUsedAt: null,
            errorsToday: 0,
            rateLimitResetAt: null,
        };

        const total = (params.promptTokens || 0) + (params.completionTokens || 0);

        metric.requestsToday += 1;
        metric.promptTokensToday += params.promptTokens || 0;
        metric.completionTokensToday += params.completionTokens || 0;
        metric.totalTokensToday += total;
        metric.lastLatencyMs = params.latencyMs;
        metric.status = 'ready';
        metric.lastUsedAt = new Date().toISOString();

        this.modelMetrics.set(params.model, metric);

        this.addLog({
            type: 'ai_request',
            model: params.model,
            tokens: total,
            latencyMs: params.latencyMs,
            status: 'success',
            message: `Summarized "${params.articleTitle || 'Article'}" in ${params.latencyMs}ms (${total} tokens)`,
            details: {
                promptTokens: params.promptTokens,
                completionTokens: params.completionTokens,
            },
        });
    }

    /**
     * Record a rate limit (429) event and trigger model status update
     */
    public static recordRateLimit(model: string, resetSeconds: number = 60) {
        const metric = this.modelMetrics.get(model);
        if (metric) {
            metric.status = 'rate_limited';
            metric.errorsToday += 1;
            metric.rateLimitResetAt = new Date(Date.now() + resetSeconds * 1000).toISOString();
            this.modelMetrics.set(model, metric);
        }

        this.addLog({
            type: 'rate_limit',
            model,
            status: 'rotated',
            message: `Rate limit reached on ${model} (429). Automatically rotated to next tier model.`,
        });
    }

    /**
     * Record general error
     */
    public static recordError(type: 'ai_request' | 'tts_request', message: string, details?: any) {
        this.addLog({
            type: 'error',
            status: 'failed',
            message,
            details,
        });
    }

    private static addLog(entry: Omit<TelemetryLogEntry, 'id' | 'timestamp'>) {
        const fullEntry: TelemetryLogEntry = {
            id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            ...entry,
        };

        this.logs.unshift(fullEntry);
        if (this.logs.length > this.MAX_LOGS) {
            this.logs.pop();
        }
    }

    /**
     * Get system metrics (CPU, RAM, Process, OS)
     */
    public static async getSystemMetrics() {
        const cpus = os.cpus();
        const cpuCount = cpus.length;
        const cpuModel = cpus[0]?.model || 'Generic Processor';

        // Calculate approximate CPU load
        const loadAvg = os.loadavg();
        const cpuLoad1MinPercent = Math.min(100, Math.round((loadAvg[0] / (cpuCount || 1)) * 100));

        // Memory calculations
        const totalMemBytes = os.totalmem();
        const freeMemBytes = os.freemem();
        const usedMemBytes = totalMemBytes - freeMemBytes;
        const usedMemPercent = Math.round((usedMemBytes / totalMemBytes) * 100);

        // Process Memory
        const procMem = process.memoryUsage();

        // Server Uptime
        const uptimeSeconds = Math.round(os.uptime());
        const processUptimeSeconds = Math.round((Date.now() - this.startTime) / 1000);

        return {
            server: {
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                release: os.release(),
                nodeVersion: process.version,
                uptimeSeconds,
                processUptimeSeconds,
            },
            cpu: {
                cores: cpuCount,
                model: cpuModel,
                loadPercent: cpuLoad1MinPercent,
                loadAvg1m: loadAvg[0].toFixed(2),
                loadAvg5m: loadAvg[1].toFixed(2),
                loadAvg15m: loadAvg[2].toFixed(2),
            },
            memory: {
                totalMB: Math.round(totalMemBytes / 1024 / 1024),
                freeMB: Math.round(freeMemBytes / 1024 / 1024),
                usedMB: Math.round(usedMemBytes / 1024 / 1024),
                usedPercent: usedMemPercent,
                processHeapUsedMB: Math.round(procMem.heapUsed / 1024 / 1024),
                processRssMB: Math.round(procMem.rss / 1024 / 1024),
            },
        };
    }

    /**
     * Get full consolidated telemetry snapshot
     */
    public static async getFullTelemetry() {
        const sys = await this.getSystemMetrics();

        const models = Array.from(this.modelMetrics.values());
        const totalTokensToday = models.reduce((acc, m) => acc + m.totalTokensToday, 0);
        const totalRequestsToday = models.reduce((acc, m) => acc + m.requestsToday, 0);
        const totalErrorsToday = models.reduce((acc, m) => acc + m.errorsToday, 0);

        return {
            timestamp: new Date().toISOString(),
            system: sys,
            ai: {
                provider: 'Groq Cloud (LPU Accelerated)',
                totalTokensToday,
                totalRequestsToday,
                totalErrorsToday,
                models,
            },
            recentLogs: this.logs.slice(0, 30),
        };
    }
}

export default TelemetryService;
