import rateLimit from 'express-rate-limit';
import { recordSecurityEvent } from '../config/sentry.js';

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 120, // max 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please slow down.',
  },
});

/**
 * 🔒 Strict Brute-Force Rate Limiter for Login & Authentication Endpoints
 * Limits each IP address to 10 login attempts per 15 minutes.
 */
export const authBruteForceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    recordSecurityEvent({
      type: 'BRUTE_FORCE_ATTEMPT',
      ip: clientIp,
      details: { path: req.originalUrl, method: req.method },
    });

    res.status(429).json({
      success: false,
      error: 'Too many login attempts from this network. Please wait 15 minutes before trying again.',
    });
  },
});

/**
 * 🛡️ Administrative Portal Rate Limiter
 */
export const adminApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Administrative rate limit exceeded. Please wait a moment.',
  },
});

