import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/authController.js';
import { authenticateUser } from '../middleware/userAuth.js';

const router = Router();

// Rate limiting to protect against brute-force password and OTP guessing
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 requests per IP per 15 min
    message: {
        success: false,
        error: 'Too many attempts from this device. Please try again in 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 6, // 6 OTP requests per IP per 15 min
    message: {
        success: false,
        error: 'Too many verification code requests. Please wait before requesting another code.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// ─── Public Authentication Routes ─────────────────────────────────────────────
router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);
router.post('/google', authLimiter, AuthController.googleLogin);

// ─── Forgot Password & 6-Digit OTP Recovery ──────────────────────────────────
router.post('/forgot-password', forgotPasswordLimiter, AuthController.forgotPassword);
router.post('/verify-otp', authLimiter, AuthController.verifyOtp);
router.post('/reset-password', authLimiter, AuthController.resetPassword);

// ─── Protected Routes (Requires Bearer JWT) ───────────────────────────────────
router.get('/me', authenticateUser, AuthController.getMe);
router.post('/logout', authenticateUser, AuthController.logout);

export default router;
