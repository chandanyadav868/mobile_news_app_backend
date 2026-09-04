import { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { AuthService } from '../services/authService.js';
import { MailService } from '../services/mailService.js';
import { AuthenticatedRequest } from '../middleware/userAuth.js';

export class AuthController {
    /**
     * Register a new user with Email and Password
     * POST /api/v1/auth/register
     */
    public static async register(req: Request, res: Response) {
        try {
            const { email, password, name } = req.body;

            if (!email || !password || !name) {
                return res.status(400).json({
                    success: false,
                    error: 'Name, email, and password are required.',
                });
            }

            const normalizedEmail = email.toLowerCase().trim();
            const trimmedName = name.trim();

            if (trimmedName.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'Name must be at least 2 characters.',
                });
            }

            const strengthCheck = AuthService.validatePasswordStrength(password);
            if (!strengthCheck.valid) {
                return res.status(400).json({
                    success: false,
                    error: strengthCheck.message,
                });
            }

            // Check if user already exists
            const existingUser = await prisma.user.findUnique({
                where: { email: normalizedEmail },
            });

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    error: 'An account with this email already exists. Please sign in.',
                });
            }

            const passwordHash = await AuthService.hashPassword(password);

            const user = await prisma.user.create({
                data: {
                    email: normalizedEmail,
                    name: trimmedName,
                    passwordHash,
                    authProvider: 'LOCAL',
                    status: 'USER',
                    lastLoginAt: new Date(),
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatarUrl: true,
                    authProvider: true,
                    status: true,
                    isEmailVerified: true,
                    tokenVersion: true,
                    createdAt: true,
                },
            });

            const token = AuthService.generateAccessToken(user);

            return res.status(201).json({
                success: true,
                message: 'Account registered successfully.',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    avatarUrl: user.avatarUrl,
                    authProvider: user.authProvider,
                    status: user.status,
                    isEmailVerified: user.isEmailVerified,
                },
            });
        } catch (err: any) {
            console.error('[AuthController] Register error:', err);
            return res.status(500).json({
                success: false,
                error: 'Registration failed. Please try again.',
            });
        }
    }

    /**
     * Sign In with Email and Password
     * POST /api/v1/auth/login
     */
    public static async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and password are required.',
                });
            }

            const normalizedEmail = email.toLowerCase().trim();

            const user = await prisma.user.findUnique({
                where: { email: normalizedEmail },
            });

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid email or password.',
                });
            }

            // Check if account was created via Google only
            if (!user.passwordHash) {
                return res.status(400).json({
                    success: false,
                    error: 'This account was registered via Google Sign-In. Please sign in with Google or use "Forgot Password" to set a password.',
                    authProvider: user.authProvider,
                });
            }

            const isMatch = await AuthService.comparePassword(password, user.passwordHash);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid email or password.',
                });
            }

            // Update lastLoginAt
            await prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() },
            });

            const token = AuthService.generateAccessToken(user);

            return res.json({
                success: true,
                message: 'Signed in successfully.',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    avatarUrl: user.avatarUrl,
                    authProvider: user.authProvider,
                    status: user.status,
                    isEmailVerified: user.isEmailVerified,
                },
            });
        } catch (err: any) {
            console.error('[AuthController] Login error:', err);
            return res.status(500).json({
                success: false,
                error: 'Sign in failed. Please try again.',
            });
        }
    }

    /**
     * Request 6-digit OTP for Forgot Password
     * POST /api/v1/auth/forgot-password
     */
    public static async forgotPassword(req: Request, res: Response) {
        try {
            const { email } = req.body;

            if (!email || typeof email !== 'string' || !email.includes('@')) {
                return res.status(400).json({
                    success: false,
                    error: 'Please enter a valid email address.',
                });
            }

            const normalizedEmail = email.toLowerCase().trim();

            const user = await prisma.user.findUnique({
                where: { email: normalizedEmail },
                select: { id: true, name: true, email: true },
            });

            // If user does not exist, return generic success message to prevent user enumeration
            if (!user) {
                return res.json({
                    success: true,
                    message: 'If an account exists with this email, a 6-digit verification code has been sent.',
                });
            }

            // Generate 6-digit OTP and store in Redis with 10 min TTL
            const otp = await AuthService.createAndStoreOtp(normalizedEmail);

            // Send branded HTML email via MailService (Mailtrap or SMTP)
            const mailRes = await MailService.sendPasswordResetOtp({
                email: user.email,
                name: user.name,
                otp,
            });

            if (!mailRes.success) {
                console.warn('[AuthController] Mail delivery notice:', mailRes.error);
            }

            return res.json({
                success: true,
                message: 'A 6-digit verification code has been sent to your email address.',
            });
        } catch (err: any) {
            console.error('[AuthController] forgotPassword error:', err);
            return res.status(500).json({
                success: false,
                error: 'Could not send verification code. Please try again.',
            });
        }
    }

    /**
     * Verify 6-digit OTP
     * POST /api/v1/auth/verify-otp
     */
    public static async verifyOtp(req: Request, res: Response) {
        try {
            const { email, otp } = req.body;

            if (!email || !otp) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and 6-digit verification code are required.',
                });
            }

            const normalizedEmail = email.toLowerCase().trim();
            const cleanOtp = String(otp).trim();

            if (cleanOtp.length !== 6) {
                return res.status(400).json({
                    success: false,
                    error: 'Verification code must be exactly 6 digits.',
                });
            }

            const verification = await AuthService.verifyOtp(normalizedEmail, cleanOtp);

            if (!verification.success) {
                return res.status(400).json({
                    success: false,
                    error: verification.error || 'Invalid verification code.',
                });
            }

            // Generate a 15-minute single-use reset token
            const resetToken = AuthService.generateResetToken(normalizedEmail);

            return res.json({
                success: true,
                message: 'Verification successful. You can now set your new password.',
                resetToken,
            });
        } catch (err: any) {
            console.error('[AuthController] verifyOtp error:', err);
            return res.status(500).json({
                success: false,
                error: 'Verification failure. Please try again.',
            });
        }
    }

    /**
     * Set New Password using verified reset token
     * POST /api/v1/auth/reset-password
     */
    public static async resetPassword(req: Request, res: Response) {
        try {
            const { email, resetToken, newPassword, confirmPassword } = req.body;

            if (!email || !resetToken || !newPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Email, reset token, and new password are required.',
                });
            }

            const normalizedEmail = email.toLowerCase().trim();

            if (confirmPassword && newPassword !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'New password and confirmation password do not match.',
                });
            }

            const strengthCheck = AuthService.validatePasswordStrength(newPassword);
            if (!strengthCheck.valid) {
                return res.status(400).json({
                    success: false,
                    error: strengthCheck.message,
                });
            }

            // Verify resetToken
            const tokenPayload = AuthService.verifyResetToken(resetToken);
            if (!tokenPayload || tokenPayload.email !== normalizedEmail) {
                return res.status(401).json({
                    success: false,
                    error: 'Password reset session has expired or is invalid. Please request a new code.',
                });
            }

            const user = await prisma.user.findUnique({
                where: { email: normalizedEmail },
            });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User account not found.',
                });
            }

            const passwordHash = await AuthService.hashPassword(newPassword);

            // Update user password and increment tokenVersion to revoke old sessions
            const updatedUser = await prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordHash,
                    tokenVersion: { increment: 1 },
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatarUrl: true,
                    authProvider: true,
                    status: true,
                    isEmailVerified: true,
                    tokenVersion: true,
                },
            });

            // Clear any lingering OTP data
            await AuthService.clearOtp(normalizedEmail);

            // Automatically issue fresh access token for seamless post-reset login
            const token = AuthService.generateAccessToken(updatedUser);

            return res.json({
                success: true,
                message: 'Your password has been updated successfully.',
                token,
                user: {
                    id: updatedUser.id,
                    email: updatedUser.email,
                    name: updatedUser.name,
                    avatarUrl: updatedUser.avatarUrl,
                    authProvider: updatedUser.authProvider,
                    status: updatedUser.status,
                    isEmailVerified: updatedUser.isEmailVerified,
                },
            });
        } catch (err: any) {
            console.error('[AuthController] resetPassword error:', err);
            return res.status(500).json({
                success: false,
                error: 'Could not update password. Please try again.',
            });
        }
    }

    /**
     * Mobile Google Sign-In with idToken verification
     * POST /api/v1/auth/google
     */
    public static async googleLogin(req: Request, res: Response) {
        try {
            const { idToken } = req.body;

            if (!idToken || typeof idToken !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'Google idToken is required.',
                });
            }

            const googleProfile = await AuthService.verifyGoogleIdToken(idToken);
            if (!googleProfile || !googleProfile.email) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid or expired Google authentication token.',
                });
            }

            const normalizedEmail = googleProfile.email.toLowerCase();

            // Find existing user by Google ID or by Email
            let user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { googleId: googleProfile.sub },
                        { email: normalizedEmail },
                    ],
                },
            });

            if (user) {
                // Link googleId or avatar if not yet linked
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        googleId: user.googleId || googleProfile.sub,
                        avatarUrl: user.avatarUrl || googleProfile.picture,
                        isEmailVerified: true,
                        lastLoginAt: new Date(),
                    },
                });
            } else {
                // Create new Google user
                user = await prisma.user.create({
                    data: {
                        email: normalizedEmail,
                        name: googleProfile.name,
                        avatarUrl: googleProfile.picture,
                        googleId: googleProfile.sub,
                        authProvider: 'GOOGLE',
                        isEmailVerified: true,
                        lastLoginAt: new Date(),
                    },
                });
            }

            const token = AuthService.generateAccessToken(user);

            return res.json({
                success: true,
                message: 'Google Sign-In successful.',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    avatarUrl: user.avatarUrl,
                    authProvider: user.authProvider,
                    status: user.status,
                    isEmailVerified: user.isEmailVerified,
                },
            });
        } catch (err: any) {
            console.error('[AuthController] Google login error:', err);
            return res.status(500).json({
                success: false,
                error: 'Google Sign-In failed. Please try again.',
            });
        }
    }

    /**
     * Get Current Authenticated User Profile
     * GET /api/v1/auth/me
     */
    public static async getMe(req: AuthenticatedRequest, res: Response) {
        return res.json({
            success: true,
            user: req.user,
        });
    }

    /**
     * Sign Out and Invalidate Active Tokens
     * POST /api/v1/auth/logout
     */
    public static async logout(req: AuthenticatedRequest, res: Response) {
        try {
            if (req.user?.id) {
                await prisma.user.update({
                    where: { id: req.user.id },
                    data: { tokenVersion: { increment: 1 } },
                });
            }
            return res.json({
                success: true,
                message: 'Signed out successfully.',
            });
        } catch (err: any) {
            console.error('[AuthController] logout error:', err);
            return res.status(500).json({
                success: false,
                error: 'Logout failed.',
            });
        }
    }
}
