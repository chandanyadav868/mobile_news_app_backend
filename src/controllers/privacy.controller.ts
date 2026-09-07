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
      --bg: #090d16;
      --card-bg: #111726;
      --border: #1e293b;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --primary-glow: rgba(59, 130, 246, 0.15);
      --accent: #10b981;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.7;
      padding: 40px 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 48px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 24px;
      margin-bottom: 36px;
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
      font-size: 2.25rem;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 8px;
    }
    .meta {
      color: var(--text-muted);
      font-size: 0.9rem;
    }
    h2 {
      font-size: 1.35rem;
      font-weight: 700;
      color: #f1f5f9;
      margin-top: 36px;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    h3 {
      font-size: 1.1rem;
      font-weight: 600;
      color: #93c5fd;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    p {
      margin-bottom: 16px;
      color: var(--text);
    }
    ul, ol {
      margin-bottom: 16px;
      padding-left: 24px;
    }
    li {
      margin-bottom: 8px;
    }
    .box {
      background: rgba(59, 130, 246, 0.05);
      border-left: 4px solid var(--primary);
      padding: 16px 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .box-danger {
      background: rgba(239, 68, 68, 0.05);
      border-left-color: var(--danger);
    }
    .box-success {
      background: rgba(16, 185, 129, 0.05);
      border-left-color: var(--accent);
    }
    strong { color: #ffffff; }
    a { color: var(--primary); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code {
      background: #1e293b;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.85em;
      color: #38bdf8;
    }
    .footer {
      border-top: 1px solid var(--border);
      margin-top: 48px;
      padding-top: 24px;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.85rem;
    }
    @media (max-width: 640px) {
      body { padding: 16px 10px; }
      .container { padding: 24px; border-radius: 12px; }
      h1 { font-size: 1.75rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">Official Compliance Document</div>
      <h1>Privacy Policy for News Flow</h1>
      <div class="meta">
        <strong>Application:</strong> News Flow (<code>com.twogamers.mobile_app_news</code>) &bull;
        <strong>Effective Date:</strong> September 7, 2026 &bull;
        <strong>Publisher:</strong> TwoGamers
      </div>
    </div>

    <div class="box">
      <strong>Quick Summary:</strong> News Flow provides real-time curated news, audio summaries, and personalized topics. We do not sell your personal data. Authentication credentials are protected with hardware-backed encryption (Android KeyStore / iOS Keychain). You retain total control over your data with direct in-app and email-based account deletion options.
    </div>

    <h2>1. Introduction & Overview</h2>
    <p>Welcome to <strong>News Flow</strong> ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal information. This Privacy Policy details how we handle data collection, processing, and security across the News Flow mobile application and backend services.</p>
    <p>This policy complies with the <strong>Google Play Developer Policy</strong>, <strong>Apple App Store Review Guidelines</strong>, <strong>GDPR (EEA/UK)</strong>, <strong>CCPA/CPRA (California)</strong>, <strong>COPPA</strong>, and India's <strong>DPDPA 2023</strong>.</p>

    <h2>2. Information We Collect</h2>
    <h3>A. Information You Provide Directly</h3>
    <ul>
      <li><strong>Account Credentials (Optional):</strong> Your name, email address, and salted bcrypt-hashed password if you register an account. You can freely use News Flow as a guest without creating an account.</li>
      <li><strong>Google OAuth:</strong> If you sign in with Google, we access basic authorized profile data: display name, email, profile photo URL, and Google ID solely to authenticate you.</li>
      <li><strong>Support & Feedback:</strong> Messages, email addresses, and optional diagnostics sent when submitting feedback.</li>
    </ul>

    <h3>B. Information Collected Automatically</h3>
    <ul>
      <li><strong>Device & Network Data:</strong> Device model, OS version (Android/iOS), network status, IP address, and locale to serve relevant regional editions and defend against abuse.</li>
      <li><strong>Reading Interactions:</strong> Bookmarked articles, share events, preferred news topics, and reading history to personalize content.</li>
      <li><strong>Push Notification Tokens:</strong> Expo Push Tokens to deliver breaking news and quiet-hour-compliant digest notifications if enabled.</li>
    </ul>

    <h3>C. Device Permissions</h3>
    <ul>
      <li><code>POST_NOTIFICATIONS</code>: For optional news alerts and breaking headlines.</li>
      <li><code>CAMERA</code> & <code>READ_MEDIA_IMAGES</code>: Only if you choose to set a custom profile photo or utilize visual OCR features.</li>
      <li><code>INTERNET</code> & <code>ACCESS_NETWORK_STATE</code>: To fetch articles, stream audio summaries, and check connectivity.</li>
    </ul>

    <h2>3. Third-Party Services & Advertising (Google AdMob)</h2>
    <div class="box box-success">
      <p><strong>Google AdMob Disclosure:</strong></p>
      <p>News Flow displays banner and interstitial advertisements via <strong>Google Mobile Ads (AdMob)</strong> (App ID: <code>ca-app-pub-1412205696232927~3227915638</code>). AdMob may collect and process your <strong>Google Advertising ID (GAID)</strong> on Android or <strong>IDFA</strong> on iOS, IP address, and ad interaction metrics to deliver non-intrusive ads and prevent fraud.</p>
      <p>You can opt out of personalized ads at any time via your device settings (<em>Settings &gt; Google &gt; Ads &gt; Opt out of Ads Personalization</em> on Android, or <em>Settings &gt; Privacy &amp; Security &gt; Tracking</em> on iOS).</p>
    </div>
    <p>Other integrated partners include <strong>Expo Application Services</strong> (push notification routing) and <strong>Sentry</strong> (error diagnostics and crash telemetry). No personal identifying details are shared with public AI models.</p>

    <h2>4. Hardware-Backed Security & Data Retention</h2>
    <ul>
      <li><strong>Hardware-Backed Token Encryption:</strong> Auth tokens are encrypted using AES-256 GCM in <strong>Android KeyStore</strong> and <strong>Apple Keychain</strong> via <code>expo-secure-store</code>.</li>
      <li><strong>Automated 14-Day Pruning:</strong> Heavy scraped article bodies are zeroed out after 14 days.</li>
      <li><strong>Smart 30-Day Retention:</strong> Articles older than 30 days are automatically deleted unless saved by a user as a bookmark or shared.</li>
      <li><strong>In-Transit Encryption:</strong> All client-server communications are strictly protected via TLS 1.3 / HTTPS.</li>
    </ul>

    <h2>5. User Rights & Account Deletion Protocol</h2>
    <div class="box box-danger">
      <strong>Account & Data Deletion (Google Play Compliance):</strong>
      <p style="margin-top: 8px;">You have the absolute right to request permanent erasure of your account and all associated data.</p>
      <ol style="margin-top: 8px;">
        <li><strong>In-App:</strong> Go to <em>Profile &gt; Settings &gt; Account Settings &gt; Delete Account</em> and confirm. Deletion of profile data and bookmarks is immediate.</li>
        <li><strong>Via Email Request:</strong> Send an email to <a href="mailto:privacy@twogamers.com">privacy@twogamers.com</a> with subject <code>"Data Deletion Request - News Flow"</code> from your registered email address. We process email requests within 30 days.</li>
      </ol>
    </div>

    <h2>6. Children's Privacy</h2>
    <p>News Flow is designed for general audiences aged 13 and older (or 16 in the European Union). We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us immediately for prompt deletion.</p>

    <h2>7. Contact Us</h2>
    <p>For inquiries, privacy concerns, or data rights requests, contact our Data Protection Officer:</p>
    <ul>
      <li><strong>Developer / Publisher:</strong> TwoGamers</li>
      <li><strong>Email:</strong> <a href="mailto:privacy@twogamers.com">privacy@twogamers.com</a></li>
      <li><strong>Support:</strong> <a href="mailto:support@twogamers.com">support@twogamers.com</a></li>
      <li><strong>Package Name:</strong> <code>com.twogamers.mobile_app_news</code></li>
    </ul>

    <div class="footer">
      &copy; 2026 TwoGamers. All rights reserved. &bull; News Flow Privacy Policy
    </div>
  </div>
</body>
</html>`);
  }
}
