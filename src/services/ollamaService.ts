import { env } from '../config/env';

export interface OllamaStatus {
    status: 'ready' | 'downloading' | 'starting' | 'offline';
    model: string;
    progressPercent: number; // 0 - 100
    message: string;
    isPulling: boolean;
    details?: {
        version?: string;
        sizeBytes?: number;
        inMemory?: boolean;
        latencyMs?: number;
        completedBytes?: number;
        totalBytes?: number;
        lastChecked: string;
    };
}

export class OllamaService {
    private static cachedStatus: OllamaStatus | null = null;
    private static lastCheckTime = 0;
    private static readonly CACHE_TTL_MS = 2500; // 2.5 second cache to avoid hammer

    // Pull tracking state
    private static isPulling = false;
    private static pullProgress = 0;
    private static pullStatusMessage = 'Idle';
    private static completedBytes = 0;
    private static totalBytes = 397821319; // ~398 MB default for Qwen2.5-0.5B

    /**
     * Get the native daemon base URL (stripping /v1 if present)
     */
    public static getNativeBaseUrl(): string {
        const raw = env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
        return raw.replace(/\/v1\/?$/, '');
    }

    /**
     * Inspect Ollama health, installed model tags, and memory residency.
     */
    public static async getStatus(forceFresh = false): Promise<OllamaStatus> {
        const now = Date.now();
        if (!forceFresh && this.cachedStatus && (now - this.lastCheckTime) < this.CACHE_TTL_MS) {
            return this.cachedStatus;
        }

        const baseUrl = this.getNativeBaseUrl();
        const targetModel = (env.OLLAMA_MODEL || 'qwen2.5:0.5b').toLowerCase();
        const startTime = Date.now();

        try {
            // 1. Probe /api/version with a 2-second timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const versionRes = await fetch(`${baseUrl}/api/version`, {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' },
            }).catch((err) => {
                return null;
            });
            clearTimeout(timeoutId);

            if (!versionRes || !versionRes.ok) {
                const status: OllamaStatus = {
                    status: 'offline',
                    model: targetModel,
                    progressPercent: 0,
                    message: `Ollama daemon offline at ${baseUrl}. Cloud failover active (Groq + Mistral).`,
                    isPulling: false,
                    details: {
                        lastChecked: new Date().toISOString(),
                    },
                };
                this.cachedStatus = status;
                this.lastCheckTime = now;
                return status;
            }

            const versionData = await versionRes.json() as { version?: string };
            const version = versionData.version || 'unknown';

            // 2. Probe /api/tags to see if the target model is downloaded
            const tagsController = new AbortController();
            const tagsTimeoutId = setTimeout(() => tagsController.abort(), 2000);

            const tagsRes = await fetch(`${baseUrl}/api/tags`, {
                signal: tagsController.signal,
                headers: { 'Accept': 'application/json' },
            }).catch(() => null);
            clearTimeout(tagsTimeoutId);

            if (!tagsRes || !tagsRes.ok) {
                const status: OllamaStatus = {
                    status: 'starting',
                    model: targetModel,
                    progressPercent: 10,
                    message: `Ollama daemon online (v${version}), initializing API...`,
                    isPulling: this.isPulling,
                    details: {
                        version,
                        lastChecked: new Date().toISOString(),
                    },
                };
                this.cachedStatus = status;
                this.lastCheckTime = now;
                return status;
            }

            const tagsData = await tagsRes.json() as {
                models?: Array<{ name: string; model: string; size: number }>;
            };
            const models = tagsData.models || [];

            // Check if target model is present in tags
            const foundModel = models.find((m) => {
                const name = (m.name || '').toLowerCase();
                const model = (m.model || '').toLowerCase();
                return (
                    name === targetModel ||
                    name === `${targetModel}:latest` ||
                    model.startsWith(targetModel) ||
                    name.includes('qwen2.5:0.5b')
                );
            });

            if (foundModel) {
                // Model is fully installed! Check if it's currently loaded in memory via /api/ps
                let inMemory = false;
                try {
                    const psRes = await fetch(`${baseUrl}/api/ps`, { headers: { 'Accept': 'application/json' } });
                    if (psRes.ok) {
                        const psData = await psRes.json() as { models?: Array<{ name: string }> };
                        inMemory = (psData.models || []).some((m) =>
                            (m.name || '').toLowerCase().includes(targetModel)
                        );
                    }
                } catch {
                    // Ignore ps errors
                }

                // If a pull was previously tracked, reset it
                this.isPulling = false;
                this.pullProgress = 100;

                const status: OllamaStatus = {
                    status: 'ready',
                    model: targetModel,
                    progressPercent: 100,
                    message: `Qwen 2.5 0.5B downloaded & ready for 100% free local inference.`,
                    isPulling: false,
                    details: {
                        version,
                        sizeBytes: foundModel.size,
                        inMemory,
                        latencyMs: Date.now() - startTime,
                        lastChecked: new Date().toISOString(),
                    },
                };
                this.cachedStatus = status;
                this.lastCheckTime = now;
                return status;
            }

            // Model is NOT yet in /api/tags -> It is downloading or needs to be pulled
            if (this.isPulling) {
                const status: OllamaStatus = {
                    status: 'downloading',
                    model: targetModel,
                    progressPercent: this.pullProgress,
                    message: `Pulling ${targetModel} layers (${this.pullProgress}% - ${this.pullStatusMessage})...`,
                    isPulling: true,
                    details: {
                        version,
                        completedBytes: this.completedBytes,
                        totalBytes: this.totalBytes,
                        lastChecked: new Date().toISOString(),
                    },
                };
                this.cachedStatus = status;
                this.lastCheckTime = now;
                return status;
            }

            // If not actively pulling, initiate background pull automatically so user doesn't wait
            this.triggerPull(targetModel).catch((e) => {
                console.warn('[OllamaService] Auto-pull background error:', e);
            });

            const status: OllamaStatus = {
                status: 'downloading',
                model: targetModel,
                progressPercent: 5,
                message: `Initiating download of ${targetModel} (~398 MB)...`,
                isPulling: true,
                details: {
                    version,
                    lastChecked: new Date().toISOString(),
                },
            };
            this.cachedStatus = status;
            this.lastCheckTime = now;
            return status;
        } catch (error: any) {
            const status: OllamaStatus = {
                status: 'offline',
                model: targetModel,
                progressPercent: 0,
                message: `Failed to connect to Ollama at ${baseUrl}: ${error?.message || 'Network Error'}`,
                isPulling: false,
                details: {
                    lastChecked: new Date().toISOString(),
                },
            };
            this.cachedStatus = status;
            this.lastCheckTime = now;
            return status;
        }
    }

    /**
     * Stream pull request to Ollama daemon to download target model and track percentage in real-time.
     */
    public static async triggerPull(modelName?: string): Promise<boolean> {
        if (this.isPulling) {
            return true; // Already in progress
        }

        const targetModel = modelName || env.OLLAMA_MODEL || 'qwen2.5:0.5b';
        const baseUrl = this.getNativeBaseUrl();

        this.isPulling = true;
        this.pullProgress = 5;
        this.pullStatusMessage = 'Starting pull stream';
        this.completedBytes = 0;

        try {
            console.log(`[OllamaService] Initiating pull of model '${targetModel}' from ${baseUrl}/api/pull...`);
            const res = await fetch(`${baseUrl}/api/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: targetModel, stream: true }),
            });

            if (!res.ok || !res.body) {
                console.error(`[OllamaService] Pull request rejected with status ${res.status}`);
                this.isPulling = false;
                this.pullProgress = 0;
                this.pullStatusMessage = `Pull error: HTTP ${res.status}`;
                return false;
            }

            // Stream response reader
            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            const readStream = async () => {
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (!line.trim()) continue;
                            try {
                                const parsed = JSON.parse(line) as {
                                    status?: string;
                                    completed?: number;
                                    total?: number;
                                };

                                if (parsed.status) {
                                    this.pullStatusMessage = parsed.status;
                                }

                                if (parsed.total && parsed.completed) {
                                    this.totalBytes = parsed.total;
                                    this.completedBytes = parsed.completed;
                                    this.pullProgress = Math.min(
                                        99,
                                        Math.max(5, Math.round((parsed.completed / parsed.total) * 100))
                                    );
                                } else if (parsed.status?.includes('verifying') || parsed.status?.includes('writing')) {
                                    this.pullProgress = 98;
                                } else if (parsed.status === 'success') {
                                    this.pullProgress = 100;
                                    this.isPulling = false;
                                }
                            } catch {
                                // Ignore json parse errors for chunk boundaries
                            }
                        }
                    }

                    this.isPulling = false;
                    this.pullProgress = 100;
                    this.pullStatusMessage = 'Download complete';
                    this.cachedStatus = null; // Invalidate cache so next getStatus returns ready
                    console.log(`[OllamaService] Model '${targetModel}' successfully downloaded!`);
                } catch (streamErr) {
                    console.error('[OllamaService] Stream reading error:', streamErr);
                    this.isPulling = false;
                }
            };

            // Start reading asynchronously without blocking caller
            readStream();
            return true;
        } catch (err: any) {
            console.error('[OllamaService] Failed to trigger pull:', err?.message || err);
            this.isPulling = false;
            this.pullProgress = 0;
            this.pullStatusMessage = 'Failed to connect';
            return false;
        }
    }
}
