# 🛡️ Master Blueprint: Production Cyber Security Hardening & Threat Monitoring Architecture

## 📌 Executive Summary

Modern mobile news platforms and Node.js backends are common targets for:
1. **DDoS & Brute-Force Attacks**: Overwhelming server memory/CPU or cracking user/admin passwords.
2. **Exposed Administrative Surfaces**: Unauthenticated access to database viewers, user tables, and CMS endpoints.
3. **Data Leaks & Insecure Storage**: Tokens stored unencrypted on mobile devices or API keys leaked in code.
4. **Injection Attacks (SQLi, XSS, SSRF)**: Malicious payloads injected into search queries, RSS parsers, or media uploaders.
5. **Zero-Visibility Blind Spots**: Not knowing when attacks or server crashes happen until users complain.

This document presents a **production-grade, defense-in-depth security blueprint** divided into 5 actionable layers, complete with the industry-standard monitoring libraries used by top production applications (Sentry, Cloudflare WAF, Fail2ban, Helmet, and Expo SecureStore).

---

## 🏛️ The 5-Layer Security Shield Architecture

```
                                  [ INTERNET / USERS & ATTACKERS ]
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: Perimeter Shield (Cloudflare WAF & Edge Proxy)                                         │
│ • Hides VPS IP (46.202.167.245) from port scanners & Shodan                                   │
│ • Free Global DDoS mitigation (absorbs multi-gigabit bot floods)                                │
│ • Web Application Firewall (WAF) blocks SQL injection, XSS, and crawler bots                   │
│ • Automatic TLS 1.3 / SSL Encryption & HSTS                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 2: Hostinger VPS & OS Hardening (Ubuntu 24.04 Linux)                                      │
│ • UFW Firewall: Close public DB ports (Postgres 5432, Redis 6379 bound to Docker/localhost only)│
│ • Fail2ban: Automatically bans IPs attempting SSH brute-force or hammering 401/404 endpoints   │
│ • SSH Key Authentication: Disable vulnerable password-based SSH login                           │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 3: Backend API & Application Armor (Express.js / Node.js)                                  │
│ • Admin Route Gate: Lock /admin/*, /cms, /dashboard behind mandatory JWT/Cookie Auth            │
│ • Rate Limiting: Redis-backed brute-force prevention on /auth/login and public endpoints         │
│ • Payload Clamping: Reduce global JSON limit from 50MB to 2MB (prevents memory exhaustion)      │
│ • Strict Security Headers: Hardened Helmet (X-Content-Type-Options, Frameguard, XSS filter)    │
│ • Input Validation: Zod schema enforcement on all incoming requests                              │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 4: Mobile App Hardening (React Native / Expo)                                            │
│ • Hardware-Encrypted Storage: Migrate auth tokens from AsyncStorage to expo-secure-store        │
│ • ProGuard / R8 Obfuscation: Minify and obfuscate Android APK bytecode in eas.json             │
│ • HTTPS Enforcement & Network Security Config: Prevent man-in-the-middle packet sniffing        │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 5: 24/7 Threat Monitoring & APM Telemetry (The Production Watchdog)                       │
│ • Sentry (@sentry/node & @sentry/react-native): Real-time crash alerting, breadcrumbs, & spikes│
│ • UptimeRobot / Better Uptime: External heartbeat pings every 60s with SMS/Discord alerts       │
│ • Security Audit Log: Record all admin logins, role changes, and anomalous requests             │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Critical Vulnerabilities Identified in Current Codebase

Before adding new tools, these high-risk exposure points must be sealed:

| Vulnerability | Current State | Risk Level | Threat Scenario |
| :--- | :--- | :--- | :--- |
| **Unprotected Admin & DB Explorer** | `/admin/database`, `/admin/users`, `/cms`, `/dashboard` have NO auth check | 🔴 **CRITICAL** | Any stranger with your IP can browse all registered user emails, wipe articles, or alter database records |
| **Excessive JSON Payload Limit** | `express.json({ limit: '50mb' })` globally | 🟠 **HIGH** | An attacker can spam 50MB JSON bodies to trigger Out-Of-Memory (OOM) crashes on your 4GB VPS |
| **Wide-Open CORS** | `cors({ origin: '*' })` on all routes | 🟡 **MEDIUM** | Malicious websites can make cross-origin requests targeting internal admin endpoints |
| **Exposed Database Ports** | Postgres (5432) & Redis (6379) may be bound to `0.0.0.0` | 🟠 **HIGH** | Automated bots scanning the internet brute-force your database password directly |
| **Plaintext Mobile Token Storage** | `AsyncStorage.setItem('token', ...)` | 🟡 **MEDIUM** | Rooted Android devices or physical extraction tools can read user auth tokens |

---

## 🛠️ Step-by-Step Implementation Strategy

### Phase 1: Lock Down Administrative Portals (Zero-Trust Gate)
1. **Implement Admin Session / JWT Gate Middleware**:
   - Apply `authenticateAdmin` to:
     - `/cms` and `/admin/cms`
     - `/dashboard` and `/admin/telemetry`
     - `/admin/database`
     - `/admin/users` and `/users-admin`
     - `/admin/images`, `/admin/media`, `/media`
   - If an unauthenticated user or bot visits these URLs, redirect them to a secure login screen (`/admin/login`) or return `401 Unauthorized`.

### Phase 2: Production Monitoring & Real-Time Alerting (Sentry + Uptime)
1. **Install Sentry in Backend (`@sentry/node`)**:
   - Captures every unhandled exception and 500 error in real time.
   - Captures HTTP status code spikes (e.g. 500 401s in 1 minute = brute force alert).
   - Sends instant push notifications / Discord / Email alerts when your server faces errors.
2. **Install Sentry in Expo Mobile App (`@sentry/react-native`)**:
   - Captures real-time device crashes, native unhandled rejections, and slow API calls.
   - Shows user device model, OS version, and exact line of code that caused a crash.
3. **Uptime Monitoring (UptimeRobot / Better Stack)**:
   - Configure a free external ping every 60 seconds to `https://api.yourdomain.com/api/health`.
   - Sends an instant SMS / WhatsApp alert if Hostinger VPS or Node server goes down.

### Phase 3: Backend API Armor & Rate Limiting
1. **Reduce Payload Size**:
   - Change global `express.json({ limit: '2mb' })` for all standard endpoints.
   - Only allow `25mb` on specific media upload endpoints (`/api/v1/media/upload`).
2. **Redis-Backed Brute-Force Rate Limiting**:
   - Add strict rate limiting on authentication routes:
     - Max 5 login attempts per IP per 15 minutes on `/api/v1/auth/login`.
     - Max 3 password reset requests per hour on `/api/v1/auth/forgot-password`.
3. **Hardened Helmet Headers**:
   - Re-enable Content Security Policy (CSP), Frameguard (`X-Frame-Options: SAMEORIGIN`), and `X-Content-Type-Options: nosniff`.

### Phase 4: Hostinger VPS & Linux Hardening (One-Time Setup)
1. **Configure UFW Firewall**:
   ```bash
   ufw default deny incoming
   ufw default allow outgoing
   ufw allow 22/tcp    # SSH
   ufw allow 80/tcp    # HTTP
   ufw allow 443/tcp   # HTTPS
   ufw allow 4000/tcp  # Backend (or route via reverse proxy)
   ufw enable
   ```
   *Ensures PostgreSQL (5432) and Redis (6379) are NEVER exposed to the public internet.*
2. **Install Fail2ban**:
   ```bash
   apt install -y fail2ban
   systemctl enable fail2ban && systemctl start fail2ban
   ```
   *Automatically bans any IP address that fails 5 SSH login attempts or spams the server.*

### Phase 5: Mobile App Token Encryption (Expo SecureStore)
1. **Migrate Sensitive Tokens to `expo-secure-store`**:
   - Replace `AsyncStorage` with `SecureStore.setItemAsync()` for:
     - User JWT Auth Tokens (`access_token`, `refresh_token`)
     - Push Notification Secrets
   - `expo-secure-store` encrypts values using the hardware **Android Keystore** and **iOS Keychain**.

---

## 📋 Recommended Monitoring & Security Tools (Industry Standard)

| Tool | Purpose | Cost | Why Top Production Apps Use It |
| :--- | :--- | :--- | :--- |
| **Sentry** (`@sentry/node` & `@sentry/react-native`) | Crash Reporting, Error Tracking, Security Anomaly Alerts | **Free Tier** (5,000 events/mo) | Industry gold standard; pinpoint exact line of code that failed with user breadcrumbs |
| **Cloudflare** (DNS & WAF) | DDoS Mitigation, Bot Blocker, IP Masking, Free SSL | **100% Free** | Protects Hostinger VPS from DDoS attacks and hides origin IP address |
| **UptimeRobot / Better Stack** | 24/7 Heartbeat & Server Uptime Monitor | **100% Free** (50 monitors) | Alerts you within 60 seconds if the backend goes down or server crashes |
| **Helmet.js** | HTTP Security Headers | **Free (Open Source)** | Prevents Clickjacking, XSS, MIME sniffing, and enforces HTTPS |
| **Fail2ban** | Linux VPS Automated Intrusion Prevention | **Free (Open Source)** | Automatically blacklists malicious IPs attempting brute-force attacks |
| **Expo SecureStore** | Hardware-backed KeyStore Encryption | **Free (Built into Expo)** | Prevents credential theft from rooted or stolen phones |

---

## 🎯 Proposed Immediate Action Plan

1. **Step 1**: Secure the admin routes (`/cms`, `/admin/*`, `/dashboard`) with authentication in [`backend/src/index.ts`](file:///d:/live-project/mobile_app_news/backend/src/index.ts).
2. **Step 2**: Clamp `express.json` payload limit to 2MB to prevent memory exhaustion attacks.
3. **Step 3**: Integrate **Sentry** error and performance monitoring for backend and frontend.
4. **Step 4**: Add Redis-backed brute force rate limiters to `/auth/login` and `/auth/register`.
5. **Step 5**: Provide copy-paste commands to set up UFW firewall and Fail2ban on your Hostinger VPS.
