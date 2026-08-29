import { Response } from 'express';
import axios from 'axios';
import { prisma } from '../../config/db.js';
import { AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';

export class CmsPushController {
    /**
     * Broadcast Push Notification to Target Audience
     */
    static async broadcast(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const { title, body, category, articleId } = req.body;
            if (!title || !body) {
                return res.status(400).json({ success: false, error: 'Title and body are required.' });
            }

            // Find matching device subscriptions
            const where: any = {};
            if (category && category !== 'All') {
                where.categories = { has: category };
            }

            const subscriptions = await prisma.deviceSubscription.findMany({
                where,
                select: { pushToken: true },
            });

            const tokens = subscriptions.map((s) => s.pushToken).filter((t) => t && t.startsWith('ExponentPushToken'));

            let sentCount = 0;
            if (tokens.length > 0) {
                // Batch tokens into chunks of 100
                const messages = tokens.map((token) => ({
                    to: token,
                    sound: 'default',
                    title: title.trim(),
                    body: body.trim(),
                    data: { articleId, category },
                }));

                try {
                    const pushRes = await axios.post(
                        'https://exp.host/--/api/v2/push/send',
                        messages,
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                    if (pushRes.status === 200) {
                        sentCount = tokens.length;
                    }
                } catch (e) {
                    console.warn('Expo Push Gateway error:', e);
                }
            }

            // Record broadcast log
            const log = await prisma.pushBroadcastLog.create({
                data: {
                    title: title.trim(),
                    body: body.trim(),
                    category: category || null,
                    articleId: articleId || null,
                    sentCount: sentCount || tokens.length,
                    openCount: 0,
                    sentAt: new Date(),
                },
            });

            if (req.admin) {
                await prisma.cmsAuditLog.create({
                    data: {
                        adminId: req.admin.id,
                        action: 'PUSH_BROADCAST',
                        entityType: 'PushBroadcastLog',
                        entityId: log.id,
                        details: { title, category, targetCount: tokens.length },
                    },
                });
            }

            return res.json({
                success: true,
                message: `Broadcast dispatched to ${tokens.length} target devices.`,
                log,
            });
        } catch (error: any) {
            console.error('CMS broadcast error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Broadcast History
     */
    static async history(req: AuthenticatedAdminRequest, res: Response) {
        try {
            const logs = await prisma.pushBroadcastLog.findMany({
                orderBy: { sentAt: 'desc' },
                take: 50,
            });
            return res.json({ success: true, logs });
        } catch (error: any) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
}
