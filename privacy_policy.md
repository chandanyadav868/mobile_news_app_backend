# Privacy Policy for News Flow

**Effective Date:** September 7, 2026  
**Last Updated:** September 7, 2026  
**Application Name:** News Flow  
**Package Name / Application ID:** `com.twogamers.mobile_app_news`  
**Publisher / Developer:** TwoGamers (`twogamers`)  
**Contact Email:** privacy@twogamers.com  

---

## 1. Introduction & Overview

Welcome to **News Flow** ("we," "our," or "us"). We are dedicated to delivering fast, intelligent, and personalized news summaries while respecting and protecting your privacy. This Privacy Policy outlines how we collect, use, store, process, and disclose information when you use our mobile application (**"News Flow"** or the **"App"**) and associated backend services.

By installing, accessing, or using News Flow, you acknowledge that you have read, understood, and agreed to the practices described in this Privacy Policy. If you do not agree with this policy, please do not use the App.

This policy complies with:
- **Google Play Developer Policies** (including User Data Policy, Mobile Unwanted Software, and Families Policies)
- **Apple App Store Review Guidelines** (Section 5.1 - Privacy)
- **General Data Protection Regulation (GDPR)** for users in the European Economic Area (EEA) and United Kingdom (UK)
- **California Consumer Privacy Act (CCPA / CPRA)** for residents of California, USA
- **Digital Personal Data Protection Act (DPDPA 2023)** for users in India
- **Children's Online Privacy Protection Act (COPPA)**

---

## 2. Information We Collect

We collect information to provide, maintain, optimize, and personalize your news reading experience. The information collected falls into the following categories:

### A. Information You Provide Directly
1. **Account Credentials (Optional):**
   - When you create an account, we collect your **Name**, **Email Address**, and a securely hashed password.
   - You can browse news as a guest without creating an account.
2. **Social Sign-In (Google OAuth):**
   - If you choose to sign in using Google, we receive basic profile information authorized by you via Google OAuth: your **Display Name**, **Email Address**, **Profile Picture URL**, and **Google User ID**. We do not access your Google contacts, Google Drive, or other private Google account data.
3. **User Feedback & Support:**
   - If you submit feedback, bug reports, or contact support via in-app forms, we collect the contents of your message, email address, and optional device diagnostics you provide.

### B. Information Collected Automatically
1. **Device & Network Information:**
   - Device model, operating system and version (Android/iOS), unique device identifiers, IP address, preferred language, screen resolution, and network type (Wi-Fi, 4G, 5G).
2. **Usage & Interaction Data:**
   - Articles read, reading duration, search queries, bookmarked articles, shared stories, category preferences, and topics of interest.
   - This data is used on-device and in our secure backend to recommend relevant news stories.
3. **Push Notification Tokens:**
   - If you grant notification permissions, we generate an Expo Push Token (`expo-notifications`) associated with your device to deliver breaking news alerts, category digests, and daily updates based on your notification frequency and quiet hour preferences.

### C. Permissions Requested on Your Device
The App may request the following permissions only when necessary for specific features:
- **Notifications (`POST_NOTIFICATIONS`):** To deliver breaking news alerts and personalized updates. You may opt out at any time in App Settings or Device Settings.
- **Camera & Media Library (`CAMERA`, `READ_EXTERNAL_STORAGE` / `READ_MEDIA_IMAGES`):** Required only if you upload a profile avatar or use OCR visual text scanner tools. The App never accesses your photo gallery without explicit user interaction.
- **Internet & Network State (`INTERNET`, `ACCESS_NETWORK_STATE`):** To fetch news feeds, stream audio, sync bookmarks, and detect offline status.

---

## 3. Third-Party Services & Advertising Disclosures

News Flow integrates verified third-party SDKs to provide analytics, monetization, crash reporting, and cloud infrastructure:

### A. Advertising — Google AdMob
- **AdMob App ID:** `ca-app-pub-1412205696232927~3227915638`
- We use Google Mobile Ads (AdMob) to display non-intrusive advertisements (banners, interstitials).
- **Data Collected by AdMob:** AdMob may collect and process your **Google Advertising ID (GAID)** on Android or **IDFA** on iOS, IP address, device identifiers, and ad interaction data to serve contextual or personalized advertisements and prevent fraud.
- **Ad Choices & Opt-Out:** You can reset your Advertising ID or opt out of personalized ads at any time via your device settings:
  - *Android:* Settings > Google > Ads > Delete advertising ID / Opt out of Ads Personalization.
  - *iOS:* Settings > Privacy & Security > Tracking > Toggle off.
  - Review Google’s Advertising Privacy Policy: [https://policies.google.com/technologies/ads](https://policies.google.com/technologies/ads)

### B. Push Notifications — Expo Application Services (EAS)
- We use Expo Push Services to deliver push notifications. Expo processes device push tokens securely.
- Expo Privacy Policy: [https://expo.dev/privacy](https://expo.dev/privacy)

### C. Error Diagnostics & Application Monitoring — Sentry
- We use Sentry to catch crashes and unhandled exceptions. Sentry collects stack traces, device OS version, and crash timestamps to help our engineers resolve stability issues. No plain text passwords or sensitive biometric data are transmitted.
- Sentry Privacy Policy: [https://sentry.io/privacy/](https://sentry.io/privacy/)

### D. Artificial Intelligence & Text-to-Speech Processing
- News summaries, audio TTS vocalization, and language translations are processed via server-side APIs (such as Groq, Mistral, and Microsoft Edge Neural TTS).
- These AI engines process public news article text. **Your personal identity, user profile, and private data are NEVER shared with or used to train public third-party AI models.**

---

## 4. How We Use Your Information

We use the collected information strictly for legitimate app operations:
1. **Deliver News Content:** Curate, summarize, and deliver real-time news across categories and geographical editions.
2. **Audio & TTS Playback:** Vocalize articles aloud using natural neural speech synthesis for hands-free listening.
3. **Personalization & Preferences:** Remember your category subscriptions, reading history, dark/light theme, and offline cached articles.
4. **Push Notifications:** Send timely news alerts according to your scheduled quiet hours and frequency preferences.
5. **Account Management:** Authenticate your identity, sync bookmarks across devices, and manage your profile.
6. **Security & Abuse Prevention:** Enforce multi-tier rate limiting, defend against automated brute-force attacks, and maintain service stability.
7. **Monetization & Analytics:** Display advertisements to keep News Flow free for all users and measure high-level reader trends.

We **DO NOT** sell, rent, or trade your personal information to data brokers or third parties.

---

## 5. Data Storage, Security & Retention

### A. Hardware-Backed Encryption
- Authentication tokens (`AUTH_TOKEN_KEY` and session restore credentials) on your mobile device are protected using **Hardware-Backed AES-256 GCM encryption** via **Android KeyStore** and **Apple iOS Keychain** (`expo-secure-store`).
- Passwords stored in our backend are one-way hashed using **salted bcrypt**; plaintext passwords are never stored.
- All communications between the App, backend APIs, and third-party services use **HTTPS / TLS 1.3 encryption in transit**.

### B. Automated Storage & Data Retention Lifecycle
To maintain minimal data footprints and enhance privacy:
1. **Temporary Article Bodies:** Scraped long-form article content is automatically zeroed out (`NULL`) after 14 days.
2. **Automated 30-Day News Retention:** Old news articles older than 30 days are automatically deleted from database storage unless bookmarked or shared.
3. **User Account Data:** Retained as long as your account remains active.
4. **Offline Cache:** Offline cached articles stored on your device storage can be cleared by you at any time via App Settings or by clearing application data.

---

## 6. User Rights & Account / Data Deletion (Google Play Compliance)

You have full control over your personal data:

### A. Your Rights
- **Access & Review:** You can view your profile information, bookmarked stories, and subscriptions directly within the App.
- **Correction:** You can update your display name and profile picture at any time.
- **Opt-Out of Push Notifications:** Disable notifications directly in the App's Notification Settings or your device's System Settings.
- **Opt-Out of Personalized Ads:** Adjust ad tracking permissions in your device settings.

### B. Account & Personal Data Deletion
In full compliance with **Google Play Store Account Deletion Policy** and **GDPR Article 17 (Right to Erasure)**, you have the right to request permanent deletion of your account and associated personal data:

1. **In-App Deletion:**
   - Open **News Flow** > Navigate to **Profile / Settings** > Tap **"Account Settings"** > Tap **"Delete Account"**.
   - Confirm deletion. Your account, authentication tokens, profile details, and private bookmarks will be permanently deleted immediately.
2. **Web / Email Deletion Request:**
   - If you cannot access the App, you may submit a deletion request by emailing **privacy@twogamers.com** with the subject `"Data Deletion Request - News Flow"`, stating your registered account email address.
   - Deletion requests submitted via email are verified and processed within **30 days**.

### C. Data That Is Deleted vs. Retained
- **Deleted Upon Request:** Name, email address, password hash, avatar URL, push notification tokens, and user bookmark associations.
- **Anonymized / Retained:** Aggregate analytical metrics (e.g., total article view counts) that cannot be linked back to any individual user.

---

## 7. Children's Privacy (COPPA & GDPR-K Compliance)

News Flow is intended for general audiences aged **13 and older** (or 16 and older in jurisdictions subject to GDPR). 

We do not knowingly solicit, collect, or process personal identifiable information from children under the age of 13. If we become aware that personal data from a child under 13 has been collected without verified parental consent, we will promptly delete that information from our servers. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately at **privacy@twogamers.com**.

---

## 8. International Data Transfers (GDPR & CCPA Provisions)

### A. European Economic Area (EEA) / UK (GDPR)
If you reside in the EEA or UK, your legal basis for data processing includes:
- **Contractual Necessity:** Providing news feeds, account access, and bookmarked articles.
- **Legitimate Interests:** Service security, debugging, spam/brute-force defense, and product enhancement.
- **Consent:** Personalized advertising and push notifications (which you may withdraw at any time).

### B. California Residents (CCPA / CPRA)
Under the California Consumer Privacy Act, California residents have the right to:
- Know what personal information is collected, disclosed, or sold.
- Request deletion of personal information.
- Opt out of the "sale" or "sharing" of personal data (We do not sell personal information).
- Non-discrimination for exercising these privacy rights.

---

## 9. Changes to This Privacy Policy

We may update this Privacy Policy periodically to reflect enhancements to our features, legal requirements, or operational practices. 

When changes are made, we will update the **"Last Updated"** date at the top of this document. For significant updates, we may provide prominent notice within the App or via push notification. Your continued use of News Flow after the effective date of an updated policy constitutes your agreement to the revisions.

---

## 10. Contact Us & Data Protection Officer

If you have any questions, feedback, concerns, or requests regarding this Privacy Policy or how your personal information is handled, please contact our Data Protection team at:

- **Entity / Developer:** TwoGamers
- **Email:** [privacy@twogamers.com](mailto:privacy@twogamers.com)
- **Support Portal:** [support@twogamers.com](mailto:support@twogamers.com)
- **Application:** News Flow (`com.twogamers.mobile_app_news`)

---
*This document serves as the official Privacy Policy for the News Flow mobile application distributed on Google Play and other official app marketplaces.*
