# 🚀 NewsFlow Production Backend & Mission Control

High-performance, production-grade Node.js + TypeScript backend for the NewsFlow mobile application with embedded Visual Admin Portals, AI Telemetry dashboards, CMS, and RSS Ingestion Engine.

---

## 🖥️ Visual Web Dashboards & UI / UX Portals

All visual portals are accessible directly in your web browser without needing any third-party desktop tools:

| URL Path | Portal Name | Description & Capabilities |
| :--- | :--- | :--- |
| **`/dashboard`**<br>`/admin/telemetry` | **AI Mission Control & Telemetry** | Real-time Server-Sent Events (SSE) telemetry, LLM provider switching (Groq LPU, Mistral, SambaNova), AI summary testing, active queue metrics, cache flush, and manual RSS trigger. |
| **`/cms`**<br>`/admin/cms` | **Visual CMS Editorial Studio** | Full editorial portal to create, edit, categorize, feature hero articles, manage visual insight stories, conduct community polls, and trigger custom push alerts. |
| **`/admin/users`**<br>`/users-admin` | **Admin User Accounts Portal** | Complete user management dashboard. View all registered accounts, change roles (`USER` ↔ `ADMIN`), update user status (`ACTIVE`, `SUSPENDED`), and reset passwords. |
| **`/admin/database`** | **Visual Database Explorer** | Raw database table explorer for PostgreSQL. Inspect articles, users, insights, push tokens, and verify stored fields without opening a CLI. |
| **`/campaigns`**<br>`/email-studio`<br>`/testers` | **Email Campaign & Beta Studio** | Visual WYSIWYG & HTML/CSS campaign studio. Design invitation emails with live mobile preview, store download badges, and test send via Mailtrap/Gmail. |
| **`/join-beta`**<br>`/beta-testers` | **Public Beta Tester Landing** | High-conversion, dark-mode landing page for early adopters to register for the NewsFlow Beta. Triggers automated welcome emails and records interest. |
| **`http://localhost:5555`** | **Prisma Studio GUI** | Interactive Prisma ORM database GUI for relational inspection and editing. Started with `npx prisma studio`. |

---

## 🌐 Complete REST API Reference (`/api/v1`)

### 1. 🔐 User Authentication & Profile (`/api/v1/auth`)
*Rate-limited to protect against brute-force attempts.*

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/v1/auth/register` | Register new account (`email`, `password`, `name`). | No |
| `POST` | `/api/v1/auth/login` | Sign in with email & password. Returns JWT Bearer token. | No |
| `POST` | `/api/v1/auth/google` | Mobile Google OAuth login / auto-registration with ID token. | No |
| `POST` | `/api/v1/auth/forgot-password` | Request a 6-digit password reset verification code via email. | No |
| `POST` | `/api/v1/auth/verify-otp` | Verify 6-digit recovery code. | No |
| `POST` | `/api/v1/auth/reset-password` | Set new password using verified OTP token. | No |
| `GET` | `/api/v1/auth/me` | Fetch authenticated user profile and admin status. | Bearer JWT |
| `POST` | `/api/v1/auth/logout` | Invalidate token session and revoke refresh. | Bearer JWT |

---

### 2. 📰 News & Feed Engine (`/api/v1/news`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/news/feed` | **Main Home Feed** (served via Redis 20-item Ring Buffer in <100ms: Hero items + 5 Category clusters + Insights). Query: `country=IN`. |
| `GET` | `/api/v1/news/category/:category` | **Category News**: Page 1 served from Redis Ring Buffer (<10ms). Page > 1 paginates PostgreSQL. Query: `page=1&limit=20&country=IN`. |
| `GET` | `/api/v1/news/categories` | Returns all active category taxonomies and verified feed counts. |
| `GET` | `/api/v1/news/article/:id` | Fetch complete article details by unique UUID. |
| `GET` | `/api/v1/news/search` | Search articles by keyword (`?q=term`). |
| `GET` | `/api/v1/news/check-new` | Inshorts-style real-time heartbeat polling (`?since=<ISO_TIMESTAMP>&categories=Tech,Business`). |
| `POST` | `/api/v1/news/refresh` | Manually trigger background RSS ingest worker. |
| `POST` | `/api/v1/news/extract` | Extract clean article content from external web URLs using Mozilla Readability. |
| `POST` | `/api/v1/news/resolve-images`| Streaming image resolution service. |
| `POST` | `/api/v1/news/translate` | On-the-fly multi-language translation (Hindi, Spanish, French, etc.). |
| `POST` | `/api/v1/news/deep-dive` | AI Deep Dive analysis on any story. |
| `GET` | `/api/v1/news/stream-logs` | Server-Sent Events (SSE) live stream of RSS ingestion logs. |
| `GET` | `/api/v1/news/logs` | Fetch recent ingestion log entries. |

---

### 3. 👥 User Accounts Administration (`/api/v1/admin/users`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/admin/users` | List all users with query filters (`search`, `status`, `page`, `limit`). |
| `PATCH` | `/api/v1/admin/users/:id/status` | Toggle user role/status (`ADMIN` ↔ `USER`, `ACTIVE` ↔ `SUSPENDED`). |
| `PUT` | `/api/v1/admin/users/:id` | Update user details (`name`, `email`, `status`). |
| `DELETE` | `/api/v1/admin/users/:id` | Remove a user account. |

---

### 4. 🛠️ CMS Editorial API (`/api/v1/cms`)
*Requires Admin Bearer Authentication.*

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/cms/auth/login` | Staff / Admin login for CMS Portal. |
| `GET` | `/api/v1/cms/articles` | List articles with editorial filters. |
| `POST` | `/api/v1/cms/articles` | Create a custom manual article. |
| `PUT` | `/api/v1/cms/articles/:id` | Update article title, content, image, or category. |
| `PATCH` | `/api/v1/cms/articles/:id/hero` | Toggle article Hero banner status. |
| `DELETE` | `/api/v1/cms/articles/:id` | Delete article. |
| `POST` | `/api/v1/cms/ai/summarize` | AI Copilot: Generate 60-word concise bullet summary. |
| `POST` | `/api/v1/cms/ai/fact-check` | AI Copilot: Verify claims against knowledge base. |
| `GET` | `/api/v1/cms/stories` | Manage visual stories (create, update, delete). |
| `GET` | `/api/v1/cms/polls` | Manage community opinion polls and vote tallies. |
| `GET` | `/api/v1/cms/rss/sources` | Add, update, or remove RSS feed sources. |
| `POST` | `/api/v1/cms/rss/trigger-all` | Trigger full ingestion across all registered feeds. |
| `POST` | `/api/v1/cms/push/broadcast` | Send breaking news push notification to all subscribed devices. |
| `POST` | `/api/v1/cms/analytics/flush-cache` | Invalidate all Redis caches in real time. |

---

### 5. 📬 Push Notifications & Device Subscriptions (`/api/v1/notifications`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/notifications/subscribe` | Register Expo Push Token and user-selected categories in Redis. |
| `GET` | `/api/v1/notifications/subscription/:pushToken` | Check subscribed categories for a device. |
| `POST` | `/api/v1/notifications/broadcast` | Broadcast category alert to devices subscribed to that category. |
| `POST` | `/api/v1/notifications/test-push` | Send test notification directly to a specified push token. |

---

### 6. 📊 Telemetry & Mission Control (`/api/v1/dashboard`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/dashboard/stats` | JSON snapshot of active LLM models, queue size, and cache metrics. |
| `GET` | `/api/v1/dashboard/stream` | SSE real-time stream of CPU, memory, ingestion, and latency stats. |
| `POST` | `/api/v1/dashboard/toggle-ai` | Enable or disable LLM enrichment engine globally. |
| `POST` | `/api/v1/dashboard/toggle-model` | Toggle specific models (e.g. `groq/llama-3.3-70b`, `mistral/small`). |
| `POST` | `/api/v1/dashboard/trigger-ingest` | Trigger background RSS ingest. |
| `POST` | `/api/v1/dashboard/clear-cache` | Flush Redis cache. |
| `POST` | `/api/v1/dashboard/reset-metrics` | Reset telemetry counters and error logs. |

---

### 7. ✉️ Public Beta & Campaign Studio (`/api/beta`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/beta/register` | Public registration endpoint for beta testers. |
| `GET` | `/api/beta/list` | List registered beta testers with platform preferences. |
| `GET` | `/api/beta/template` | Retrieve active HTML email template. |
| `POST` | `/api/beta/template` | Save updated HTML/CSS invitation template. |
| `POST` | `/api/beta/preview` | Render dynamic HTML email preview with variables. |
| `POST` | `/api/beta/send-invite` | Dispatch customized email invites to selected testers. |
| `DELETE` | `/api/beta/:id` | Remove a tester record. |

---

### 8. 📄 Neural PDF Analyzer (`/api/v1/pdf`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/pdf/session-init` | Multipart upload for large PDFs; extracts page count in <200ms. |
| `POST` | `/api/v1/pdf/batch-extract` | On-demand page extraction (e.g. Pages 1-5) with Math verbalization. |
| `POST` | `/api/v1/pdf/extract` | Single-shot PDF text & structure extraction. |
| `POST` | `/api/v1/pdf/summarize` | Generate 60-word executive briefing from PDF content. |
| `POST` | `/api/v1/pdf/chat` | Interactive conversational Q&A on selected reference cards. |

---

### 9. 🎙️ Neural Text-to-Speech (`/api/v1/speech`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/speech/synthesize` | Synthesize news article into natural neural audio (`msedge-tts`). |
| `GET` | `/api/v1/speech/stream` | Audio streaming endpoint for mobile audio players. |
| `GET` | `/api/v1/speech/voices` | List available voices and language locales. |

---

### 10. ⏳ AI Timelines & Topic Tracking (`/api/v1/timelines`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/timelines` | Fetch chronological story timelines grouped by topic. |
| `POST` | `/api/v1/timelines/track` | Track a keyword or developing story for automated timeline generation. |

---

### 11. 💡 Visual Insights (`/api/v1/insights`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/insights` | Fetch visual card-based insight stories for the mobile visual deck. |
| `POST` | `/api/v1/insights` | Create a new visual insight card. |

---

### 12. 📡 Feed Catalog & Validator (`/api/v1/feeds`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/feeds` | List all verified RSS feeds categorized by topic. |
| `POST` | `/api/v1/feeds/validate` | Non-blocking probe to test if an RSS/Atom URL is valid and reachable. |
| `POST` | `/api/v1/feeds/add` | Atomically register a new verified RSS source. |

---

## ⚡ Quick Start Guide (Local Development)

### 1. Start Containers
```bash
cd backend
docker compose up -d
```
> Starts PostgreSQL on port `5432` and Redis on port `6379`.

### 2. Install & Migrate
```bash
npm install
npx prisma db push
```

### 3. Launch Development Server
```bash
npm run dev
```

* Backend Server runs on `http://localhost:4000`
* Prisma Studio runs on `http://localhost:5555` (`npx prisma studio`)
