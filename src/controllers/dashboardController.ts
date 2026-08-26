import { Request, Response } from 'express';
import TelemetryService from '../services/telemetryService.js';
import GroqService from '../services/groqService.js';

export class DashboardController {
    /**
     * GET /api/v1/dashboard/stats
     * Return JSON telemetry metrics
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
     * POST /api/v1/dashboard/summarize-test
     * Interactive test summarization from the dashboard
     */
    public static async summarizeTest(req: Request, res: Response): Promise<void> {
        try {
            const { title, content, category, preferredModel } = req.body;
            if (!title && !content) {
                res.status(400).json({ success: false, error: 'Title or Content is required' });
                return;
            }

            const result = await GroqService.summarizeNews({
                title: title || 'Breaking News Headline',
                content: content || title,
                category: category || 'National',
                preferredModel: preferredModel || undefined,
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
    <title>NewsFlow • Server & AI Telemetry Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-base: #0B0F19;
            --bg-card: #111827;
            --bg-card-hover: #1F2937;
            --border-color: rgba(255, 255, 255, 0.08);
            --primary: #3B82F6;
            --primary-glow: rgba(59, 130, 246, 0.25);
            --accent: #8B5CF6;
            --success: #10B981;
            --warning: #F59E0B;
            --danger: #EF4444;
            --text-main: #F9FAFB;
            --text-sub: #9CA3AF;
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
            max-width: 1400px;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        /* Top Header */
        .top-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
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
            margin-top: 4px;
        }

        .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            background: rgba(16, 185, 129, 0.12);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 30px;
            font-size: 13px;
            font-weight: 700;
            color: var(--success);
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: var(--success);
            box-shadow: 0 0 10px var(--success);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(0.95); opacity: 0.8; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(0.95); opacity: 0.8; }
        }

        /* Grid Layout */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }

        .card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
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
            font-size: 13px;
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
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -0.5px;
        }

        .val-sub {
            font-size: 13px;
            color: var(--text-sub);
        }

        /* Progress Bar */
        .progress-bar-bg {
            width: 100%;
            height: 8px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 4px;
            overflow: hidden;
            margin-top: 6px;
        }

        .progress-bar-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.4s ease;
        }

        /* Model Usage Table / Cards */
        .models-section {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 24px;
        }

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 18px;
        }

        .section-title {
            font-size: 18px;
            font-weight: 800;
        }

        .models-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 16px;
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
            font-size: 14px;
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

        /* Interactive Studio & Live Logs Split */
        .split-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
        }

        @media (max-width: 1024px) {
            .split-grid {
                grid-template-columns: 1fr;
            }
        }

        /* Test Studio */
        .studio-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .input-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        label {
            font-size: 12px;
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
            min-height: 90px;
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

        .output-box {
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 14px;
            font-size: 13px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .output-headline {
            font-weight: 800;
            color: #60A5FA;
            font-size: 14px;
        }

        .output-bullet {
            display: flex;
            gap: 8px;
            color: var(--text-sub);
        }

        .output-meta {
            display: flex;
            gap: 12px;
            font-size: 11px;
            color: #A78BFA;
            font-family: 'JetBrains Mono', monospace;
            padding-top: 8px;
            border-top: 1px solid var(--border-color);
        }

        /* Logs Table */
        .logs-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            max-height: 580px;
            overflow: hidden;
        }

        .logs-scroll {
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding-right: 6px;
        }

        .log-item {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 10px 14px;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .log-msg {
            font-family: 'JetBrains Mono', monospace;
            color: var(--text-main);
            max-width: 70%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .log-time {
            color: var(--text-sub);
            font-size: 11px;
        }
    </style>
</head>
<body>
    <div class="dashboard-container">
        <!-- Top Header -->
        <header class="top-header">
            <div class="header-title-box">
                <h1>⚡ NewsFlow • Server & AI Telemetry</h1>
                <p>Real-time VPS Resource Health, Groq Multi-Model Accounting & AI Summarization Engine</p>
            </div>
            <div class="status-pill">
                <div class="status-dot"></div>
                SYSTEM LIVE & HEALTHY
            </div>
        </header>

        <!-- System & AI Metrics Grid -->
        <div class="metrics-grid">
            <!-- CPU Card -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">CPU Utilization</span>
                    <span id="cpu-badge" class="card-badge" style="background: rgba(59,130,246,0.2); color: #60A5FA;">-- Cores</span>
                </div>
                <div class="val-large" id="cpu-percent">0%</div>
                <div class="val-sub" id="cpu-model">Detecting CPU...</div>
                <div class="progress-bar-bg">
                    <div id="cpu-bar" class="progress-bar-fill" style="width: 0%; background: #3B82F6;"></div>
                </div>
            </div>

            <!-- RAM Memory Card -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">Server Memory (RAM)</span>
                    <span id="ram-badge" class="card-badge" style="background: rgba(16,185,129,0.2); color: #10B981;">0% Used</span>
                </div>
                <div class="val-large" id="ram-used">0 MB</div>
                <div class="val-sub" id="ram-total">Total: 0 MB | Heap: 0 MB</div>
                <div class="progress-bar-bg">
                    <div id="ram-bar" class="progress-bar-fill" style="width: 0%; background: #10B981;"></div>
                </div>
            </div>

            <!-- Tokens Today Card -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">Groq Tokens Today</span>
                    <span class="card-badge" style="background: rgba(139,92,246,0.2); color: #A78BFA;">$0 Cost Tier</span>
                </div>
                <div class="val-large" id="total-tokens">0</div>
                <div class="val-sub" id="total-requests">0 AI Requests Completed</div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: 100%; background: #8B5CF6;"></div>
                </div>
            </div>

            <!-- Process & Uptime Card -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">Server Uptime</span>
                    <span class="card-badge" style="background: rgba(245,158,11,0.2); color: #F59E0B;">Node.js</span>
                </div>
                <div class="val-large" id="uptime-val">0s</div>
                <div class="val-sub" id="node-env">Platform: Linux • Node.js</div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: 100%; background: #F59E0B;"></div>
                </div>
            </div>
        </div>

        <!-- Groq Multi-Model Accounting Pool -->
        <section class="models-section">
            <div class="section-header">
                <h2 class="section-title">🤖 Groq Multi-Model Auto-Rotation Pool</h2>
                <span class="val-sub">Automatic 429 Failover & Token Accounting</span>
            </div>
            <div class="models-list" id="models-container">
                <!-- Populated dynamically via JS -->
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
                    <label>Preferred Model (or Auto-Rotate)</label>
                    <select id="test-model">
                        <option value="">Auto-Rotate (Tier 1 Priority: Llama 3.3 70B)</option>
                        <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Primary Editor)</option>
                        <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Sub-150ms)</option>
                        <option value="qwen/qwen3.8-27b">qwen/qwen3.8-27b (High Accuracy)</option>
                        <option value="gemma2-9b-it">gemma2-9b-it (Google Compact)</option>
                        <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 (MoE Deep)</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>Raw News Text to Summarize</label>
                    <textarea id="test-content" placeholder="Paste full raw news article here...">The Ministry of New and Renewable Energy today inaugurated the mega Clean Energy Grid project across five southern states. The initiative aims to add 15,000 MW of renewable solar and wind capacity by 2027. Officials stated that this project will significantly cut carbon emissions and create over 40,000 green jobs in manufacturing and transmission infrastructure.</textarea>
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
                    <span class="val-sub">Auto-refreshes every 2.5s</span>
                </div>
                <div class="logs-scroll" id="logs-container">
                    <div class="log-item">
                        <span class="log-msg">Initializing telemetry stream...</span>
                        <span class="log-time">Just now</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
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

        async function fetchTelemetry() {
            try {
                const res = await fetch('/api/v1/dashboard/stats');
                const json = await res.json();
                if (!json.success) return;
                const d = json.data;

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

                // Tokens & Requests
                document.getElementById('total-tokens').textContent = d.ai.totalTokensToday.toLocaleString();
                document.getElementById('total-requests').textContent = \`\${d.ai.totalRequestsToday} AI Requests Completed (\${d.ai.totalErrorsToday} Errors)\`;

                // Uptime
                document.getElementById('uptime-val').textContent = formatUptime(d.system.server.processUptimeSeconds);
                document.getElementById('node-env').textContent = \`\${d.system.server.platform} (\${d.system.server.arch}) • \${d.system.server.nodeVersion}\`;

                // Models List
                const modelsContainer = document.getElementById('models-container');
                modelsContainer.innerHTML = d.ai.models.map(m => {
                    const statusColor = m.status === 'rate_limited' ? '#F59E0B' : m.status === 'error' ? '#EF4444' : '#10B981';
                    const statusLabel = m.status === 'rate_limited' ? 'RATE LIMITED (RESTING)' : m.status === 'error' ? 'OFFLINE' : 'READY (ACTIVE)';
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
            } catch (err) {
                console.warn('Telemetry fetch failed:', err);
            }
        }

        async function runSummarizeTest() {
            const btn = document.getElementById('btn-run-test');
            const title = document.getElementById('test-title').value;
            const content = document.getElementById('test-content').value;
            const preferredModel = document.getElementById('test-model').value;
            const outputBox = document.getElementById('test-output');

            btn.textContent = '⏳ Summarizing with Groq LPU...';
            btn.disabled = true;

            try {
                const res = await fetch('/api/v1/dashboard/summarize-test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, content, preferredModel }),
                });
                const json = await res.json();
                if (json.success) {
                    const data = json.data;
                    document.getElementById('res-headline').textContent = data.headline;
                    document.getElementById('res-story').textContent = data.crispyStory;
                    document.getElementById('res-bullets').innerHTML = data.bulletPoints.map(b => \`<div class="output-bullet">• \${b}</div>\`).join('');
                    document.getElementById('res-model').textContent = 'Model: ' + data.modelUsed;
                    document.getElementById('res-tokens').textContent = 'Tokens: ' + data.totalTokens;
                    document.getElementById('res-latency').textContent = 'Latency: ' + data.latencyMs + 'ms';
                    outputBox.style.display = 'flex';
                } else {
                    alert('Error: ' + json.error);
                }
            } catch (e) {
                alert('Test failed: ' + e.message);
            } finally {
                btn.textContent = '⚡ Generate Inshorts 60-Word Story';
                btn.disabled = false;
                fetchTelemetry();
            }
        }

        // Initial fetch & interval
        fetchTelemetry();
        setInterval(fetchTelemetry, 2500);
    </script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    }
}

export default DashboardController;
