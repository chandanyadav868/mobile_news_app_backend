import nodemailer from 'nodemailer';
import { MailtrapClient } from 'mailtrap';
import fs from 'fs';
import path from 'path';

export interface EmailTemplateConfig {
    subject: string;
    appName: string;
    logoUrl: string;
    heroImageUrl: string;
    badgeText: string;
    headline: string;
    introMessage: string;
    storyTitle: string;
    storySummary: string;
    androidUrl: string;
    iosUrl: string;
    apkDirectUrl: string;
    invitationCode: string;
    footerText: string;
}

export const DEFAULT_EMAIL_TEMPLATE: EmailTemplateConfig = {
    subject: "🚀 You're Invited: Exclusive NewsFlow VIP Beta Access!",
    appName: 'NewsFlow AI',
    logoUrl: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=150&auto=format&fit=crop&q=80',
    heroImageUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&auto=format&fit=crop&q=80',
    badgeText: '🌟 EXCLUSIVE VIP BETA INVITATION',
    headline: 'Welcome to the Future of 60-Word Breaking News',
    introMessage: 'Thank you for signing up to test NewsFlow! You have been hand-picked to experience our lightning-fast AI news swiper before the public launch.',
    storyTitle: '⚡ Ultra-Fast 60-Word Shorts, Neural AI Audio & Offline Timelines',
    storySummary: 'NewsFlow delivers bite-sized verified global news, edge AI voice anchors, and real-time community polls. Your feedback directly shapes our official store release.',
    androidUrl: 'https://play.google.com/apps/testing/com.newsflow.app',
    iosUrl: 'https://testflight.apple.com/join/newsflow-beta',
    apkDirectUrl: 'https://github.com/newsflow/releases/latest/download/app-release.apk',
    invitationCode: 'VIP-NEWS-2026',
    footerText: '© 2026 NewsFlow AI Inc. • You received this email because you registered on our beta waitlist.',
};

const TEMPLATE_FILE = path.join(process.cwd(), 'data', 'email_template.json');

export class MailService {
    private static transporter: nodemailer.Transporter | null = null;

    /**
     * Get or initialize Nodemailer transporter
     */
    private static getTransporter(): nodemailer.Transporter {
        const host = process.env.SMTP_HOST || 'smtp.gmail.com';
        const port = parseInt(process.env.SMTP_PORT || '587', 10);
        const user = (process.env.SMTP_USER || '').trim();
        // Automatically strip all spaces from Google 16-character App Password (e.g. "topo mcij urxm rrfx" -> "topomcijurxmrrfx")
        const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();

        if (user && pass) {
            if (host.includes('gmail') || user.endsWith('@gmail.com')) {
                return nodemailer.createTransport({
                    service: 'gmail',
                    auth: { user, pass },
                });
            }
            return nodemailer.createTransport({
                host,
                port,
                secure: port === 465,
                auth: { user, pass },
            });
        }

        // Fallback test mode: uses Ethereal
        return nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            auth: {
                user: 'ethereal.user@ethereal.email',
                pass: 'ethereal.pass',
            },
        });
    }

    /**
     * Load current email template from disk or default
     */
    public static getTemplate(): EmailTemplateConfig {
        try {
            if (fs.existsSync(TEMPLATE_FILE)) {
                const data = fs.readFileSync(TEMPLATE_FILE, 'utf8');
                return { ...DEFAULT_EMAIL_TEMPLATE, ...JSON.parse(data) };
            }
        } catch (e) {
            console.warn('Could not read email_template.json, using defaults:', e);
        }
        return DEFAULT_EMAIL_TEMPLATE;
    }

    /**
     * Save updated template to disk
     */
    public static saveTemplate(template: Partial<EmailTemplateConfig>): EmailTemplateConfig {
        const current = this.getTemplate();
        const updated: EmailTemplateConfig = { ...current, ...template };
        try {
            const dir = path.dirname(TEMPLATE_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(TEMPLATE_FILE, JSON.stringify(updated, null, 2), 'utf8');
        } catch (e) {
            console.error('Failed to save email_template.json:', e);
        }
        return updated;
    }

    /**
     * Generate responsive HTML email string from template and user variables
     */
    public static renderEmailHtml(
        template: EmailTemplateConfig,
        user: { name?: string | null; email: string; deviceType?: string }
    ): string {
        const userName = user.name ? user.name.trim() : 'Beta Tester';

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${template.subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0B0F19;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #E2E8F0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0B0F19;
      padding: 32px 12px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #131B2E;
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .hero-img {
      width: 100%;
      height: 240px;
      object-fit: cover;
      display: block;
      border-bottom: 2px solid #2563EB;
    }
    .content-box {
      padding: 32px 28px;
    }
    .badge {
      display: inline-block;
      background: linear-gradient(135deg, #F59E0B, #D97706);
      color: #000;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 6px 14px;
      border-radius: 9999px;
      margin-bottom: 16px;
    }
    .headline {
      font-size: 24px;
      font-weight: 800;
      line-height: 1.3;
      color: #FFFFFF;
      margin: 0 0 14px 0;
    }
    .intro {
      font-size: 15px;
      line-height: 1.6;
      color: #94A3B8;
      margin: 0 0 24px 0;
    }
    .story-card {
      background: rgba(30, 41, 59, 0.7);
      border-left: 4px solid #3B82F6;
      border-radius: 12px;
      padding: 18px 20px;
      margin-bottom: 28px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .story-title {
      font-size: 16px;
      font-weight: 700;
      color: #60A5FA;
      margin: 0 0 8px 0;
    }
    .story-summary {
      font-size: 14px;
      line-height: 1.5;
      color: #CBD5E1;
      margin: 0;
    }
    .btn-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 28px 0;
    }
    .btn-primary {
      display: block;
      background: linear-gradient(135deg, #2563EB, #1D4ED8);
      color: #FFFFFF !important;
      text-align: center;
      padding: 14px 20px;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4);
    }
    .btn-secondary {
      display: block;
      background: #1E293B;
      color: #38BDF8 !important;
      text-align: center;
      padding: 14px 20px;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      border-radius: 12px;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }
    .btn-tertiary {
      display: block;
      background: transparent;
      color: #94A3B8 !important;
      text-align: center;
      padding: 10px 20px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: underline;
    }
    .code-box {
      background: #0F172A;
      border: 1px dashed rgba(245, 158, 11, 0.4);
      border-radius: 12px;
      padding: 14px;
      text-align: center;
      margin: 20px 0;
    }
    .code-label {
      font-size: 12px;
      color: #F59E0B;
      text-transform: uppercase;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .code-val {
      font-family: monospace;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.15em;
      color: #FFFFFF;
    }
    .footer {
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding: 20px 28px;
      text-align: center;
      font-size: 12px;
      color: #64748B;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <img src="${template.heroImageUrl}" alt="NewsFlow Beta Banner" class="hero-img" />
      
      <div class="content-box">
        <span class="badge">${template.badgeText}</span>
        
        <h1 class="headline">${template.headline}</h1>
        <p class="intro">Hi <strong>${userName}</strong>,<br>${template.introMessage}</p>
        
        <div class="story-card">
          <div class="story-title">${template.storyTitle}</div>
          <div class="story-summary">${template.storySummary}</div>
        </div>

        <div class="code-box">
          <div class="code-label">Your VIP Access Code</div>
          <div class="code-val">${template.invitationCode}</div>
        </div>
        
        <div class="btn-group">
          ${(user.deviceType === 'IOS' || !template.androidUrl || !template.androidUrl.trim()) ? '' : `
          <a href="${template.androidUrl}" class="btn-primary" target="_blank">
            🤖 Download on Google Play Beta Track
          </a>
          `}
          ${(user.deviceType === 'ANDROID' || !template.iosUrl || !template.iosUrl.trim()) ? '' : `
          <a href="${template.iosUrl}" class="btn-secondary" target="_blank">
            🍎 Join on Apple TestFlight
          </a>
          `}
          ${(!template.apkDirectUrl || !template.apkDirectUrl.trim()) ? '' : `
          <a href="${template.apkDirectUrl}" class="btn-tertiary" target="_blank">
            📦 Direct APK Download (Android)
          </a>
          `}
        </div>
      </div>
      
      <div class="footer">
        ${template.footerText}<br>
        Sent with ⚡ by ${template.appName} Ingestion Network
      </div>
    </div>
  </div>
</body>
</html>`;
    }

    /**
     * Send invitation email to a beta tester
     */
    public static async sendBetaInvitation(
        tester: { name?: string | null; email: string; deviceType?: string },
        customTemplate?: Partial<EmailTemplateConfig>
    ): Promise<{ success: boolean; messageId?: string; error?: string }> {
        try {
            const template = customTemplate
                ? { ...this.getTemplate(), ...customTemplate }
                : this.getTemplate();

            const html = this.renderEmailHtml(template, tester);

            // ─── PRIORITY 1: Mailtrap API Token Dispatch (Direct HTTPS API & Official SDK) ─────
            const mailtrapToken = (process.env.MAILTRAP_API_TOKEN || '').trim();
            if (mailtrapToken) {
                const inboxId = (process.env.MAILTRAP_INBOX_ID || '').trim();
                const senderEmail = process.env.MAILTRAP_SENDER_EMAIL || 'hello@demomailtrap.co';
                const senderName = process.env.MAILTRAP_SENDER_NAME || template.appName || 'NewsFlow VIP Beta';

                // 1. If explicit sandbox inbox is provided in .env, route directly to Sandbox API
                if (inboxId) {
                    try {
                        const sandboxRes = await fetch(`https://sandbox.api.mailtrap.io/api/send/${inboxId}`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${mailtrapToken}`,
                                'Api-Token': mailtrapToken,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                from: { email: senderEmail, name: senderName },
                                to: [{ email: tester.email, name: tester.name || 'Beta Tester' }],
                                subject: template.subject,
                                html,
                                category: 'VIP Beta Invitation',
                            }),
                        });
                        const sandboxData = await sandboxRes.json().catch(() => ({}));
                        if (sandboxRes.ok && sandboxData.success !== false) {
                            const messageId = sandboxData.message_ids?.[0] || `mailtrap-sandbox-${Date.now()}`;
                            console.log(`[MailService] [Mailtrap Sandbox] Invitation delivered to inbox #${inboxId}: ${messageId}`);
                            return { success: true, messageId };
                        }
                    } catch (e: any) {
                        console.warn('[MailService] Explicit sandbox send error:', e?.message);
                    }
                }

                // 2. Attempt Live Email Delivery via MailtrapClient SDK
                try {
                    const client = new MailtrapClient({ token: mailtrapToken });
                    const sdkResult = await client.send({
                        from: { email: senderEmail, name: senderName },
                        to: [{ email: tester.email, name: tester.name || 'Beta Tester' }],
                        subject: template.subject,
                        html,
                        category: 'VIP Beta Invitation',
                    });
                    if (sdkResult && sdkResult.success) {
                        const messageId = sdkResult.message_ids?.[0] || `mailtrap-live-${Date.now()}`;
                        console.log(`[MailService] [Mailtrap Live SDK] Email delivered directly to ${tester.email}: ${messageId}`);
                        return { success: true, messageId };
                    }
                } catch (liveErr: any) {
                    console.warn('[MailService] Mailtrap Live Send failed, attempting Sandbox fallback:', liveErr?.message);
                }

                // 3. Fallback: Auto-discover user's active sandbox inbox
                try {
                    const inboxesRes = await fetch('https://mailtrap.io/api/inboxes', {
                        headers: {
                            'Authorization': `Bearer ${mailtrapToken}`,
                            'Api-Token': mailtrapToken,
                        },
                    });
                    if (inboxesRes.ok) {
                        const inboxes = await inboxesRes.json();
                        if (Array.isArray(inboxes) && inboxes.length > 0) {
                            const defaultInboxId = inboxes[0].id;
                            const res = await fetch(`https://sandbox.api.mailtrap.io/api/send/${defaultInboxId}`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${mailtrapToken}`,
                                    'Api-Token': mailtrapToken,
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    from: { email: senderEmail, name: senderName },
                                    to: [{ email: tester.email, name: tester.name || 'Beta Tester' }],
                                    subject: template.subject,
                                    html,
                                    category: 'VIP Beta Invitation',
                                }),
                            });
                            const data = await res.json().catch(() => ({}));
                            if (res.ok && data.success !== false) {
                                const messageId = data.message_ids?.[0] || `mailtrap-${Date.now()}`;
                                console.log(`[MailService] [Mailtrap Sandbox Auto] Invitation delivered to inbox #${defaultInboxId}: ${messageId}`);
                                return { success: true, messageId };
                            }
                        }
                    }
                } catch (inboxErr: any) {
                    console.warn('[MailService] Auto inbox discovery failed:', inboxErr?.message);
                }

                console.error('[MailService] [Mailtrap Error]: Could not dispatch email');
                return { success: false, error: 'Mailtrap API dispatch failed' };
            }

            // ─── PRIORITY 2: Standard SMTP (Gmail, Custom SMTP) ─────────────────
            const transporter = this.getTransporter();
            const from = process.env.SMTP_FROM || (process.env.SMTP_USER ? `"${template.appName}" <${process.env.SMTP_USER}>` : `"${template.appName}" <no-reply@newsflow.ai>`);

            if (!process.env.SMTP_USER) {
                console.log(`[MailService] [SIMULATED] Invitation email generated for ${tester.email}:`);
                console.log(`Subject: ${template.subject}`);
                return {
                    success: true,
                    messageId: `simulated-msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                };
            }

            const info = await transporter.sendMail({
                from,
                to: tester.email,
                subject: template.subject,
                html,
            });

            console.log(`[MailService] [SMTP] Invitation sent to ${tester.email}: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (err: any) {
            console.error(`[MailService] Error sending invitation to ${tester.email}:`, err);
            return { success: false, error: err?.message || 'Failed to dispatch email' };
        }
    }
}
