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

            const speechData = await TTSService.getSpeechAudio(
                text.trim(),
                chosenVoice,
                rate || '+0%',
                pitch || '+0Hz'
            );

            const elapsedMs = Date.now() - startTime;

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
            console.error('[SpeechController] Synthesize error:', err);
            res.status(500).json({
                success: false,
                error: err.message || 'Speech synthesis failed.',
            });
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
