import { Request, Response } from 'express';
import { BetaTesterService } from '../services/betaTesterService';
import { MailService, DEFAULT_EMAIL_TEMPLATE, EmailTemplateConfig } from '../services/mailService';

export class BetaController {
    /**
     * Render Public Beta Registration Landing Page (GET /join-beta)
     */
    public static renderPublicLanding(req: Request, res: Response): void {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NewsFlow • VIP Beta Tester Access</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #070B14;
      --card-bg: rgba(15, 23, 42, 0.75);
      --border: rgba(255, 255, 255, 0.1);
      --primary: #3B82F6;
      --primary-glow: rgba(59, 130, 246, 0.35);
      --accent: #F59E0B;
      --text: #F8FAFC;
      --text-muted: #94A3B8;
      --success: #10B981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.15) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(245, 158, 11, 0.12) 0px, transparent 50%),
        radial-gradient(at 50% 50%, rgba(15, 23, 42, 0.8) 0px, transparent 100%);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      max-width: 520px;
    }
    .brand-header {
      text-align: center;
      margin-bottom: 28px;
    }
    .brand-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: var(--accent);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 16px;
      animation: pulse 2s infinite ease-in-out;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.85; transform: scale(1.02); }
    }
    .brand-title {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.03em;
      background: linear-gradient(135deg, #FFFFFF 30%, #94A3B8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .brand-subtitle {
      font-size: 15px;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 32px 28px;
      box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05);
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, #3B82F6, #F59E0B, #10B981);
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #CBD5E1;
      margin-bottom: 8px;
    }
    input[type="text"], input[type="email"], select, textarea {
      width: 100%;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 12px 16px;
      color: #FFFFFF;
      font-size: 15px;
      font-family: inherit;
      outline: none;
      transition: all 0.2s ease;
    }
    input:focus, select:focus, textarea:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-glow);
      background: rgba(15, 23, 42, 0.9);
    }
    .device-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
    }
    .device-option {
      cursor: pointer;
      position: relative;
    }
    .device-option input {
      position: absolute;
      opacity: 0;
      cursor: pointer;
    }
    .device-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 12px 8px;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      transition: all 0.2s ease;
    }
    .device-option input:checked + .device-box {
      background: rgba(59, 130, 246, 0.15);
      border-color: var(--primary);
      color: #FFFFFF;
      box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
    }
    .submit-btn {
      width: 100%;
      background: linear-gradient(135deg, #2563EB, #1D4ED8);
      color: #FFFFFF;
      border: none;
      border-radius: 12px;
      padding: 14px;
      font-size: 16px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(37, 99, 235, 0.4);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 10px;
    }
    .submit-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(37, 99, 235, 0.5);
    }
    .submit-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .feature-list {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-top: 24px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .feature-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .success-card {
      display: none;
      text-align: center;
      padding: 20px 10px;
    }
    .success-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--success);
      font-size: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px auto;
    }
    .success-title {
      font-size: 22px;
      font-weight: 800;
      color: #FFFFFF;
      margin-bottom: 8px;
    }
    .success-desc {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 20px;
    }
    .access-code-pill {
      display: inline-block;
      background: rgba(245, 158, 11, 0.15);
      border: 1px dashed rgba(245, 158, 11, 0.4);
      color: var(--accent);
      padding: 8px 16px;
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 15px;
      font-weight: 700;
    }
    .alert-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #F87171;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 16px;
      display: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="brand-header">
      <div class="brand-pill">✨ Official Waitlist Open</div>
      <h1 class="brand-title">NewsFlow VIP Beta</h1>
      <p class="brand-subtitle">Experience 60-word verified breaking news, neural voice narration, and in-place story streams.</p>
    </div>

    <div class="card">
      <div id="error-box" class="alert-error"></div>

      <form id="beta-form">
        <div class="form-group">
          <label for="name">Your Name</label>
          <input type="text" id="name" name="name" placeholder="e.g. Alex Sharma" required />
        </div>

        <div class="form-group">
          <label for="email">Email Address <span style="color:#F59E0B">*</span></label>
          <input type="email" id="email" name="email" placeholder="you@example.com" required />
        </div>

        <div class="form-group">
          <label>Preferred Testing Platform</label>
          <div class="device-grid">
            <label class="device-option">
              <input type="radio" name="deviceType" value="ANDROID" checked />
              <div class="device-box">
                <span style="font-size: 20px;">🤖</span>
                <span>Android</span>
              </div>
            </label>
            <label class="device-option">
              <input type="radio" name="deviceType" value="IOS" />
              <div class="device-box">
                <span style="font-size: 20px;">🍎</span>
                <span>iOS</span>
              </div>
            </label>
            <label class="device-option">
              <input type="radio" name="deviceType" value="BOTH" />
              <div class="device-box">
                <span style="font-size: 20px;">📱</span>
                <span>Both</span>
              </div>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label for="notes">Favorite News Topics (Optional)</label>
          <input type="text" id="notes" name="notes" placeholder="e.g. Tech, AI, World Affairs, Cricket" />
        </div>

        <button type="submit" id="submit-btn" class="submit-btn">
          <span>🚀 Request VIP Beta Access</span>
        </button>
      </form>

      <div id="success-box" class="success-card">
        <div class="success-icon">🎉</div>
        <h2 class="success-title">You're on the VIP List!</h2>
        <p class="success-desc">
          Thank you for joining. When invitations open, you will receive an email with the Play Store / TestFlight download links and early-access story updates.
        </p>
        <div class="access-code-pill">PASS CODE: VIP-NEWS-2026</div>
      </div>
    </div>

    <div class="feature-list">
      <div class="feature-item">⚡ 60-Word Shorts</div>
      <div class="feature-item">🎙️ Edge AI Voices</div>
      <div class="feature-item">🛡️ 0 Ad Tracking</div>
    </div>
  </div>

  <script>
    const form = document.getElementById('beta-form');
    const submitBtn = document.getElementById('submit-btn');
    const errorBox = document.getElementById('error-box');
    const successBox = document.getElementById('success-box');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.style.display = 'none';

      const email = document.getElementById('email').value.trim();
      const name = document.getElementById('name').value.trim();
      const deviceType = document.querySelector('input[name="deviceType"]:checked')?.value || 'ANDROID';
      const notes = document.getElementById('notes').value.trim();

      if (!email || !email.includes('@')) {
        errorBox.textContent = 'Please enter a valid email address.';
        errorBox.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>⏳ Securing your spot...</span>';

      try {
        const res = await fetch('/api/beta/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name, deviceType, notes }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          form.style.display = 'none';
          successBox.style.display = 'block';
        } else {
          errorBox.textContent = data.error || 'Failed to submit registration. Please try again.';
          errorBox.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>🚀 Request VIP Beta Access</span>';
        }
      } catch (err) {
        errorBox.textContent = 'Network error. Please try again.';
        errorBox.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>🚀 Request VIP Beta Access</span>';
      }
    });
  </script>
</body>
</html>`;
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    }

    /**
     * Handle Public Beta Registration (POST /api/beta/register)
     */
    public static async registerTester(req: Request, res: Response): Promise<void> {
        try {
            const { email, name, deviceType, notes } = req.body;
            if (!email || typeof email !== 'string' || !email.includes('@')) {
                res.status(400).json({ success: false, error: 'Valid email address is required.' });
                return;
            }

            const { tester, isNew } = await BetaTesterService.register({
                email,
                name,
                deviceType,
                notes,
            });

            res.json({
                success: true,
                isNew,
                tester: {
                    id: tester.id,
                    email: tester.email,
                    name: tester.name,
                    deviceType: tester.deviceType,
                    status: tester.status,
                },
            });
        } catch (e: any) {
            res.status(500).json({ success: false, error: e?.message || 'Server error' });
        }
    }

    /**
     * Get All Beta Testers & Metrics (GET /api/beta/list)
     */
    public static getTesters(req: Request, res: Response): void {
        try {
            const testers = BetaTesterService.getAll();
            const metrics = BetaTesterService.getMetrics();
            res.json({ success: true, testers, metrics });
        } catch (e: any) {
            res.status(500).json({ success: false, error: e?.message });
        }
    }

    /**
     * Get Email Template (GET /api/beta/template)
     */
    public static getTemplate(req: Request, res: Response): void {
        const template = MailService.getTemplate();
        res.json({ success: true, template });
    }

    /**
     * Update Email Template (POST /api/beta/template)
     */
    public static updateTemplate(req: Request, res: Response): void {
        try {
            const updated = MailService.saveTemplate(req.body);
            res.json({ success: true, template: updated });
        } catch (e: any) {
            res.status(500).json({ success: false, error: e?.message });
        }
    }

    /**
     * Render Real-Time HTML Email Preview (POST /api/beta/preview)
     */
    public static renderLivePreview(req: Request, res: Response): void {
        try {
            const template: EmailTemplateConfig = {
                ...MailService.getTemplate(),
                ...req.body,
            };
            const sampleUser = {
                name: 'Alex Sharma',
                email: 'alex@example.com',
                deviceType: req.body.sampleDevice || 'BOTH',
            };
            const html = MailService.renderEmailHtml(template, sampleUser);
            res.setHeader('Content-Type', 'text/html');
            res.send(html);
        } catch (e: any) {
            res.status(500).send(`Error rendering preview: ${e?.message}`);
        }
    }

    /**
     * Send Invitation Email (POST /api/beta/send-invite)
     */
    public static async sendInvitation(req: Request, res: Response): Promise<void> {
        try {
            const { email, allPending, customTemplate } = req.body;

            if (allPending) {
                const testers = BetaTesterService.getAll().filter((t) => t.status === 'PENDING');
                let sentCount = 0;
                for (const tester of testers) {
                    const result = await MailService.sendBetaInvitation(tester, customTemplate);
                    if (result.success) {
                        BetaTesterService.markInviteSent(tester.email);
                        sentCount++;
                    }
                }
                res.json({
                    success: true,
                    sentCount,
                    totalPending: testers.length,
                    message: `Dispatched invitations to ${sentCount} beta testers.`,
                });
                return;
            }

            if (!email) {
                res.status(400).json({ success: false, error: 'Email parameter is required.' });
                return;
            }

            const tester = BetaTesterService.find(email);
            if (!tester) {
                res.status(404).json({ success: false, error: `Tester with email ${email} not found.` });
                return;
            }

            const result = await MailService.sendBetaInvitation(tester, customTemplate);
            if (result.success) {
                BetaTesterService.markInviteSent(tester.email);
                res.json({
                    success: true,
                    messageId: result.messageId,
                    tester: BetaTesterService.find(email),
                });
            } else {
                res.status(500).json({ success: false, error: result.error });
            }
        } catch (e: any) {
            res.status(500).json({ success: false, error: e?.message });
        }
    }

    /**
     * Delete Beta Tester (DELETE /api/beta/:id)
     */
    public static deleteTester(req: Request, res: Response): void {
        const { id } = req.params;
        const success = BetaTesterService.delete(id);
        res.json({ success });
    }
}
