import { Request, Response } from 'express';
import { TTSService } from '../services/ttsService';

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
            const { text, voice, rate, pitch } = req.body;

            if (!text || typeof text !== 'string' || !text.trim()) {
                res.status(400).json({
                    success: false,
                    error: 'Text field is required for speech synthesis.',
                });
                return;
            }

            const chosenVoice = voice || 'en-IN-NeerjaNeural';
            const startTime = Date.now();

            console.log(`\n🎙️ [Speech API] Synthesize Request:`);
            console.log(`   • Voice: ${chosenVoice}`);
            console.log(`   • Text: "${text.slice(0, 70)}..." (${text.length} chars)`);

            const speechData = await TTSService.getSpeechAudio(
                text.trim(),
                chosenVoice,
                rate || '+0%',
                pitch || '+0Hz'
            );

            const elapsedMs = Date.now() - startTime;
            console.log(`   ✅ [Speech API] Generated ${Math.round(speechData.audioBase64.length / 1024)} KB audio in ${elapsedMs}ms (Cached: ${speechData.cached})\n`);

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
     * POST /api/v1/speech/gemini-synthesize
     * Body: { text: string, voiceName?: string }
     */
    public static async geminiSynthesize(req: Request, res: Response): Promise<void> {
        try {
            const { text, voiceName } = req.body;
            if (!text || typeof text !== 'string' || !text.trim()) {
                res.status(400).json({ success: false, error: 'Text is required.' });
                return;
            }

            const startTime = Date.now();
            console.log(`\n✨ [Gemini Speech API] Requesting Google Gemini AI Voice:`);
            console.log(`   • Voice: ${voiceName || 'Aoede (Gemini AI Anchor)'}`);
            console.log(`   • Text: "${text.slice(0, 70)}..."`);

            const { GeminiService } = await import('../services/geminiService.js');
            const result = await GeminiService.synthesizeSpeech({
                text: text.trim(),
                voiceName: voiceName || 'Aoede',
            });

            const elapsedMs = Date.now() - startTime;
            console.log(`   ✅ [Gemini Speech API] Audio generated in ${elapsedMs}ms\n`);

            res.status(200).json({
                success: true,
                voice: voiceName || 'Aoede (Google Gemini AI)',
                audioBase64: result.audioBase64,
                mimeType: result.mimeType,
                durationMs: result.durationMs,
                latencyMs: elapsedMs,
            });
        } catch (err: any) {
            console.error('❌ [Gemini Speech API] error:', err.message);
            res.status(500).json({
                success: false,
                error: err.message || 'Gemini speech synthesis failed.',
            });
        }
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
}
