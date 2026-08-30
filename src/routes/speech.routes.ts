import { Router } from 'express';
import { SpeechController } from '../controllers/speechController.js';

const router = Router();

router.post('/synthesize', SpeechController.synthesize);
router.post('/gemini-s2s', SpeechController.geminiS2S);
router.post('/gemini-synthesize', SpeechController.geminiSynthesize);
router.get('/stream', SpeechController.stream);
router.get('/voices', SpeechController.getVoices);

export default router;
