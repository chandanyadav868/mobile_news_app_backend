import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService.js';
import { prisma } from '../config/db.js';

export interface AuthenticatedUser {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    authProvider: string;
    isEmailVerified: boolean;
    tokenVersion: number;
}

export interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
}

export async function authenticateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required. Missing or malformed token.',
            });
        }

        const token = authHeader.split(' ')[1];
        const payload = AuthService.verifyAccessToken(token);

        if (!payload) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired session token. Please sign in again.',
            });
        }

        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                authProvider: true,
                isEmailVerified: true,
                tokenVersion: true,
            },
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Account not found or has been deactivated.',
            });
        }

        // Enforce session revocation: if tokenVersion does not match, all prior sessions were revoked
        if (user.tokenVersion !== payload.tokenVersion) {
            return res.status(401).json({
                success: false,
                error: 'Session was invalidated due to password change or logout.',
            });
        }

        req.user = user as AuthenticatedUser;
        next();
    } catch (err: any) {
        console.error('[UserAuth] Middleware error:', err);
        return res.status(500).json({
            success: false,
            error: 'Authentication verification failure.',
        });
    }
}
