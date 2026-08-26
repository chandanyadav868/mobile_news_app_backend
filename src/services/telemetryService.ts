import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';

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
    type: 'ai_request' | 'rate_limit' | 'error' | 'tts_request' | 'ingest';
    model?: string;
    tokens?: number;
    latencyMs?: number;
    status: 'success' | 'failed' | 'rotated';
    message: string;
    details?: any;
}

export interface QueueStatusMetrics {
    pendingArticles: number;
    activeJobs: number;
    completedToday: number;
    failedToday: number;
    isIngesting: boolean;
}

export interface IngestionFunnelMetrics {
    rssScannedToday: number;
    dedupedCandidatesToday: number;
    llmSummarizedToday: number;
    directSavedToday: number;
    dbInsertedToday: number;
    lastIngestDurationMs: number;
    lastIngestAt: string | null;
}

export class TelemetryService {
    private static startTime = Date.now();
    private static logs: TelemetryLogEntry[] = [];
    private static MAX_LOGS = 100;
    private static dataDir = path.join(process.cwd(), 'data');
    private static dataFile = path.join(process.cwd(), 'data', 'telemetry_state.json');

    // AI Global Kill-Switch (Persisted)
    private static aiEnabled = true;
    private static trackedDate = new Date().toISOString().slice(0, 10);

    // Queue / BullMQ Ingestion Metrics
    private static queueMetrics: QueueStatusMetrics = {
        pendingArticles: 0,
        activeJobs: 0,
        completedToday: 0,
        failedToday: 0,
        isIngesting: false,
    };

    // Ingestion Funnel Metrics (Persisted)
    private static funnelMetrics: IngestionFunnelMetrics = {
        rssScannedToday: 0,
        dedupedCandidatesToday: 0,
        llmSummarizedToday: 0,
        directSavedToday: 0,
        dbInsertedToday: 0,
        lastIngestDurationMs: 0,
        lastIngestAt: null,
    };

    // Active SSE Stream Clients
    private static sseClients: Response[] = [];

    // Per-Model Accounting Map
    private static modelMetrics: Map<string, ModelUsageMetric> = new Map([
        [
            'qwen/qwen3.8-27b',
            {
                model: 'qwen/qwen3.8-27b',
                displayName: 'Qwen 3.8 27B (Primary • 2M TPD)',
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
            'qwen/qwen3.6-27b',
            {
                model: 'qwen/qwen3.6-27b',
                displayName: 'Qwen 3.6 27B (Secondary Turbo)',
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
            'openai/gpt-oss-120b',
            {
                model: 'openai/gpt-oss-120b',
                displayName: 'GPT-OSS 120B (High Intelligence)',
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
            'openai/gpt-oss-20b',
            {
                model: 'openai/gpt-oss-20b',
                displayName: 'GPT-OSS 20B (Fast Fallback)',
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
    ]);

    static {
        this.loadStateFromDisk();
    }

    /**
     * Load persisted state from disk on startup
     */
    private static loadStateFromDisk() {
        try {
            if (!fs.existsSync(this.dataDir)) {
                fs.mkdirSync(this.dataDir, { recursive: true });
            }

            if (fs.existsSync(this.dataFile)) {
                const raw = fs.readFileSync(this.dataFile, 'utf-8');
                const data = JSON.parse(raw);

                const todayStr = new Date().toISOString().slice(0, 10);
                if (data.trackedDate === todayStr && Array.isArray(data.models)) {
                    data.models.forEach((m: ModelUsageMetric) => {
                        this.modelMetrics.set(m.model, m);
                    });
                    if (Array.isArray(data.logs)) {
                        this.logs = data.logs;
                    }
                    if (data.funnel) {
                        this.funnelMetrics = { ...this.funnelMetrics, ...data.funnel };
                    }
                } else {
                    // New Day: Start fresh date
                    this.trackedDate = todayStr;
                }

                if (typeof data.aiEnabled === 'boolean') {
                    this.aiEnabled = data.aiEnabled;
                }

                console.log(`💾 [Telemetry] Loaded persistent state (AI Enabled: ${this.aiEnabled})`);
            }
        } catch (e: any) {
            console.warn('[Telemetry] Could not load state from disk:', e.message);
        }
    }

    /**
     * Save state to disk
     */
    private static saveStateToDisk() {
        try {
            if (!fs.existsSync(this.dataDir)) {
                fs.mkdirSync(this.dataDir, { recursive: true });
            }

            const state = {
                trackedDate: this.trackedDate,
                aiEnabled: this.aiEnabled,
                models: Array.from(this.modelMetrics.values()),
                funnel: this.funnelMetrics,
                logs: this.logs.slice(0, 40),
            };

            fs.writeFile(this.dataFile, JSON.stringify(state, null, 2), (err) => {
                if (err) console.warn('[Telemetry] Save state error:', err.message);
            });
        } catch (e: any) {
            console.warn('[Telemetry] Save state error:', e.message);
        }
    }

    /**
     * Server-Sent Events (SSE) Client Registration
     */
    public static addSseClient(res: Response) {
        this.sseClients.push(res);
        // Send immediate snapshot on connection
        this.getFullTelemetry().then((data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        });
    }

    public static removeSseClient(res: Response) {
        this.sseClients = this.sseClients.filter((client) => client !== res);
    }

    public static async broadcastTelemetry() {
        if (this.sseClients.length === 0) return;
        try {
            const data = await this.getFullTelemetry();
            const payload = `data: ${JSON.stringify(data)}\n\n`;
            this.sseClients.forEach((client) => {
                try {
                    client.write(payload);
                } catch {
                    // Client disconnected
                }
            });
        } catch (err: any) {
            console.warn('[Telemetry] Broadcast error:', err.message);
        }
    }

    /**
     * Get or Toggle AI Summarization Switch
     */
    public static getAiEnabled(): boolean {
        return this.aiEnabled;
    }

    public static setAiEnabled(enabled: boolean): boolean {
        this.aiEnabled = enabled;
        this.addLog({
            type: 'ai_request',
            status: enabled ? 'success' : 'rotated',
            message: enabled
                ? '🟢 AI Summarization Enabled by Administrator'
                : '🔴 AI Summarization Paused by Administrator (Direct Raw Mode)',
        });
        this.saveStateToDisk();
        this.broadcastTelemetry();
        return this.aiEnabled;
    }

    /**
     * Update Queue Ingestion Status
     */
    public static updateQueueMetrics(partial: Partial<QueueStatusMetrics>) {
        this.queueMetrics = { ...this.queueMetrics, ...partial };
        this.broadcastTelemetry();
    }

    /**
     * Increment Ingestion Funnel Metrics
     */
    public static incrementFunnel(
        key: 'rssScanned' | 'deduped' | 'llmSummarized' | 'directSaved' | 'dbInserted',
        count = 1
    ) {
        if (key === 'rssScanned') this.funnelMetrics.rssScannedToday += count;
        if (key === 'deduped') this.funnelMetrics.dedupedCandidatesToday += count;
        if (key === 'llmSummarized') this.funnelMetrics.llmSummarizedToday += count;
        if (key === 'directSaved') this.funnelMetrics.directSavedToday += count;
        if (key === 'dbInserted') this.funnelMetrics.dbInsertedToday += count;

        this.saveStateToDisk();
        this.broadcastTelemetry();
    }

    public static recordIngestCompletion(durationMs: number) {
        this.funnelMetrics.lastIngestDurationMs = durationMs;
        this.funnelMetrics.lastIngestAt = new Date().toISOString();
        this.saveStateToDisk();
        this.broadcastTelemetry();
    }

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

        this.saveStateToDisk();
        this.broadcastTelemetry();
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

        this.saveStateToDisk();
        this.broadcastTelemetry();
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
        this.saveStateToDisk();
        this.broadcastTelemetry();
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

        const loadAvg = os.loadavg();
        const cpuLoad1MinPercent = Math.min(100, Math.round((loadAvg[0] / (cpuCount || 1)) * 100));

        const totalMemBytes = os.totalmem();
        const freeMemBytes = os.freemem();
        const usedMemBytes = totalMemBytes - freeMemBytes;
        const usedMemPercent = Math.round((usedMemBytes / totalMemBytes) * 100);

        const procMem = process.memoryUsage();
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

        // Daily quota is 2,000,000 tokens on Groq free tier
        const dailyQuotaTotal = 2000000;
        const dailyQuotaUsedPercent = Math.min(100, Math.round((totalTokensToday / dailyQuotaTotal) * 1000) / 10);

        return {
            timestamp: new Date().toISOString(),
            aiEnabled: this.aiEnabled,
            system: sys,
            queue: this.queueMetrics,
            funnel: this.funnelMetrics,
            ai: {
                provider: 'Groq Cloud (LPU Accelerated)',
                dailyQuotaTotal,
                dailyQuotaUsedPercent,
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
