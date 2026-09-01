import { Request, Response } from 'express';
import TelemetryService from '../services/telemetryService.js';
import UniversalLlmService from '../services/universalLlmService.js';
import GeminiService from '../services/geminiService.js';
import { triggerManualIngest } from '../services/rssFetcher.js';
import { invalidateFeedCache } from '../services/cacheService.js';

export class DashboardController {
    /**
     * GET /api/v1/dashboard/stats
     * Return JSON telemetry metrics snapshot
     */
    public static async getStats(req: Request, res: Response): Promise<void> {
        try {
            const telemetry = await TelemetryService.getFullTelemetry();
            res.json({ success: true, data: telemetry });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * GET /api/v1/dashboard/stream
     * Real-Time Server-Sent Events (SSE) Stream
     * Eliminates HTTP polling and eliminates terminal GET request log spam!
     */
    public static async streamTelemetry(req: Request, res: Response): Promise<void> {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();

        TelemetryService.addSseClient(res);

        req.on('close', () => {
            TelemetryService.removeSseClient(res);
        });
    }

    /**
     * POST /api/v1/dashboard/toggle-ai
     * Toggle the global AI summarization kill-switch
     */
    public static async toggleAi(req: Request, res: Response): Promise<void> {
        try {
            const { enabled } = req.body;
            const current = TelemetryService.getAiEnabled();
            const target = typeof enabled === 'boolean' ? enabled : !current;
            const updated = TelemetryService.setAiEnabled(target);
            res.json({ success: true, aiEnabled: updated });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * POST /api/v1/dashboard/toggle-model
     * Toggle specific AI model on or off
     */
    public static async toggleModel(req: Request, res: Response): Promise<void> {
        try {
            const { model, enabled } = req.body;
            if (!model) {
                res.status(400).json({ success: false, error: 'Model parameter is required' });
                return;
            }
            const updated = TelemetryService.toggleModelStatus(model, enabled);
            res.json({ success: true, model, enabled: updated });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * POST /api/v1/dashboard/trigger-ingest
     * Manually trigger background RSS scraper on demand
     */
    public static async triggerIngest(req: Request, res: Response): Promise<void> {
        try {
            const result = await triggerManualIngest();
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * POST /api/v1/dashboard/clear-cache
     * Invalidate and purge news feed cache
     */
    public static async clearCache(req: Request, res: Response): Promise<void> {
        try {
            await invalidateFeedCache();
            res.json({ success: true, message: 'Redis / Memory Feed Cache purged successfully' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * POST /api/v1/dashboard/reset-metrics
     * Reset all model counters and metrics to clean 0 state
     */
    public static async resetMetrics(req: Request, res: Response): Promise<void> {
        try {
            TelemetryService.resetTelemetryMetrics();
            res.json({ success: true, message: 'All telemetry metrics and fleet counters reset to clean 0 state' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * POST /api/v1/dashboard/summarize-test
     * Interactive test summarization across Multi-Provider AI Mesh (supports exactOnly direct model testing)
     */
    public static async summarizeTest(req: Request, res: Response): Promise<void> {
        try {
            const { title, content, category, preferredProvider, preferredModel, exactOnly } = req.body;
            if (!title && !content) {
                res.status(400).json({ success: false, error: 'Title or Content is required' });
                return;
            }

            const result = await UniversalLlmService.summarizeNews({
                title: title || 'Breaking News Headline',
                content: content || title,
                category: category || 'National',
                preferredProvider: preferredProvider || undefined,
                preferredModel: preferredModel || undefined,
                exactOnly: exactOnly !== undefined ? exactOnly : !!preferredModel,
            });

            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * POST /api/v1/dashboard/translate-test
     * Interactive translation test via Gemini 3.5 Live Translate
     */
    public static async translateTest(req: Request, res: Response): Promise<void> {
        try {
            const { headline, story, bullets, targetLang } = req.body;
            const result = await GeminiService.translateStory({
                headline: headline || 'Breaking News',
                story: story || '',
                bullets: bullets || [],
                targetLang: targetLang || 'hi',
            });
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * POST /api/v1/dashboard/deepdive-test
     * Interactive deep dive test via Gemini 3 Flash Live
     */
    public static async deepdiveTest(req: Request, res: Response): Promise<void> {
        try {
            const { headline, content } = req.body;
            const result = await GeminiService.generateDeepDive({
                headline: headline || 'National Headline',
                content: content || headline,
            });
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * GET /dashboard
     * Render full modern dark-mode responsive HTML Web Dashboard
     */
    public static async renderDashboard(req: Request, res: Response): Promise<void> {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NewsFlow • Production Mission Control</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-base: #090D16;
            --bg-card: #0F172A;
            --bg-card-hover: #1E293B;
            --border-color: rgba(255, 255, 255, 0.08);
            --primary: #3B82F6;
            --primary-glow: rgba(59, 130, 246, 0.25);
            --accent: #8B5CF6;
            --success: #10B981;
            --warning: #F59E0B;
            --danger: #EF4444;
            --text-main: #F8FAFC;
            --text-sub: #94A3B8;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        body {
            background-color: var(--bg-base);
            color: var(--text-main);
            min-height: 100vh;
            padding: 24px;
        }

        .dashboard-container {
            max-width: 1440px;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            gap: 22px;
        }

        /* Top Header */
        .top-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 18px 24px;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            flex-wrap: wrap;
            gap: 16px;
        }

        .header-title-box h1 {
            font-size: 22px;
            font-weight: 800;
            background: linear-gradient(135deg, #60A5FA, #A78BFA);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .header-title-box p {
            font-size: 13px;
            color: var(--text-sub);
            margin-top: 3px;
        }

        .header-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }

        /* Header Buttons */
        .btn-action {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;
            outline: none;
            border: 1px solid var(--border-color);
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-main);
        }

        .btn-action:hover {
            background: rgba(255, 255, 255, 0.1);
            transform: translateY(-1px);
        }

        .btn-action:active {
            transform: scale(0.97);
        }

        .btn-ingest {
            background: linear-gradient(135deg, #2563EB, #1D4ED8);
            border-color: #3B82F6;
            color: #FFF;
        }

        .btn-ingest:hover {
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
        }

        /* Interactive AI Toggle Switch */
        .ai-toggle-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 18px;
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid rgba(16, 185, 129, 0.4);
            border-radius: 30px;
            font-size: 13px;
            font-weight: 800;
            color: var(--success);
            cursor: pointer;
            transition: all 0.25s ease;
            outline: none;
        }

        .ai-toggle-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25);
        }

        .ai-toggle-btn.disabled {
            background: rgba(239, 68, 68, 0.15);
            border-color: rgba(239, 68, 68, 0.4);
            color: var(--danger);
        }

        .ai-toggle-btn.disabled:hover {
            box-shadow: 0 4px 14px rgba(239, 68, 68, 0.25);
        }

        .status-dot {
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background-color: currentColor;
            box-shadow: 0 0 10px currentColor;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(0.95); opacity: 0.8; }
            50% { transform: scale(1.25); opacity: 1; }
            100% { transform: scale(0.95); opacity: 0.8; }
        }

        /* Metrics Grid */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
            gap: 16px;
        }

        .card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 14px;
            padding: 18px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            transition: transform 0.2s, border-color 0.2s;
        }

        .card:hover {
            border-color: rgba(255, 255, 255, 0.15);
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .card-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: var(--text-sub);
        }

        .card-badge {
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 12px;
            font-weight: 700;
        }

        .val-large {
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.5px;
        }

        .val-sub {
            font-size: 12px;
            color: var(--text-sub);
        }

        /* Progress Bar */
        .progress-bar-bg {
            width: 100%;
            height: 7px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 4px;
            overflow: hidden;
            margin-top: 4px;
        }

        .progress-bar-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.4s ease;
        }

        /* ─── Ingestion Funnel Pipeline ─── */
        .funnel-section {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 22px 24px;
        }

        .funnel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 8px;
        }

        .funnel-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 14px;
        }

        .funnel-step {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            position: relative;
        }

        .funnel-step-label {
            font-size: 11px;
            font-weight: 700;
            color: var(--text-sub);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .funnel-step-val {
            font-size: 24px;
            font-weight: 800;
            font-family: 'JetBrains Mono', monospace;
        }

        .funnel-step-sub {
            font-size: 11px;
            color: var(--text-sub);
        }

        /* Model Usage Table / Cards */
        .models-section {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 22px 24px;
        }

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 8px;
        }

        .section-title {
            font-size: 17px;
            font-weight: 800;
        }

        .models-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 14px;
        }

        .model-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .model-name {
            font-weight: 700;
            font-size: 13px;
            color: #60A5FA;
        }

        .model-stats-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: var(--text-sub);
        }

        .model-stats-val {
            font-weight: 700;
            color: var(--text-main);
            font-family: 'JetBrains Mono', monospace;
        }

        .model-toggle-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
            border: 1px solid rgba(16, 185, 129, 0.4);
            background: rgba(16, 185, 129, 0.15);
            color: #34D399;
            transition: all 0.2s;
            margin-top: 6px;
            width: 100%;
        }

        .model-toggle-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
        }

        .model-toggle-btn.disabled {
            border-color: rgba(239, 68, 68, 0.4);
            background: rgba(239, 68, 68, 0.15);
            color: #F87171;
        }

        .model-toggle-btn.disabled:hover {
            box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
        }

        /* Split View: Interactive Test Studio & Live Logs */
        .split-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }

        @media (max-width: 1024px) {
            .split-grid {
                grid-template-columns: 1fr;
            }
        }

        .studio-card, .logs-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 22px 24px;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        .input-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        label {
            font-size: 11px;
            font-weight: 700;
            color: var(--text-sub);
            text-transform: uppercase;
        }

        input, textarea, select {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 10px 14px;
            color: var(--text-main);
            font-size: 13px;
            outline: none;
            transition: border-color 0.2s;
        }

        input:focus, textarea:focus, select:focus {
            border-color: var(--primary);
        }

        textarea {
            resize: vertical;
            min-height: 80px;
        }

        .btn-primary {
            background: linear-gradient(135deg, #2563EB, #1D4ED8);
            color: #FFF;
            font-weight: 700;
            font-size: 14px;
            padding: 12px 20px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            transition: opacity 0.2s, transform 0.1s;
        }

        .btn-primary:hover {
            opacity: 0.92;
        }

        .btn-primary:active {
            transform: scale(0.98);
        }

        /* Output Box */
        .output-box {
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 12px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-size: 13px;
            line-height: 1.5;
        }

        .output-headline {
            font-size: 15px;
            font-weight: 800;
            color: #60A5FA;
        }

        .output-bullet {
            color: #E2E8F0;
            font-size: 12px;
            margin-top: 3px;
        }

        .output-meta {
            display: flex;
            gap: 16px;
            font-size: 11px;
            color: var(--text-sub);
            margin-top: 6px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding-top: 6px;
        }

        /* Logs */
        .logs-scroll {
            height: 380px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding-right: 6px;
        }

        .log-item {
            padding: 10px 14px;
            background: rgba(255, 255, 255, 0.03);
            border-left: 3px solid var(--primary);
            border-radius: 6px;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-family: 'JetBrains Mono', monospace;
        }

        .log-msg {
            color: #E5E7EB;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 80%;
        }

        .log-time {
            color: var(--text-sub);
            font-size: 10px;
        }
    </style>
</head>
<body>
    <div class="dashboard-container">
        <!-- Top Header -->
        <header class="top-header">
            <div class="header-title-box">
                <h1>⚡ NewsFlow • Mission Control</h1>
                <p>Real-Time VPS Telemetry, Ingestion Funnel & Groq AI Model Engine</p>
            </div>
            <div class="header-actions">
                <button class="btn-action btn-ingest" id="btn-trigger-ingest" onclick="triggerIngest()">
                    <span>⚡ Trigger Ingest Now</span>
                </button>
                <button class="btn-action" onclick="flushCache()">
                    <span>🧹 Flush Cache</span>
                </button>
                <button class="btn-action" onclick="resetTelemetryFleet()" style="border-color: rgba(239, 68, 68, 0.35); color: #F87171;">
                    <span>🔄 Reset AI Fleet</span>
                </button>
                <button id="ai-toggle-btn" class="ai-toggle-btn" onclick="toggleAiSwitch()">
                    <span class="status-dot"></span>
                    <span id="ai-toggle-label">🟢 AI Summarizer: ACTIVE</span>
                </button>
            </div>
        </header>

        <!-- Metrics Grid -->
        <div class="metrics-grid">
            <!-- CPU Utilization -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">CPU Utilization</span>
                    <span class="card-badge" id="cpu-badge" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA;">8 Cores</span>
                </div>
                <div class="val-large" id="cpu-percent">0%</div>
                <div class="val-sub" id="cpu-model">Intel Core Processor</div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" id="cpu-bar" style="width: 0%; background: linear-gradient(90deg, #3B82F6, #60A5FA);"></div>
                </div>
            </div>

            <!-- Server RAM -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">Server Memory (RAM)</span>
                    <span class="card-badge" id="ram-badge" style="background: rgba(16, 185, 129, 0.15); color: #34D399;">0% Used</span>
                </div>
                <div class="val-large" id="ram-used">0 GB</div>
                <div class="val-sub" id="ram-total">Total: -- GB • Heap: -- MB</div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" id="ram-bar" style="width: 0%; background: linear-gradient(90deg, #10B981, #34D399);"></div>
                </div>
            </div>

            <!-- 2,000,000 Groq Quota Progress Gauge -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">Daily 2M Token Quota</span>
                    <span class="card-badge" id="quota-badge" style="background: rgba(139, 92, 246, 0.15); color: #A78BFA;">0% Used</span>
                </div>
                <div class="val-large" id="total-tokens" style="color: #A78BFA;">0</div>
                <div class="val-sub" id="quota-details">0 / 2,000,000 Daily Tokens</div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" id="quota-bar" style="width: 0%; background: linear-gradient(90deg, #8B5CF6, #C084FC);"></div>
                </div>
            </div>

            <!-- BullMQ Queue Ingestion Monitor -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">🐂 BullMQ Ingest Queue</span>
                    <span class="card-badge" id="queue-status-badge" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA;">IDLE</span>
                </div>
                <div class="val-large" id="queue-pending" style="color: #38BDF8;">0 Pending</div>
                <div class="val-sub" id="queue-details">Active: 0 • Completed: 0</div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" id="queue-bar" style="width: 0%; background: linear-gradient(90deg, #0284C7, #38BDF8);"></div>
                </div>
            </div>

            <!-- Server Uptime -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">Server Uptime</span>
                    <span class="card-badge" style="background: rgba(245, 158, 11, 0.15); color: #FBBF24;">Node.js</span>
                </div>
                <div class="val-large" id="uptime-val" style="color: #FBBF24;">0m 0s</div>
                <div class="val-sub" id="node-env">win32 • v24.10.0</div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: 100%; background: linear-gradient(90deg, #F59E0B, #FBBF24);"></div>
                </div>
            </div>
        </div>

        <!-- Real-Time Ingestion Funnel Pipeline -->
        <section class="funnel-section">
            <div class="funnel-header">
                <h2 class="section-title">📊 Real-Time Ingestion Funnel & Routing Breakdown</h2>
                <span class="val-sub" id="funnel-timing">Last Run: Idle</span>
            </div>
            <div class="funnel-grid">
                <!-- Step 1: Scanned -->
                <div class="funnel-step">
                    <span class="funnel-step-label">1. RSS Scanned</span>
                    <div class="funnel-step-val" id="funnel-scanned" style="color: #60A5FA;">0</div>
                    <span class="funnel-step-sub">Raw articles parsed</span>
                </div>
                <!-- Step 2: Deduped -->
                <div class="funnel-step">
                    <span class="funnel-step-label">2. Fresh Candidates</span>
                    <div class="funnel-step-val" id="funnel-deduped" style="color: #38BDF8;">0</div>
                    <span class="funnel-step-sub">After SHA-256 filter</span>
                </div>
                <!-- Step 3: LLM Summarized -->
                <div class="funnel-step">
                    <span class="funnel-step-label">3. 🧠 Multi-Model AI Summarized</span>
                    <div class="funnel-step-val" id="funnel-llm" style="color: #A78BFA;">0</div>
                    <span class="funnel-step-sub">60-word stories generated</span>
                </div>
                <!-- Step 4: Direct Saved -->
                <div class="funnel-step">
                    <span class="funnel-step-label">4. ⏩ Direct Saved (0 Tokens)</span>
                    <div class="funnel-step-val" id="funnel-direct" style="color: #34D399;">0</div>
                    <span class="funnel-step-sub">RSS crisp / AI Paused</span>
                </div>
                <!-- Step 5: Database Saved -->
                <div class="funnel-step">
                    <span class="funnel-step-label">5. 💾 Saved to PostgreSQL</span>
                    <div class="funnel-step-val" id="funnel-db" style="color: #FBBF24;">0</div>
                    <span class="funnel-step-sub">Active & cached</span>
                </div>
            </div>
        </section>

        <!-- Multi-Model AI Accounting Pool -->
        <section class="models-section">
            <div class="section-header">
                <h2 class="section-title">🧠 Multi-Model AI Auto-Rotation & Failover Pool</h2>
                <span class="val-sub">Groq Cloud LPU (Primary Ultra-Fast) • Mistral AI Serverless</span>
            </div>
            <div class="models-list" id="models-container">
                <!-- Populated dynamically via SSE -->
            </div>
        </section>

        <!-- Split View: Interactive Test Studio & Live Logs -->
        <div class="split-grid">
            <!-- Test Studio -->
            <div class="studio-card">
                <h2 class="section-title">🧪 Live AI News Summarizer Studio</h2>
                <div class="input-group">
                    <label>Headline / Story Title</label>
                    <input type="text" id="test-title" placeholder="e.g. RBI announces new benchmark repo rate" value="India Launches Next-Generation Clean Energy Grid Project">
                </div>
                <div class="input-group">
                    <label>Preferred Model (Direct Test / Zero Fallback)</label>
                    <select id="test-model">
                        <option value="">Auto-Rotate (Groq LPU ↔ Mistral AI Balanced Fleet)</option>
                        <optgroup label="Groq Cloud LPU">
                            <option value="llama-3.3-70b-versatile">Groq LLaMA 3.3 70B (llama-3.3-70b-versatile)</option>
                            <option value="llama-3.1-8b-instant">Groq LLaMA 3.1 8B (llama-3.1-8b-instant)</option>
                            <option value="mixtral-8x7b-32768">Groq Mixtral 8x7B (mixtral-8x7b-32768)</option>
                            <option value="gemma2-9b-it">Google Gemma 9B on Groq (gemma2-9b-it)</option>
                        </optgroup>
                        <optgroup label="Mistral AI Serverless">
                            <option value="mistral-small-latest">Mistral Small (mistral-small-latest)</option>
                            <option value="open-mistral-nemo">Mistral NeMo 12B (open-mistral-nemo)</option>
                            <option value="mistral-large-latest">Mistral Large (mistral-large-latest)</option>
                        </optgroup>
                    </select>
                </div>
                <div class="input-group">
                    <label>Raw News Text to Summarize</label>
                    <textarea id="test-content" placeholder="Paste raw news text...">The Ministry of New and Renewable Energy today inaugurated the mega Clean Energy Grid project across five southern states. The initiative aims to add 15,000 MW of renewable solar and wind capacity by 2027. Officials stated that this project will significantly cut carbon emissions and create over 40,000 green jobs in manufacturing and transmission infrastructure.</textarea>
                </div>
                <button class="btn-primary" id="btn-run-test" onclick="runSummarizeTest()">⚡ Generate Inshorts 60-Word Story</button>

                <!-- Output Box -->
                <div class="output-box" id="test-output" style="display: none;">
                    <div class="output-headline" id="res-headline">Headline Output</div>
                    <div id="res-story">Story narrative...</div>
                    <div id="res-bullets"></div>
                    <div class="output-meta">
                        <span id="res-model">Model: --</span>
                        <span id="res-tokens">Tokens: --</span>
                        <span id="res-latency">Latency: --ms</span>
                    </div>
                </div>
            </div>

            <!-- Live Logs -->
            <div class="logs-card">
                <div class="section-header" style="margin-bottom: 0;">
                    <h2 class="section-title">🚨 Live Request & Error Log</h2>
                    <span class="val-sub">Real-time SSE Stream (0 Polling Spam)</span>
                </div>
                <div class="logs-scroll" id="logs-container">
                    <div class="log-item">
                        <span class="log-msg">Connecting to Live SSE Stream...</span>
                        <span class="log-time">Just now</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let currentAiEnabled = true;

        function formatBytes(mb) {
            if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB';
            return mb + ' MB';
        }

        function formatUptime(seconds) {
            const d = Math.floor(seconds / (3600*24));
            const h = Math.floor((seconds % (3600*24)) / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            if (d > 0) return \`\${d}d \${h}h \${m}m\`;
            if (h > 0) return \`\${h}h \${m}m \${s}s\`;
            return \`\${m}m \${s}s\`;
        }

        async function toggleAiSwitch() {
            try {
                const res = await fetch('/api/v1/dashboard/toggle-ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: !currentAiEnabled })
                });
                const json = await res.json();
                if (json.success) {
                    currentAiEnabled = json.aiEnabled;
                    updateAiButtonUi(currentAiEnabled);
                }
            } catch (err) {
                alert('Failed to toggle AI state: ' + err.message);
            }
        }

        async function toggleModel(modelName) {
            try {
                const res = await fetch('/api/v1/dashboard/toggle-model', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: modelName })
                });
                const json = await res.json();
                if (!json.success) {
                    alert('Failed to toggle model: ' + json.error);
                }
            } catch (e) {
                alert('Toggle error: ' + e.message);
            }
        }

        async function triggerIngest() {
            const btn = document.getElementById('btn-trigger-ingest');
            btn.disabled = true;
            btn.innerHTML = '<span>⏳ Ingesting Feeds...</span>';
            try {
                const res = await fetch('/api/v1/dashboard/trigger-ingest', { method: 'POST' });
                const json = await res.json();
                alert(json.message || 'Ingest started');
            } catch (e) {
                alert('Failed to trigger ingest: ' + e.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<span>⚡ Trigger Ingest Now</span>';
            }
        }

        async function flushCache() {
            try {
                const res = await fetch('/api/v1/dashboard/clear-cache', { method: 'POST' });
                const json = await res.json();
                alert(json.message || 'Cache flushed');
            } catch (e) {
                alert('Failed to flush cache: ' + e.message);
            }
        }

        async function resetTelemetryFleet() {
            if (!confirm('Reset all AI fleet metrics and align to clean 0 state?')) return;
            try {
                const res = await fetch('/api/v1/dashboard/reset-metrics', { method: 'POST' });
                const json = await res.json();
                alert(json.message || 'AI Fleet Reset');
            } catch (e) {
                alert('Failed to reset metrics: ' + e.message);
            }
        }

        function updateAiButtonUi(enabled) {
            const btn = document.getElementById('ai-toggle-btn');
            const label = document.getElementById('ai-toggle-label');
            if (enabled) {
                btn.classList.remove('disabled');
                label.textContent = '🟢 AI Summarizer: ACTIVE';
            } else {
                btn.classList.add('disabled');
                label.textContent = '🔴 AI Summarizer: PAUSED (Direct Save)';
            }
        }

        function renderTelemetryData(d) {
            // AI Toggle state
            currentAiEnabled = d.aiEnabled;
            updateAiButtonUi(currentAiEnabled);

            // CPU
            document.getElementById('cpu-percent').textContent = d.system.cpu.loadPercent + '%';
            document.getElementById('cpu-model').textContent = d.system.cpu.model;
            document.getElementById('cpu-badge').textContent = d.system.cpu.cores + ' Cores';
            document.getElementById('cpu-bar').style.width = Math.min(100, d.system.cpu.loadPercent) + '%';

            // RAM
            document.getElementById('ram-used').textContent = formatBytes(d.system.memory.usedMB);
            document.getElementById('ram-total').textContent = \`Total: \${formatBytes(d.system.memory.totalMB)} • Heap: \${d.system.memory.processHeapUsedMB} MB\`;
            document.getElementById('ram-badge').textContent = d.system.memory.usedPercent + '% Used';
            document.getElementById('ram-bar').style.width = d.system.memory.usedPercent + '%';

            // Daily 2M Quota
            document.getElementById('total-tokens').textContent = d.ai.totalTokensToday.toLocaleString();
            document.getElementById('quota-details').textContent = \`\${d.ai.totalTokensToday.toLocaleString()} / 2,000,000 Daily Tokens (\${d.ai.dailyQuotaUsedPercent}%)\`;
            document.getElementById('quota-badge').textContent = \`\${d.ai.dailyQuotaUsedPercent}% Used\`;
            document.getElementById('quota-bar').style.width = Math.min(100, d.ai.dailyQuotaUsedPercent) + '%';

            // Funnel Metrics
            if (d.funnel) {
                document.getElementById('funnel-scanned').textContent = (d.funnel.rssScannedToday || 0).toLocaleString();
                document.getElementById('funnel-deduped').textContent = (d.funnel.dedupedCandidatesToday || 0).toLocaleString();
                document.getElementById('funnel-llm').textContent = (d.funnel.llmSummarizedToday || 0).toLocaleString();
                document.getElementById('funnel-direct').textContent = (d.funnel.directSavedToday || 0).toLocaleString();
                document.getElementById('funnel-db').textContent = (d.funnel.dbInsertedToday || 0).toLocaleString();

                if (d.funnel.lastIngestAt) {
                    const durSec = ((d.funnel.lastIngestDurationMs || 0) / 1000).toFixed(1);
                    document.getElementById('funnel-timing').textContent = \`Last Batch: \${durSec}s at \${new Date(d.funnel.lastIngestAt).toLocaleTimeString()}\`;
                }
            }

            // BullMQ Queue Ingestion Metrics
            if (d.queue) {
                const isIngesting = d.queue.isIngesting;
                const badge = document.getElementById('queue-status-badge');
                badge.textContent = isIngesting ? 'INGESTING LIVE' : 'IDLE';
                badge.style.background = isIngesting ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)';
                badge.style.color = isIngesting ? '#34D399' : '#60A5FA';

                document.getElementById('queue-pending').textContent = \`\${d.queue.pendingArticles || 0} Pending\`;
                document.getElementById('queue-details').textContent = \`Active: \${d.queue.activeJobs || 0} • Completed: \${d.queue.completedToday || 0}\`;
                document.getElementById('queue-bar').style.width = isIngesting ? '80%' : '0%';
            }

            // Uptime
            document.getElementById('uptime-val').textContent = formatUptime(d.system.server.processUptimeSeconds);
            document.getElementById('node-env').textContent = \`\${d.system.server.platform} (\${d.system.server.arch}) • \${d.system.server.nodeVersion}\`;

            // Models List
            const modelsContainer = document.getElementById('models-container');
            modelsContainer.innerHTML = d.ai.models.map(m => {
                const isPaused = m.status === 'rate_limited' || m.status === 'error';
                const statusColor = isPaused ? '#F59E0B' : '#10B981';
                const statusLabel = isPaused ? 'PAUSED / OFF' : 'ACTIVE (READY)';
                const btnLabel = isPaused ? '▶️ Click to Enable' : '⏸️ Click to Pause';
                const btnClass = isPaused ? 'disabled' : '';
                return \`
                    <div class="model-card">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span class="model-name">\${m.displayName}</span>
                            <span style="font-size: 10px; font-weight: 800; color: \${statusColor};">\${statusLabel}</span>
                        </div>
                        <div class="model-stats-row">
                            <span>Requests Today</span>
                            <span class="model-stats-val">\${m.requestsToday}</span>
                        </div>
                        <div class="model-stats-row">
                            <span>Tokens Used</span>
                            <span class="model-stats-val">\${m.totalTokensToday.toLocaleString()}</span>
                        </div>
                        <div class="model-stats-row">
                            <span>Avg Latency</span>
                            <span class="model-stats-val">\${m.lastLatencyMs}ms</span>
                        </div>
                        <button class="model-toggle-btn \${btnClass}" onclick="toggleModel('\${m.model}')">
                            \${btnLabel}
                        </button>
                    </div>
                \`;
            }).join('');

            // Recent Logs
            const logsContainer = document.getElementById('logs-container');
            if (d.recentLogs.length > 0) {
                logsContainer.innerHTML = d.recentLogs.map(l => {
                    const icon = l.status === 'success' ? '🟢' : l.status === 'rotated' ? '🔄' : '🔴';
                    const time = new Date(l.timestamp).toLocaleTimeString();
                    return \`
                        <div class="log-item">
                            <span class="log-msg">\${icon} \${l.message}</span>
                            <span class="log-time">\${time}</span>
                        </div>
                    \`;
                }).join('');
            }
        }

        // ─── Real-Time Server-Sent Events (SSE) Stream ───
        function startEventSourceStream() {
            try {
                const eventSource = new EventSource('/api/v1/dashboard/stream');
                eventSource.onmessage = (event) => {
                    try {
                        const d = JSON.parse(event.data);
                        renderTelemetryData(d);
                    } catch (e) {
                        console.warn('SSE parse error:', e);
                    }
                };
                eventSource.onerror = () => {
                    // Fallback to fetch on connection hiccup
                    fetchFallback();
                };
            } catch {
                fetchFallback();
            }
        }

        async function fetchFallback() {
            try {
                const res = await fetch('/api/v1/dashboard/stats');
                const json = await res.json();
                if (json.success) renderTelemetryData(json.data);
            } catch {}
        }

        async function runSummarizeTest() {
            const btn = document.getElementById('btn-run-test');
            const title = document.getElementById('test-title').value;
            const content = document.getElementById('test-content').value;
            const preferredModel = document.getElementById('test-model').value;
            const outputBox = document.getElementById('test-output');

            btn.textContent = '⏳ Calling ' + (preferredModel || 'AI Mesh') + '...';
            btn.disabled = true;

            try {
                const res = await fetch('/api/v1/dashboard/summarize-test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, content, preferredModel, exactOnly: !!preferredModel }),
                });
                const json = await res.json();
                if (json.success) {
                    const data = json.data;
                    document.getElementById('res-headline').innerHTML = '<span style="color: #38BDF8;">' + data.headline + '</span>';
                    document.getElementById('res-story').textContent = data.crispyStory;
                    document.getElementById('res-bullets').innerHTML = data.bulletPoints.map(b => \`<div class="output-bullet">• \${b}</div>\`).join('');
                    document.getElementById('res-model').textContent = 'Model: ' + data.modelUsed;
                    document.getElementById('res-tokens').textContent = 'Tokens: ' + data.totalTokens;
                    document.getElementById('res-latency').textContent = 'Latency: ' + data.latencyMs + 'ms';
                    outputBox.style.display = 'flex';
                } else {
                    document.getElementById('res-headline').innerHTML = '<span style="color: #EF4444;">❌ Model Execution Error</span>';
                    document.getElementById('res-story').textContent = json.error || 'Provider returned an error';
                    document.getElementById('res-bullets').innerHTML = '';
                    document.getElementById('res-model').textContent = 'Target Model: ' + (preferredModel || 'Auto-Rotate');
                    document.getElementById('res-tokens').textContent = 'Status: Direct Call Failed (0 Tokens)';
                    document.getElementById('res-latency').textContent = 'No Fallback Used';
                    outputBox.style.display = 'flex';
                }
            } catch (e) {
                document.getElementById('res-headline').innerHTML = '<span style="color: #EF4444;">❌ Network / Server Error</span>';
                document.getElementById('res-story').textContent = e.message;
                document.getElementById('res-bullets').innerHTML = '';
                document.getElementById('res-model').textContent = 'Target Model: ' + (preferredModel || 'Auto-Rotate');
                document.getElementById('res-tokens').textContent = 'Status: Network Failed';
                document.getElementById('res-latency').textContent = '--';
                outputBox.style.display = 'flex';
            } finally {
                btn.textContent = '⚡ Generate Inshorts 60-Word Story';
                btn.disabled = false;
            }
        }

        // Initialize Live SSE Stream
        startEventSourceStream();
    </script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    }
}

export default DashboardController;
