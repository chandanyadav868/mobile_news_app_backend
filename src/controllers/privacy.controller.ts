import { Request, Response } from 'express';

export class PrivacyController {
  public static renderPrivacyPolicy(_req: Request, res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - News Flow</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #111827;
      --border: #1f2937;
      --text: #e5e7eb;
      --text-muted: #9ca3af;
      --primary: #3b82f6;
      --primary-glow: rgba(59, 130, 246, 0.12);
      --accent: #10b981;
      --accent-glow: rgba(16, 185, 129, 0.1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.7;
      padding: 40px 20px;
    }
    .container {
      max-width: 820px;
      margin: 0 auto;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 44px;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.6);
    }
    .header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      background: var(--primary-glow);
      color: var(--primary);
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 2.1rem;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 8px;
    }
    .meta {
      color: var(--text-muted);
      font-size: 0.9rem;
    }
    h2 {
      font-size: 1.3rem;
      font-weight: 700;
      color: #f3f4f6;
      margin-top: 32px;
      margin-bottom: 14px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    h3 {
      font-size: 1.05rem;
      font-weight: 600;
      color: #93c5fd;
      margin-top: 18px;
      margin-bottom: 8px;
    }
    p {
      margin-bottom: 14px;
      color: var(--text);
    }
    ul, ol {
      margin-bottom: 14px;
      padding-left: 22px;
    }
    li {
      margin-bottom: 8px;
    }
    .box {
      background: var(--primary-glow);
      border-left: 4px solid var(--primary);
      padding: 16px 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .box-info {
      background: rgba(16, 185, 129, 0.07);
      border-left: 4px solid var(--accent);
      padding: 16px 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    strong { color: #ffffff; }
    a { color: var(--primary); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer {
      border-top: 1px solid var(--border);
      margin-top: 44px;
      padding-top: 24px;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.85rem;
    }
    @media (max-width: 640px) {
      body { padding: 16px 10px; }
      .container { padding: 24px 18px; border-radius: 12px; }
      h1 { font-size: 1.65rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">Official Policy</div>
      <h1>Privacy Policy for News Flow</h1>
      <div class="meta">
        <strong>Application:</strong> News Flow &bull;
        <strong>Developer:</strong> TwoGamers &bull;
        <strong>Last Updated:</strong> September 7, 2026
      </div>
    </div>

    <p>Welcome to <strong>News Flow</strong>, developed by <strong>TwoGamers</strong> ("we", "our", or "us"). We value your privacy and are committed to protecting any information you share with us. This Privacy Policy explains our data practices in simple, transparent terms.</p>

    <h2>1. Information We Collect</h2>
    <h3>A. Information You Provide</h3>
    <ul>
      <li><strong>Account Details (Optional):</strong> You can freely read news without creating an account. If you choose to register, we collect your name and email address to manage your account and synchronize your saved stories across devices.</li>
      <li><strong>Support & Feedback:</strong> If you contact us for assistance or feedback, we receive your email and message details to help resolve your inquiry.</li>
    </ul>

    <h3>B. Information Collected Automatically</h3>
    <ul>
      <li><strong>Reading Preferences:</strong> Your saved bookmarks, preferred news categories, and reading history to personalize your news experience.</li>
      <li><strong>Device & Diagnostics:</strong> Basic non-identifying device details (such as device model, OS version, and network status) and anonymous crash logs to ensure app reliability and fix bugs.</li>
      <li><strong>Push Notification Tokens:</strong> If you opt in to notifications, a device push token is generated to send you breaking news headlines and updates. You can turn notifications off anytime in your app or device settings.</li>
    </ul>

    <h2>2. Third-Party Services & Advertising</h2>
    <p>We partner with trusted third-party providers to operate and support the app:</p>
    <ul>
      <li><strong>Google AdMob:</strong> We display advertisements provided by Google AdMob to keep News Flow free. AdMob may use anonymous advertising identifiers to serve relevant ads and prevent fraud. You can opt out of personalized ads at any time via your device settings (<em>Settings &gt; Google &gt; Ads</em> on Android or <em>Settings &gt; Privacy &amp; Security &gt; Tracking</em> on iOS).</li>
      <li><strong>Push Notifications & Stability:</strong> We use standard cloud notification services and crash diagnostic tools that process technical device tokens without accessing your personal identity.</li>
    </ul>
    <p>We <strong>never sell, rent, or trade</strong> your personal information to third parties.</p>

    <h2>3. How We Use Your Information</h2>
    <ul>
      <li>To deliver news articles, summaries, and audio reading features.</li>
      <li>To save your bookmarked stories and topic preferences.</li>
      <li>To send breaking news alerts (only if you enabled notifications).</li>
      <li>To maintain app security, prevent abuse, and diagnose technical errors.</li>
      <li>To display non-intrusive advertisements.</li>
    </ul>

    <h2>4. Data Security</h2>
    <p>We use industry-standard security safeguards, including HTTPS encryption in transit and secure on-device storage, to protect your personal information against unauthorized access, loss, or misuse.</p>

    <h2>5. User Rights & Account Deletion</h2>
    <div class="box-info">
      <strong>Your Data, Your Control:</strong>
      <p style="margin-top: 8px;">You can permanently delete your account and associated personal data at any time:</p>
      <ul style="margin-top: 8px; margin-bottom: 0;">
        <li><strong>In-App Deletion:</strong> Open the app &gt; go to <strong>Profile / Settings &gt; Delete Account</strong> and confirm. Your account, credentials, and saved bookmarks will be deleted immediately.</li>
        <li><strong>Email Request:</strong> You can also email us at <a href="mailto:support@twogamers.com">support@twogamers.com</a> with the subject <em>"Delete My Account"</em> and we will promptly process your request.</li>
      </ul>
    </div>

    <h2>6. Children's Privacy</h2>
    <p>News Flow is intended for general audiences and is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us so we can immediately delete it.</p>

    <h2>7. Changes to This Policy</h2>
    <p>We may update this Privacy Policy from time to time. Any changes will be posted directly on this page with an updated "Last Updated" date.</p>

    <h2>8. Contact Us</h2>
    <p>If you have any questions or concerns regarding this Privacy Policy, please reach out to us:</p>
    <ul>
      <li><strong>Developer:</strong> TwoGamers</li>
      <li><strong>Email:</strong> <a href="mailto:support@twogamers.com">support@twogamers.com</a></li>
    </ul>

    <div class="footer">
      &copy; 2026 TwoGamers. All rights reserved. &bull; News Flow Privacy Policy
    </div>
  </div>
</body>
</html>`);
  }
}
