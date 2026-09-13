import { Request, Response } from 'express';
import { TTSService } from '../services/ttsService';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const AVAILABLE_NEURAL_VOICES = [
    { id: 'en-IN-NeerjaNeural', name: 'Neerja (Indian English - Studio Female)', gender: 'Female', locale: 'en-IN' },
    { id: 'en-IN-PrabhatNeural', name: 'Prabhat (Indian English - Broadcast Male)', gender: 'Male', locale: 'en-IN' },
    { id: 'en-US-JennyNeural', name: 'Jenny (US English - Warm Female)', gender: 'Female', locale: 'en-US' },
    { id: 'en-US-GuyNeural', name: 'Guy (US English - News Anchor Male)', gender: 'Male', locale: 'en-US' },
    { id: 'en-GB-SoniaNeural', name: 'Sonia (British English - Calm Female)', gender: 'Female', locale: 'en-GB' },
];

export class SpeechController {
    /**
     * POST /api/v1/speech/synthesize
     * Body: { text: string, voice?: string, rate?: string, pitch?: string }
     */
    public static async synthesize(req: Request, res: Response): Promise<void> {
        try {
            const { text, voice, rate, pitch, lang } = req.body;

            if (!text || typeof text !== 'string' || !text.trim()) {
                res.status(400).json({
                    success: false,
                    error: 'Text field is required for speech synthesis.',
                });
                return;
            }

            const detected = TTSService.detectLanguageFromText(text);
            const chosenVoice = voice && voice !== 'en-IN-NeerjaNeural'
                ? voice
                : (detected.lang !== 'en' ? detected.voice : (lang ? TTSService.getVoiceForLanguage(lang) : 'en-IN-NeerjaNeural'));
            const effectiveLang = lang || detected.lang || 'en';

            const startTime = Date.now();
            console.log(`\n===============================================================`);
            console.log(`🎧 [VOICE ENGINE DISPATCH] >>> ENGINE: MICROSOFT EDGE TTS <<<`);
            console.log(`   • Voice: ${chosenVoice} (Detected Lang: ${effectiveLang})`);
            console.log(`   • Text Length: ${text.length} characters`);
            console.log(`   • Snippet: "${text.slice(0, 70)}..."`);
            console.log(`===============================================================`);

            const speechData = await TTSService.getSpeechAudio(
                text.trim(),
                chosenVoice,
                rate || '+0%',
                pitch || '+0Hz'
            );

            const elapsedMs = Date.now() - startTime;
            console.log(`🎉 [EDGE TTS COMPLETE] Generated ${Math.round(speechData.audioBase64.length / 1024)} KB audio in ${elapsedMs}ms (Voice: ${chosenVoice} | Cached: ${speechData.cached})\n`);

            res.status(200).json({
                success: true,
                voice: chosenVoice,
                durationMs: speechData.durationMs,
                wordBoundaries: speechData.wordBoundaries,
                audioBase64: speechData.audioBase64,
                cached: speechData.cached,
                latencyMs: elapsedMs,
            });
        } catch (err: any) {
            console.error('❌ [Speech API] Synthesize error:', err);
            res.status(500).json({
                success: false,
                error: err.message || 'Speech synthesis failed.',
            });
        }
    }

    /**
     * POST /api/v1/speech/gemini-s2s
     * Body: { text: string, voicePersona?: string, lang?: string }
     * Pure Audio-to-Audio (Speech-to-Speech) pipeline
     */
    public static async geminiS2S(req: Request, res: Response): Promise<void> {
        try {
            const { text, voicePersona, voiceName, lang } = req.body;
            if (!text || typeof text !== 'string' || !text.trim()) {
                res.status(400).json({ success: false, error: 'Text is required.' });
                return;
            }

            const { GeminiLiveSpeechService } = await import('../services/geminiLiveSpeechService.js');
            const result = await GeminiLiveSpeechService.processSpeechToSpeech({
                text: text.trim(),
                voicePersona: voicePersona || voiceName || 'Aoede',
                targetLang: lang || 'en',
            });

            res.status(200).json({
                success: true,
                voice: result.voiceUsed,
                audioBase64: result.audioBase64,
                mimeType: result.mimeType,
                durationMs: result.durationMs,
                wordBoundaries: result.wordBoundaries,
                cached: result.cached,
                latencyMs: result.latencyMs,
            });
        } catch (err: any) {
            console.error('❌ [Gemini S2S API] error:', err.message);
            res.status(500).json({
                success: false,
                error: err.message || 'Gemini S2S audio synthesis failed.',
            });
        }
    }

    /**
     * POST /api/v1/speech/gemini-synthesize
     * Body: { text: string, voiceName?: string, lang?: string }
     */
    public static async geminiSynthesize(req: Request, res: Response): Promise<void> {
        return SpeechController.geminiS2S(req, res);
    }

    /**
     * GET /api/v1/speech/stream?text=...&voice=...
     * Returns audio/mpeg streaming directly for native mobile players
     */
    public static async stream(req: Request, res: Response): Promise<void> {
        try {
            const text = (req.query.text as string) || '';
            const voice = (req.query.voice as string) || 'en-IN-NeerjaNeural';
            const rate = (req.query.rate as string) || '+0%';
            const pitch = (req.query.pitch as string) || '+0Hz';

            if (!text.trim()) {
                res.status(400).send('Text parameter is required');
                return;
            }

            const startTime = Date.now();
            console.log(`\n🎙️ [Speech Stream] Streaming Request:`);
            console.log(`   • Voice: ${voice}`);
            console.log(`   • Text: "${text.slice(0, 70)}..." (${text.length} chars)`);

            const speechData = await TTSService.getSpeechAudio(text.trim(), voice, rate, pitch);
            const buffer = Buffer.from(speechData.audioBase64, 'base64');
            const elapsedMs = Date.now() - startTime;

            console.log(`   ✅ [Speech Stream] Streamed ${Math.round(buffer.length / 1024)} KB MP3 in ${elapsedMs}ms (Cached: ${speechData.cached})\n`);

            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Content-Length', buffer.length.toString());
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('X-Speech-Voice', voice);
            res.setHeader('X-Duration-Ms', speechData.durationMs.toString());
            res.status(200).send(buffer);
        } catch (err: any) {
            console.error('❌ [Speech Stream] Error:', err);
            res.status(500).send('Speech streaming failed');
        }
    }

    /**
     * GET /api/v1/speech/voices
     */
    public static async getVoices(req: Request, res: Response): Promise<void> {
        res.status(200).json({
            success: true,
            voices: AVAILABLE_NEURAL_VOICES,
        });
    }

    private static sanoCache: Map<string, any> = new Map();

    /**
     * POST /api/v1/speech/sano
     * Body: { text: string, voice?: string }
     */
    public static async synthesizeSano(req: Request, res: Response): Promise<void> {
        try {
            const { text, voice } = req.body;
            if (!text || typeof text !== 'string' || !text.trim()) {
                res.status(400).json({ success: false, error: 'Text field is required' });
                return;
            }

            const chosenVoice = voice || 'amy';
            const cacheKey = `${chosenVoice}:${text.trim()}`;

            // Instant cache return (0ms latency for repeating / reviewing articles)
            if (SpeechController.sanoCache.has(cacheKey)) {
                const cached = SpeechController.sanoCache.get(cacheKey);
                console.log(`⚡ [SanoTTS Cache HIT] Delivered in 1ms for "${text.slice(0, 30)}..." (${chosenVoice})`);
                res.status(200).json({
                    ...cached,
                    cached: true,
                    latencyMs: 1,
                });
                return;
            }

            const startTime = Date.now();

            let scriptPath = path.resolve(__dirname, '../scripts/sano_synth.py');
            if (!fs.existsSync(scriptPath)) {
                scriptPath = path.resolve(process.cwd(), 'src/scripts/sano_synth.py');
            }
            if (!fs.existsSync(scriptPath)) {
                scriptPath = path.resolve(process.cwd(), 'dist/scripts/sano_synth.py');
            }

            const pythonBin = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
            const pyProcess = spawn(pythonBin, [scriptPath]);

            // Stream text and voice safely via stdin
            pyProcess.stdin.write(JSON.stringify({ text: text.trim(), voice: chosenVoice }));
            pyProcess.stdin.end();

            let stdoutData = '';
            let stderrData = '';
            let isClosed = false;

            const processKillTimer = setTimeout(() => {
                if (!isClosed) {
                    isClosed = true;
                    pyProcess.kill();
                    res.status(504).json({
                        success: false,
                        error: 'SanoTTS process timed out after 75s',
                        rectification: 'The audio text may be too long. SanoTTS has condensed to 26 words, but CPU load was saturated.',
                    });
                }
            }, 75000);

            pyProcess.stdout.on('data', (data) => {
                stdoutData += data.toString();
            });

            pyProcess.stderr.on('data', (data) => {
                stderrData += data.toString();
            });

            pyProcess.on('close', (code) => {
                if (isClosed) return;
                isClosed = true;
                clearTimeout(processKillTimer);

                if (code !== 0 || !stdoutData) {
                    console.error('SanoTTS Python Error:', stderrData || 'No output');
                    res.status(500).json({ success: false, error: stderrData || 'SanoTTS synthesis failed' });
                    return;
                }

                try {
                    const parsed = JSON.parse(stdoutData.trim());
                    const elapsedMs = Date.now() - startTime;
                    if (parsed.success === false) {
                        console.error('SanoTTS Engine Failure:', parsed.error);
                        res.status(parsed.isLanguageMismatch ? 400 : 500).json({
                            success: false,
                            error: parsed.error || 'SanoTTS Python engine reported failure',
                            isLanguageMismatch: parsed.isLanguageMismatch || false,
                            suggestedVoice: parsed.isLanguageMismatch ? 'hi-IN-SwaraNeural' : undefined,
                            rectification: parsed.isLanguageMismatch
                                ? 'Hindi text detected. Use Microsoft Edge-TTS Hindi (hi-IN-SwaraNeural).'
                                : "Run 'pip install sanotts' in your Python environment and verify installation.",
                        });
                        return;
                    }

                    // Store in fast in-memory cache
                    SpeechController.sanoCache.set(cacheKey, parsed);
                    if (SpeechController.sanoCache.size > 200) {
                        const oldestKey = SpeechController.sanoCache.keys().next().value;
                        if (oldestKey) SpeechController.sanoCache.delete(oldestKey);
                    }

                    console.log(`⚡ [SanoTTS Backend] Generated audio for "${text.slice(0, 30)}..." in ${elapsedMs}ms (${chosenVoice})`);
                    res.status(200).json({
                        ...parsed,
                        latencyMs: elapsedMs,
                    });
                } catch (parseErr) {
                    console.error('SanoTTS Parse Error:', parseErr, stdoutData.slice(0, 200));
                    res.status(500).json({ success: false, error: 'Failed to parse SanoTTS audio response', raw: stdoutData.slice(0, 200) });
                }
            });
        } catch (err: any) {
            console.error('SanoTTS synthesize error:', err);
            res.status(500).json({ success: false, error: err.message || 'SanoTTS error' });
        }
    }
}
