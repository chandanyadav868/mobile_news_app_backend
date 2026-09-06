import * as Sentry from '@sentry/node';
import { env } from './env.js';

let isSentryEnabled = false;

/**
 * Initialize Sentry Production APM & Threat/Crash Monitoring
 */
export function initSentry(): void {
    const dsn = process.env.SENTRY_DSN;

    if (!dsn) {
        console.log('ℹ️ [Sentry] SENTRY_DSN not configured in .env. Monitoring running in local/console fallback mode.');
        return;
    }

    try {
        Sentry.init({
            dsn,
            environment: env.NODE_ENV || 'production',
            tracesSampleRate: 0.2, // Capture 20% of transactions for performance monitoring
            integrations: [
                // Automatically capture HTTP requests and unhandled promises
            ],
        });
        isSentryEnabled = true;
        console.log('🛡️ [Sentry] Production APM & Threat Monitoring active.');
    } catch (err: any) {
        console.error('⚠️ [Sentry] Initialization error:', err.message);
    }
}

/**
 * Safely capture an exception to Sentry and log to console
 */
export function recordSecurityEvent(event: {
    type: 'AUTH_FAILURE' | 'BRUTE_FORCE_ATTEMPT' | 'UNAUTHORIZED_ADMIN_ACCESS' | 'SUSPICIOUS_PAYLOAD';
    ip?: string;
    details: any;
}): void {
    console.warn(`🚨 [SECURITY EVENT: ${event.type}] IP: ${event.ip || 'unknown'}`, JSON.stringify(event.details));

    if (isSentryEnabled) {
        Sentry.captureMessage(`[SECURITY ALERT] ${event.type} from IP ${event.ip || 'unknown'}`, {
            level: 'warning',
            extra: event,
        });
    }
}

/**
 * Capture error to Sentry
 */
export function captureError(error: any, context?: Record<string, any>): void {
    if (isSentryEnabled) {
        Sentry.captureException(error, { extra: context });
    }
}

export { Sentry, isSentryEnabled };
