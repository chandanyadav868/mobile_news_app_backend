import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import { env } from '../config/env.js';
import { redis } from '../config/redis.js';

const JWT_SECRET = env.JWT_SECRET || 'newsflow_super_secret_jwt_key_2026';
const BCRYPT_SALT_ROUNDS = 12;
const OTP_EXPIRY_SECONDS = 600; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;

// In-memory fallback map if Redis is temporarily offline in local development
const memoryOtpStore = new Map<string, { otpHash: string; attempts: number; expiresAt: number }>();

export interface JwtUserPayload {
    userId: string;
    email: string;
    tokenVersion: number;
}

export interface GoogleTokenPayload {
    sub: string;
    email: string;
    name: string;
    picture?: string;
    email_verified?: boolean;
}

export class AuthService {
    /**
     * Hash password with 12 bcrypt salt rounds
     */
    public static async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    }

    /**
     * Compare plaintext password against bcrypt hash
     */
    public static async comparePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    /**
     * Generate 30-day Access Token for mobile session
     */
    public static generateAccessToken(user: { id: string; email: string; tokenVersion: number }): string {
        const payload: JwtUserPayload = {
            userId: user.id,
            email: user.email.toLowerCase(),
            tokenVersion: user.tokenVersion,
        };
        return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
    }

    /**
     * Verify JWT access token
     */
    public static verifyAccessToken(token: string): JwtUserPayload | null {
        try {
            return jwt.verify(token, JWT_SECRET) as JwtUserPayload;
        } catch {
            return null;
        }
    }

    /**
     * Generate single-use 15-minute password reset token upon successful OTP verification
     */
    public static generateResetToken(email: string): string {
        return jwt.sign({ email: email.toLowerCase(), purpose: 'PASSWORD_RESET' }, JWT_SECRET, {
            expiresIn: '15m',
        });
    }

    /**
     * Verify single-use reset token
     */
    public static verifyResetToken(token: string): { email: string } | null {
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            if (decoded && decoded.purpose === 'PASSWORD_RESET' && decoded.email) {
                return { email: decoded.email };
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Validate password policy:
     * - Minimum 8 characters
     * - At least 1 letter and 1 number
     */
    public static validatePasswordStrength(password: string): { valid: boolean; message?: string } {
        if (!password || typeof password !== 'string') {
            return { valid: false, message: 'Password is required' };
        }
        if (password.length < 8) {
            return { valid: false, message: 'Password must be at least 8 characters long' };
        }
        if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one letter and one number' };
        }
        return { valid: true };
    }

    /**
     * Generate cryptographically random 6-digit OTP and store SHA-256 hash with 10 min TTL
     */
    public static async createAndStoreOtp(email: string): Promise<string> {
        const normalizedEmail = email.toLowerCase().trim();
        // Generate secure 6-digit numeric string
        const otp = crypto.randomInt(100000, 1000000).toString();
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

        if (redis) {
            try {
                const key = `pwd_reset:${normalizedEmail}`;
                const value = JSON.stringify({ otpHash, attempts: 0 });
                await redis.setex(key, OTP_EXPIRY_SECONDS, value);
                return otp;
            } catch (e: any) {
                console.warn('Redis error while saving OTP, falling back to memory store:', e.message);
            }
        }

        // Memory store fallback
        memoryOtpStore.set(normalizedEmail, {
            otpHash,
            attempts: 0,
            expiresAt: Date.now() + OTP_EXPIRY_SECONDS * 1000,
        });

        return otp;
    }

    /**
     * Verify 6-digit OTP with brute-force attempt lockout
     */
    public static async verifyOtp(
        email: string,
        otp: string
    ): Promise<{ success: boolean; error?: string }> {
        const normalizedEmail = email.toLowerCase().trim();
        const candidateHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');

        let storedData: { otpHash: string; attempts: number } | null = null;

        if (redis) {
            try {
                const key = `pwd_reset:${normalizedEmail}`;
                const raw = await redis.get(key);
                if (raw) {
                    storedData = JSON.parse(raw);
                }
            } catch (e: any) {
                console.warn('Redis error while verifying OTP, checking memory store:', e.message);
            }
        }

        // Check memory store if not found in Redis
        if (!storedData) {
            const memoryItem = memoryOtpStore.get(normalizedEmail);
            if (memoryItem) {
                if (Date.now() > memoryItem.expiresAt) {
                    memoryOtpStore.delete(normalizedEmail);
                } else {
                    storedData = memoryItem;
                }
            }
        }

        if (!storedData) {
            return {
                success: false,
                error: 'Verification code has expired or is invalid. Please request a new code.',
            };
        }

        if (storedData.attempts >= MAX_OTP_ATTEMPTS) {
            await this.clearOtp(normalizedEmail);
            return {
                success: false,
                error: 'Too many incorrect attempts. For your security, this code was locked. Please request a new code.',
            };
        }

        // Verify SHA-256 match
        if (candidateHash !== storedData.otpHash) {
            const newAttempts = storedData.attempts + 1;
            const remaining = MAX_OTP_ATTEMPTS - newAttempts;

            if (redis) {
                try {
                    const key = `pwd_reset:${normalizedEmail}`;
                    const ttl = await redis.ttl(key);
                    if (ttl > 0) {
                        await redis.setex(key, ttl, JSON.stringify({ otpHash: storedData.otpHash, attempts: newAttempts }));
                    }
                } catch {
                    // Ignore
                }
            }

            const mem = memoryOtpStore.get(normalizedEmail);
            if (mem) {
                mem.attempts = newAttempts;
            }

            return {
                success: false,
                error: `Incorrect verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Code has been locked.'}`,
            };
        }

        // Match found!
        return { success: true };
    }

    /**
     * Clear OTP record after successful password change or lockout
     */
    public static async clearOtp(email: string): Promise<void> {
        const normalizedEmail = email.toLowerCase().trim();
        if (redis) {
            try {
                await redis.del(`pwd_reset:${normalizedEmail}`);
            } catch {
                // Ignore
            }
        }
        memoryOtpStore.delete(normalizedEmail);
    }

    /**
     * Verify Google idToken via Google Identity OAuth2 TokenInfo API
     */
    public static async verifyGoogleIdToken(idToken: string): Promise<GoogleTokenPayload | null> {
        try {
            if (!idToken || typeof idToken !== 'string') return null;

            const res = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
                timeout: 6000,
            });

            const data = res.data;
            if (!data || !data.sub || !data.email) {
                return null;
            }

            // Verify audience if configured
            if (env.GOOGLE_WEB_CLIENT_ID && data.aud && data.aud !== env.GOOGLE_WEB_CLIENT_ID) {
                console.warn(`[GoogleAuth] Warning: idToken aud (${data.aud}) does not match configured GOOGLE_WEB_CLIENT_ID`);
            }

            return {
                sub: data.sub,
                email: data.email.toLowerCase(),
                name: data.name || data.email.split('@')[0] || 'Google User',
                picture: data.picture,
                email_verified: data.email_verified === 'true' || data.email_verified === true,
            };
        } catch (err: any) {
            console.error('[GoogleAuth] Failed to verify Google idToken:', err?.response?.data || err.message);
            return null;
        }
    }
}
