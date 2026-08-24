# 🚀 NewsFlow Production Deployment Guide (Hostinger VPS with Coolify)

This document explains how to deploy the NewsFlow backend to your Hostinger VPS using **Coolify** and your Public GitHub repository in **under 3 minutes**.

---

## 🏗️ Architecture Overview

When deployed via Coolify, Docker automatically spins up 3 interconnected containers inside an isolated internal bridge network:

```
                  ┌──────────────────────────────────────────────┐
                  │           Coolify Reverse Proxy (SSL)         │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼ (Port 4000)
                  ┌──────────────────────────────────────────────┐
                  │          NewsFlow Backend API Container       │
                  │             (Node 20 + Prisma Engine)        │
                  └──────────────┬───────────────────────────────┘
                                 │ Internal Network
                    ┌────────────┴────────────┐
                    ▼                         ▼
      ┌──────────────────────────┐ ┌──────────────────────────┐
      │  PostgreSQL 16 Database   │ │    Redis 7 Cache Server  │
      │   (Persistent Volume)    │ │   (Persistent Volume)    │
      └──────────────────────────┘ └──────────────────────────┘
```

---

## 📋 Step-by-Step Coolify Deployment

### Step 1: Push Code to GitHub
In your project directory, commit and push the updated backend files:
```bash
git add .
git commit -m "feat: production ready Docker and Coolify deployment setup"
git push origin main
```

---

### Step 2: Create a New Resource in Coolify
1. Log into your **Coolify Dashboard** on Hostinger (`http://<your-vps-ip>:8000`).
2. Go to **Projects** ➔ select your project/environment.
3. Click **+ New Resource** ➔ Select **Docker Compose**.
4. Choose **Public Repository** and paste your GitHub repository URL:
   - **Repository URL**: `https://github.com/your-username/mobile_app_news`
   - **Branch**: `main`
   - **Base Directory**: `backend` (points directly to the `backend/` directory).
   - **Docker Compose Location**: `/docker-compose.yml`

---

### Step 3: Configure Environment Variables
In Coolify's **Environment Variables** tab for this resource, add:

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Production environment mode |
| `PORT` | `4000` | Server listening port |
| `POSTGRES_USER` | `newsflow_user` | Database username |
| `POSTGRES_PASSWORD` | `your_secure_password_123` | Strong database password |
| `POSTGRES_DB` | `newsflow_db` | Database name |
| `CORS_ORIGIN` | `*` | Allowed CORS origins |
| `RSS_INGEST_INTERVAL_MINUTES` | `5` | Ingestion frequency |
| `READABILITY_MAX_CONCURRENCY` | `3` | Parallel article extraction count |

> 💡 **Note**: `DATABASE_URL` and `REDIS_URL` are already auto-constructed inside `docker-compose.yml` to securely communicate over the internal docker network (`postgres:5432` and `redis:6379`).

---

### Step 4: Set Domains & SSL
1. Under **FQDN / Domain**, enter your custom domain or sub-domain:
   `https://api.yourdomain.com` (or `http://<your-vps-ip>:4000`).
2. Coolify will automatically generate a free **Let's Encrypt SSL certificate** with automatic renewals!

---

### Step 5: Click Deploy!
1. Click **Deploy**.
2. Coolify will:
   - Clone your GitHub repo.
   - Pull `postgres:16-alpine` and `redis:7-alpine`.
   - Build the multi-stage `Dockerfile`.
   - Automatically execute `npx prisma db push` via `docker-entrypoint.sh` to sync database tables.
   - Start the ingestion cron worker and launch the live REST API.

---

## 🔍 Verification & Health Check

Once deployed, you can verify your live server:
- **Health Check**: `https://api.yourdomain.com/api/v1/health`
- **Database Explorer Admin UI**: `https://api.yourdomain.com/admin/database`
- **Live News Feed**: `https://api.yourdomain.com/api/v1/news/feed?country=IN`
