import { Router } from 'express';
import { SpeechController } from '../controllers/speechController.js';

const router = Router();

router.post('/synthesize', SpeechController.synthesize);
router.post('/sano', SpeechController.synthesizeSano);
router.get('/stream', SpeechController.stream);
router.get('/voices', SpeechController.getVoices);

export default router;
