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

    /**
     * Render Dedicated Standalone Beta Testers & Email Campaign Studio (GET /campaigns, GET /testers)
     */
    public static renderCampaignStudio(req: Request, res: Response): void {
        const template = MailService.getTemplate();
        const initialPreviewHtml = MailService.renderEmailHtml(template, {
            name: 'Alex Sharma',
            email: 'alex.sharma@example.com',
            deviceType: 'BOTH',
        });

        const initialEncodedPreview = Buffer.from(initialPreviewHtml).toString('base64');

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NewsFlow • Beta Tester & Email Campaign Studio</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #070B14;
            --surface: #0E1626;
            --surface-card: rgba(15, 23, 42, 0.85);
            --border: rgba(255, 255, 255, 0.1);
            --border-highlight: rgba(59, 130, 246, 0.4);
            --primary: #3B82F6;
            --primary-glow: rgba(59, 130, 246, 0.35);
            --accent: #F59E0B;
            --text-main: #F8FAFC;
            --text-sub: #94A3B8;
            --success: #10B981;
            --danger: #EF4444;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            background-color: var(--bg);
            background-image: 
                radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.12) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(245, 158, 11, 0.1) 0px, transparent 50%),
                radial-gradient(at 50% 50%, rgba(15, 23, 42, 0.8) 0px, transparent 100%);
            color: var(--text-main);
            font-family: 'Plus Jakarta Sans', sans-serif;
            min-height: 100vh;
            padding: 24px 28px;
            -webkit-font-smoothing: antialiased;
        }

        .container {
            max-width: 1440px;
            margin: 0 auto;
        }

        .top-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 24px;
            background: var(--surface-card);
            backdrop-filter: blur(20px);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 16px 24px;
        }

        .header-title-box h1 {
            font-size: 22px;
            font-weight: 800;
            letter-spacing: -0.02em;
            background: linear-gradient(135deg, #FFFFFF 40%, #94A3B8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 4px;
        }

        .header-title-box p {
            color: var(--text-sub);
            font-size: 13px;
        }

        .header-nav-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .btn-nav {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border);
            color: var(--text-main);
            padding: 9px 16px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 700;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
        }

        .btn-nav:hover {
            background: rgba(255, 255, 255, 0.1);
            transform: translateY(-1px);
        }

        .btn-nav-primary {
            background: rgba(245, 158, 11, 0.15);
            border-color: rgba(245, 158, 11, 0.4);
            color: #FBBF24;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }

        .card {
            background: var(--surface-card);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            position: relative;
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }

        .card-title {
            color: var(--text-sub);
            font-size: 13px;
            font-weight: 600;
        }

        .card-badge {
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
        }

        .val-large {
            font-size: 32px;
            font-weight: 800;
            font-family: 'JetBrains Mono', monospace;
            line-height: 1;
            margin-bottom: 6px;
        }

        .val-sub {
            font-size: 12px;
            color: var(--text-sub);
        }

        .split-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 24px;
        }

        @media (max-width: 1080px) {
            .split-grid { grid-template-columns: 1fr; }
        }

        .studio-card {
            background: var(--surface-card);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 18px;
            flex-wrap: wrap;
            gap: 8px;
        }

        .section-title {
            font-size: 16px;
            font-weight: 800;
            color: #FFFFFF;
        }

        .input-group {
            margin-bottom: 14px;
        }

        label {
            display: block;
            font-size: 12px;
            font-weight: 700;
            color: #CBD5E1;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }

        input[type="text"], textarea, select {
            width: 100%;
            background: rgba(15, 23, 42, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 10px;
            padding: 10px 14px;
            color: #FFFFFF;
            font-size: 14px;
            font-family: inherit;
            outline: none;
            transition: all 0.2s ease;
        }

        input:focus, textarea:focus, select:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px var(--primary-glow);
            background: rgba(15, 23, 42, 0.95);
        }

        .btn-primary {
            background: linear-gradient(135deg, #2563EB, #1D4ED8);
            color: #FFFFFF;
            border: none;
            border-radius: 10px;
            padding: 12px 18px;
            font-size: 14px;
            font-weight: 700;
            font-family: inherit;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
            transition: all 0.2s ease;
        }

        .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 18px rgba(37, 99, 235, 0.45);
        }

        .btn-secondary {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border);
            color: var(--text-main);
            border-radius: 10px;
            padding: 12px 18px;
            font-size: 14px;
            font-weight: 700;
            font-family: inherit;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .btn-success {
            background: linear-gradient(135deg, #10B981, #059669);
            border: 1px solid #10B981;
            color: #FFFFFF;
            border-radius: 10px;
            padding: 12px 18px;
            font-size: 14px;
            font-weight: 700;
            font-family: inherit;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
            transition: all 0.2s ease;
        }

        .btn-success:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 18px rgba(16, 185, 129, 0.45);
        }

        .preview-iframe-wrapper {
            width: 100%;
            height: 640px;
            border-radius: 14px;
            border: 1px solid var(--border);
            overflow: hidden;
            background: #0B0F19;
            transition: max-width 0.3s ease;
            margin: 0 auto;
            box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
        }

        .preview-iframe {
            width: 100%;
            height: 100%;
            border: none;
            background: #0B0F19;
        }

        .device-toggle-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border);
            color: var(--text-sub);
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
        }

        .device-toggle-btn.active {
            background: rgba(59, 130, 246, 0.2);
            border-color: var(--primary);
            color: #FFFFFF;
        }

        .testers-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        .testers-table th {
            text-align: left;
            padding: 12px 14px;
            background: rgba(15, 23, 42, 0.6);
            color: var(--text-sub);
            font-weight: 600;
            border-bottom: 1px solid var(--border);
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.05em;
        }

        .testers-table td {
            padding: 14px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            color: var(--text-main);
            vertical-align: middle;
        }

        .testers-table tr:hover td {
            background: rgba(255, 255, 255, 0.02);
        }

        .status-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }

        .status-badge.pending {
            background: rgba(245, 158, 11, 0.15);
            color: #FBBF24;
            border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .status-badge.invited {
            background: rgba(16, 185, 129, 0.15);
            color: #34D399;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .device-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.05);
        }

        .btn-table-action {
            background: rgba(37, 99, 235, 0.15);
            border: 1px solid rgba(37, 99, 235, 0.35);
            color: #60A5FA;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .btn-table-action:hover {
            background: rgba(37, 99, 235, 0.3);
            color: #FFF;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Top Navigation Header -->
        <header class="top-header">
            <div class="header-title-box">
                <h1>👥 Beta Tester & Email Campaign Studio</h1>
                <p>Manage subscribers, edit email layouts, and dispatch VIP access invitations</p>
            </div>
            <div class="header-nav-actions">
                <a href="/dashboard" class="btn-nav">
                    <span>⚡ Back to Mission Control</span>
                </a>
                <a href="/join-beta" target="_blank" class="btn-nav btn-nav-primary">
                    <span>🌐 Public Waitlist Form ↗</span>
                </a>
            </div>
        </header>

        <!-- Metrics Overview -->
        <div class="metrics-grid">
            <div class="card">
                <div class="card-header">
                    <span class="card-title">Total Waitlist Testers</span>
                    <span class="card-badge" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA;">Live</span>
                </div>
                <div class="val-large" id="tester-total-count" style="color: #60A5FA;">0</div>
                <div class="val-sub">Registered public users</div>
            </div>
            <div class="card">
                <div class="card-header">
                    <span class="card-title">Android Testers</span>
                    <span class="card-badge" style="background: rgba(16, 185, 129, 0.15); color: #34D399;">🤖 Play Store</span>
                </div>
                <div class="val-large" id="tester-android-count" style="color: #34D399;">0</div>
                <div class="val-sub">Android & Dual devices</div>
            </div>
            <div class="card">
                <div class="card-header">
                    <span class="card-title">iOS Testers</span>
                    <span class="card-badge" style="background: rgba(245, 158, 11, 0.15); color: #FBBF24;">🍎 TestFlight</span>
                </div>
                <div class="val-large" id="tester-ios-count" style="color: #FBBF24;">0</div>
                <div class="val-sub">Apple TestFlight users</div>
            </div>
            <div class="card">
                <div class="card-header">
                    <span class="card-title">Pending Invitations</span>
                    <span class="card-badge" style="background: rgba(239, 68, 68, 0.15); color: #F87171;">Action Required</span>
                </div>
                <div class="val-large" id="tester-pending-count" style="color: #F87171;">0</div>
                <div class="val-sub">Uninvited subscribers</div>
            </div>
        </div>

        <!-- Split Grid: Template Editor & Real-Time Live Preview -->
        <div class="split-grid">
            <!-- Left Pane: Template Editor -->
            <div class="studio-card">
                <div class="section-header">
                    <div>
                        <h2 class="section-title">✉️ Email Campaign & Story Editor</h2>
                        <span class="val-sub">Edits update the live preview pane immediately</span>
                    </div>
                </div>

                <div class="input-group">
                    <label>Email Subject Line</label>
                    <input type="text" id="tpl-subject" oninput="updateLivePreview()" value="${template.subject}">
                </div>

                <div class="input-group">
                    <label>Headline Title</label>
                    <input type="text" id="tpl-headline" oninput="updateLivePreview()" value="${template.headline}">
                </div>

                <div class="input-group">
                    <label>Hero Banner Image URL</label>
                    <input type="text" id="tpl-hero-img" oninput="updateLivePreview()" value="${template.heroImageUrl}">
                </div>

                <div class="input-group">
                    <label>Introductory Message</label>
                    <textarea id="tpl-intro" rows="2" oninput="updateLivePreview()">${template.introMessage}</textarea>
                </div>

                <div class="input-group">
                    <label>Featured Story Card Title</label>
                    <input type="text" id="tpl-story-title" oninput="updateLivePreview()" value="${template.storyTitle}">
                </div>

                <div class="input-group">
                    <label>Featured Story Summary</label>
                    <textarea id="tpl-story-summary" rows="3" oninput="updateLivePreview()">${template.storySummary}</textarea>
                </div>

                <div class="input-group">
                    <label>Android Play Store / Testing Link</label>
                    <input type="text" id="tpl-android-url" oninput="updateLivePreview()" value="${template.androidUrl}">
                </div>

                <div class="input-group">
                    <label>Apple TestFlight Link</label>
                    <input type="text" id="tpl-ios-url" oninput="updateLivePreview()" value="${template.iosUrl}">
                </div>

                <div class="input-group">
                    <label>Direct APK Download Link</label>
                    <input type="text" id="tpl-apk-url" oninput="updateLivePreview()" value="${template.apkDirectUrl}">
                </div>

                <div class="input-group">
                    <label>VIP Access Code</label>
                    <input type="text" id="tpl-code" oninput="updateLivePreview()" value="${template.invitationCode}">
                </div>

                <div style="display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap;">
                    <button class="btn-primary" onclick="saveEmailTemplate()" style="flex: 1;">💾 Save Template</button>
                    <button class="btn-secondary" onclick="resetEmailTemplateDefault()">🔄 Reset Default</button>
                    <button class="btn-success" onclick="sendInviteToAllPending()">🚀 Send to All Pending</button>
                </div>
            </div>

            <!-- Right Pane: Real-Time Interactive Live Preview -->
            <div class="studio-card" style="display: flex; flex-direction: column;">
                <div class="section-header">
                    <div>
                        <h2 class="section-title">👁️ Real-Time Live Email Preview</h2>
                        <span class="val-sub">Exact rendering for mobile & desktop clients</span>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="device-toggle-btn active" id="btn-view-mobile" onclick="setPreviewDevice('mobile')">📱 Mobile (380px)</button>
                        <button class="device-toggle-btn" id="btn-view-desktop" onclick="setPreviewDevice('desktop')">💻 Desktop (100%)</button>
                    </div>
                </div>

                <div class="preview-iframe-wrapper" id="preview-wrapper" style="max-width: 380px;">
                    <iframe id="email-preview-iframe" class="preview-iframe"></iframe>
                </div>
            </div>
        </div>

        <!-- Beta Tester Registry Table -->
        <div class="studio-card">
            <div class="section-header">
                <div>
                    <h2 class="section-title">👥 Registered Public Beta Testers</h2>
                    <span class="val-sub">Real-time subscriber list with one-click dispatch</span>
                </div>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <input type="text" id="tester-search" oninput="filterTestersTable()" placeholder="🔍 Search name or email..." style="width: 220px; padding: 8px 12px; font-size: 13px;">
                    <select id="tester-filter" onchange="filterTestersTable()" style="padding: 8px 12px; font-size: 13px; width: 140px;">
                        <option value="ALL">All Statuses</option>
                        <option value="PENDING">Pending Only</option>
                        <option value="INVITED">Invited Only</option>
                        <option value="ANDROID">Android Only</option>
                        <option value="IOS">iOS Only</option>
                    </select>
                    <button class="btn-secondary" onclick="loadTestersList()" style="padding: 8px 14px; font-size: 13px;">🔄 Refresh</button>
                </div>
            </div>

            <div style="overflow-x: auto;">
                <table class="testers-table">
                    <thead>
                        <tr>
                            <th>Tester Name & Email</th>
                            <th>Platform</th>
                            <th>Favorite Topics</th>
                            <th>Status</th>
                            <th>Registered</th>
                            <th>Invited At</th>
                            <th style="text-align: right;">Action</th>
                        </tr>
                    </thead>
                    <tbody id="testers-table-body">
                        <tr>
                            <td colspan="7" style="text-align: center; color: var(--text-sub); padding: 32px;">Loading subscribers...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        let allTestersData = [];
        let previewDebounceTimer = null;

        // Initialize preview on page load immediately from base64 pre-rendered template
        window.addEventListener('DOMContentLoaded', () => {
            const iframe = document.getElementById('email-preview-iframe');
            if (iframe) {
                try {
                    iframe.srcdoc = atob('${initialEncodedPreview}');
                } catch(e) {
                    updateLivePreview();
                }
            }
            loadTestersList();
        });

        async function loadTestersList() {
            try {
                const res = await fetch('/api/beta/list');
                const json = await res.json();
                if (json.success) {
                    allTestersData = json.testers || [];
                    renderTestersMetrics(json.metrics);
                    renderTestersTable(allTestersData);
                }
            } catch (err) {
                console.warn('Failed to load testers list:', err);
            }
        }

        function renderTestersMetrics(m) {
            if (!m) return;
            document.getElementById('tester-total-count').textContent = m.total || 0;
            document.getElementById('tester-android-count').textContent = (m.android || 0) + (m.both || 0);
            document.getElementById('tester-ios-count').textContent = (m.ios || 0) + (m.both || 0);
            document.getElementById('tester-pending-count').textContent = m.pending || 0;
        }

        function renderTestersTable(list) {
            const tbody = document.getElementById('testers-table-body');
            if (!list || list.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-sub); padding: 32px;">No registered beta testers found yet. Distribute <a href="/join-beta" target="_blank" style="color: #60A5FA;">/join-beta</a> to start collecting signups!</td></tr>';
                return;
            }

            tbody.innerHTML = list.map(t => {
                const deviceIcon = t.deviceType === 'IOS' ? '🍎 iOS' : t.deviceType === 'BOTH' ? '📱 Both' : '🤖 Android';
                const statusClass = t.status === 'INVITED' ? 'invited' : 'pending';
                const statusText = t.status === 'INVITED' ? '✅ INVITED' : '⏳ PENDING';
                const regDate = new Date(t.createdAt).toLocaleDateString();
                const inviteDate = t.inviteSentAt ? new Date(t.inviteSentAt).toLocaleDateString() : 'Never';

                return '<tr>' +
                    '<td><strong style="color: #FFFFFF;">' + (t.name || 'Anonymous User') + '</strong><br>' +
                    '<span style="font-family: monospace; font-size: 12px; color: #94A3B8;">' + t.email + '</span></td>' +
                    '<td><span class="device-pill">' + deviceIcon + '</span></td>' +
                    '<td style="color: var(--text-sub); font-size: 12px;">' + (t.notes || 'General News') + '</td>' +
                    '<td><span class="status-badge ' + statusClass + '">' + statusText + '</span></td>' +
                    '<td style="color: var(--text-sub); font-size: 12px;">' + regDate + '</td>' +
                    '<td style="color: var(--text-sub); font-size: 12px;">' + inviteDate + '</td>' +
                    '<td style="text-align: right;">' +
                        '<div style="display: inline-flex; gap: 6px;">' +
                            '<button class="btn-table-action" onclick="sendInviteSingle(\'' + t.email + '\', this)"><span>✉️ Send Invite</span></button>' +
                            '<button class="btn-table-action" style="color: #F87171; border-color: rgba(239, 68, 68, 0.3);" onclick="deleteTesterRecord(\'' + t.id + '\')"><span>🗑️</span></button>' +
                        '</div>' +
                    '</td>' +
                '</tr>';
            }).join('');
        }

        function filterTestersTable() {
            const query = document.getElementById('tester-search').value.toLowerCase().trim();
            const filter = document.getElementById('tester-filter').value;

            const filtered = allTestersData.filter(t => {
                const matchQuery = !query || (t.name && t.name.toLowerCase().includes(query)) || t.email.toLowerCase().includes(query);
                if (!matchQuery) return false;

                if (filter === 'PENDING') return t.status === 'PENDING';
                if (filter === 'INVITED') return t.status === 'INVITED';
                if (filter === 'ANDROID') return t.deviceType === 'ANDROID' || t.deviceType === 'BOTH';
                if (filter === 'IOS') return t.deviceType === 'IOS' || t.deviceType === 'BOTH';
                return true;
            });

            renderTestersTable(filtered);
        }

        function getFormTemplatePayload() {
            return {
                subject: document.getElementById('tpl-subject').value,
                headline: document.getElementById('tpl-headline').value,
                heroImageUrl: document.getElementById('tpl-hero-img').value,
                introMessage: document.getElementById('tpl-intro').value,
                storyTitle: document.getElementById('tpl-story-title').value,
                storySummary: document.getElementById('tpl-story-summary').value,
                androidUrl: document.getElementById('tpl-android-url').value,
                iosUrl: document.getElementById('tpl-ios-url').value,
                apkDirectUrl: document.getElementById('tpl-apk-url').value,
                invitationCode: document.getElementById('tpl-code').value,
            };
        }

        function updateLivePreview() {
            if (previewDebounceTimer) clearTimeout(previewDebounceTimer);
            previewDebounceTimer = setTimeout(async () => {
                const payload = getFormTemplatePayload();
                try {
                    const res = await fetch('/api/beta/preview', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    const html = await res.text();
                    const iframe = document.getElementById('email-preview-iframe');
                    if (iframe) iframe.srcdoc = html;
                } catch (e) {
                    console.warn('Preview render error:', e);
                }
            }, 80);
        }

        function setPreviewDevice(mode) {
            const wrapper = document.getElementById('preview-wrapper');
            const btnMob = document.getElementById('btn-view-mobile');
            const btnDesk = document.getElementById('btn-view-desktop');

            if (mode === 'desktop') {
                wrapper.style.maxWidth = '100%';
                btnDesk.classList.add('active');
                btnMob.classList.remove('active');
            } else {
                wrapper.style.maxWidth = '380px';
                btnMob.classList.add('active');
                btnDesk.classList.remove('active');
            }
        }

        async function saveEmailTemplate() {
            const payload = getFormTemplatePayload();
            try {
                const res = await fetch('/api/beta/template', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const json = await res.json();
                if (json.success) {
                    alert('✅ Email template saved successfully!');
                }
            } catch (e) {
                alert('Error saving template: ' + e.message);
            }
        }

        async function resetEmailTemplateDefault() {
            if (!confirm('Reset template to default NewsFlow design?')) return;
            try {
                const res = await fetch('/api/beta/template', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                });
                location.reload();
            } catch (e) {
                alert('Error resetting template: ' + e.message);
            }
        }

        async function sendInviteSingle(email, btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span>⏳ Sending...</span>';
            btn.disabled = true;

            try {
                const customTemplate = getFormTemplatePayload();
                const res = await fetch('/api/beta/send-invite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, customTemplate }),
                });
                const json = await res.json();
                if (json.success) {
                    btn.innerHTML = '<span>✅ Sent</span>';
                    btn.style.color = '#34D399';
                    loadTestersList();
                } else {
                    alert('Failed to send email: ' + (json.error || 'Unknown error'));
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            } catch (e) {
                alert('Error: ' + e.message);
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }

        async function sendInviteToAllPending() {
            const pendingCount = allTestersData.filter(t => t.status === 'PENDING').length;
            if (pendingCount === 0) {
                alert('All subscribers have already received invitations!');
                return;
            }

            if (!confirm('🚀 Send customized invitation emails to ALL ' + pendingCount + ' pending beta testers now?')) return;

            try {
                const customTemplate = getFormTemplatePayload();
                const res = await fetch('/api/beta/send-invite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ allPending: true, customTemplate }),
                });
                const json = await res.json();
                alert(json.message || 'Invitations dispatched!');
                loadTestersList();
            } catch (e) {
                alert('Failed to dispatch batch invitations: ' + e.message);
            }
        }

        async function deleteTesterRecord(id) {
            if (!confirm('Remove this beta tester from waitlist?')) return;
            try {
                await fetch('/api/beta/' + id, { method: 'DELETE' });
                loadTestersList();
            } catch (e) {
                alert('Delete error: ' + e.message);
            }
        }
    </script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    }
}

