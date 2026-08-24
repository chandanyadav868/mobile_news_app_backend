# 🚀 NewsFlow Production Backend

High-performance, production-grade Node.js + TypeScript backend for the NewsFlow mobile application.

## 🛠️ Tech Stack
- **Runtime**: Node.js (v18+) with TypeScript
- **Framework**: Express.js with Helmet, CORS, Compression, and Rate Limiting
- **Database**: PostgreSQL 16 managed with Prisma ORM
- **Cache**: Redis 7 for sub-30ms response caching
- **Worker**: Background Cron Worker (`node-cron`) for automated RSS ingestion & O(1) deduplication (`MD5`)

---

## ⚡ Quick Start Guide (3 Simple Steps)

### Step 1: Start PostgreSQL & Redis with Docker
Make sure **Docker Desktop** is running on your machine, then run:
```bash
cd backend
docker compose up -d
```
> This starts PostgreSQL on port `5432` and Redis on port `6379` in the background with persistent data volumes.

---

### Step 2: Install Dependencies & Run Database Migrations
```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
```
> This creates all tables in PostgreSQL and pre-seeds sample Insights and Timelines.

---

### Step 3: Start the Backend Server
```bash
npm run dev
```

Your server is now live at:
- **Health Check**: `http://localhost:4000/api/v1/health`
- **Main Feed**: `http://localhost:4000/api/v1/news/feed`
- **Category News**: `http://localhost:4000/api/v1/news/category/sports`
- **Visual Insights**: `http://localhost:4000/api/v1/insights`
- **Timelines**: `http://localhost:4000/api/v1/timelines`
- **Manual Ingest Trigger**: `POST http://localhost:4000/api/v1/news/refresh`

---

## 📂 Project Structure
```
backend/
├── docker-compose.yml        # PostgreSQL & Redis docker containers
├── .env                     # Environment variables
├── prisma/
│   └── schema.prisma        # Database models (Article, InsightStory, Timeline)
├── src/
│   ├── index.ts             # Express server bootstrap
│   ├── config/              # Prisma, Redis, Env configuration
│   ├── constants/           # Production RSS feed URLs
│   ├── controllers/         # News, Insights, Timelines controllers
│   ├── routes/              # Express API route handlers
│   ├── services/            # RSS Fetcher, Redis Cache service
│   ├── workers/             # Background RSS Ingest Cron Worker
│   └── seed.ts              # Database seeding script
```
