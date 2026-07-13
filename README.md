# JobTracker

**Every job description wants a slightly different resume — but your actual history never changes.** JobTracker fixes that: upload your old resumes once, let AI consolidate them into a single master profile, then generate an honest, JD-matched resume for any job you're applying to — in under a minute instead of hours.

**🔗 Live demo: [job-tracker-gamma-lyart.vercel.app](https://job-tracker-gamma-lyart.vercel.app)**

[![CI](https://github.com/Rayven85/JobTracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Rayven85/JobTracker/actions/workflows/ci.yml)

Built as a full-stack portfolio project targeting New Zealand tech employers. Demonstrates TypeScript end-to-end, PostgreSQL with Prisma, AWS S3 presigned uploads, JWT auth from scratch with refresh token rotation, Google OAuth, a provider-swappable LLM integration layer, Docker, and GitHub Actions CI.

<!-- TODO: screenshots — application detail (AI analysis) + Resume tab (tailored resume editor + PDF preview) + dashboard -->

---

## Features

- **Application tracking** — status pipeline (Wishlist → Applied → Screening → Interview → Offer), event timeline, contacts, tags, notes, dashboard with response-rate stats.
- **Resume upload** — PDF goes browser → S3 directly via presigned URL (never buffered in Express); text is extracted in the background with a `PENDING / READY / EMPTY / FAILED` status machine.
- **Master profile** — AI extracts structured experience/education/skills from every uploaded resume, then a smart-merge flow detects when two differently-worded entries describe the same real-world role and merges them without losing detail — with human review before anything is written.
- **Tailored resume per job** — generates a JD-matched resume from the master profile with explicit anti-fabrication prompt rules (only facts already in your profile), editable in a structured editor with auto-save, exportable to PDF client-side or saved back into your resume library.
- **AI match analysis** — 0–100 fit score with matched/missing skills and expandable strengths / gaps / suggestions cards.
- **Cover letters & interview prep** — versioned AI cover letters and role-specific interview questions with tips.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                    │
│  Next.js 16 App Router (port 3000)                          │
│  - Auth pages  (login / register / Google OAuth callback)   │
│  - Dashboard   (stats + activity feed)                      │
│  - Applications (list, detail, AI analysis, cover letters)  │
│  - Resumes     (S3 presigned upload, extraction status)     │
│  - Profile     (master profile + smart resume merge review) │
└────────────────────────┬────────────────────────────────────┘
                         │ REST (Bearer token)
┌────────────────────────▼────────────────────────────────────┐
│  Express.js API (port 4000)                                 │
│  - JWT access token (15 min) + refresh token rotation       │
│  - Zod validation on every POST / PATCH                     │
│  - Controllers → Services → Prisma                          │
│  - AI calls isolated behind lib/ai.ts (swap provider there) │
└──────┬────────────────────────────┬───────────────┬─────────┘
       │                            │               │
┌──────▼──────┐   ┌─────────────────▼───┐   ┌──────▼──────────┐
│ PostgreSQL  │   │ AWS S3              │   │ Groq            │
│ (Prisma 7)  │   │ presigned uploads   │   │ llama-3.3-70b   │
└─────────────┘   └─────────────────────┘   └─────────────────┘
```

The AI provider is deliberately isolated: all prompts live in `server/src/services/ai.service.ts`, and the only file that talks to an SDK is `server/src/lib/ai.ts`, which exposes a two-function contract (`generateJSON` / `generateText`). This design was proven in practice when the project migrated Gemini → Groq — exactly one file changed.

---

## Tech Stack

| Layer       | Technology                                  |
|-------------|---------------------------------------------|
| Frontend    | Next.js 16 (App Router), React 19, Tailwind CSS v4 |
| Backend     | Node.js, Express.js 5, TypeScript           |
| Database    | PostgreSQL 16, Prisma 7 (PrismaPg adapter)  |
| Auth        | JWT (access + refresh rotation), bcrypt, Passport.js (Google OAuth) |
| File storage| AWS S3 (presigned URL upload — never buffered in Express) |
| AI          | Groq `llama-3.3-70b-versatile` (provider-swappable via `server/src/lib/ai.ts`) |
| PDF         | pdf-parse (server-side extraction), @react-pdf/renderer (client-side export) |
| Testing     | Jest + Supertest against a real Postgres test DB (server), Jest + React Testing Library (client) |
| DevOps      | Docker, docker-compose, GitHub Actions CI; deployed on Vercel (client) + Railway (API + Postgres) |

---

## Local Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 16 (or Docker)
- AWS S3 bucket (for resume uploads)
- Groq API key (free tier — [console.groq.com](https://console.groq.com))
- Google OAuth credentials (only needed for Google login — any placeholder value lets the server start)

### 1. Clone and install dependencies

```bash
git clone https://github.com/Rayven85/JobTracker.git
cd JobTracker

cd server && npm install
cd ../client && npm install
```

### 2. Configure environment variables

```bash
# server/.env
cp server/.env.example server/.env   # then fill in values (see below)

# client/.env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > client/.env.local
```

### 3. Set up the database

```bash
# Create the dev and test databases
psql -U postgres -c "CREATE USER jobtracker WITH PASSWORD 'password';"
psql -U postgres -c "CREATE DATABASE jobtracker OWNER jobtracker;"
psql -U postgres -c "CREATE DATABASE jobtracker_test OWNER jobtracker;"

# Run migrations
cd server && npx prisma migrate deploy
```

### 4. Start the servers

```bash
# Terminal 1 — API
cd server && npm run dev

# Terminal 2 — Next.js
cd client && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Running Tests

```bash
# Server tests (real DB — requires DATABASE_TEST_URL)
cd server && npx jest --runInBand

# Client tests
cd client && npx jest

# With coverage
cd server && npx jest --coverage --runInBand
cd client && npx jest --coverage
```

CI runs both suites on every push — the server suite against a real Postgres service container — followed by a TypeScript check and a production build. The pipeline needs **no repository secrets**: the Groq SDK is mocked in tests and everything else accepts dummy values.

---

## Environment Variables

### `server/.env` (see `server/.env.example`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (dev DB) |
| `DATABASE_TEST_URL` | PostgreSQL connection string (test DB) |
| `JWT_ACCESS_SECRET` | 64 random chars — signs 15-min access tokens |
| `JWT_REFRESH_SECRET` | 64 different random chars — signs 7-day refresh tokens |
| `AWS_REGION` | e.g. `ap-southeast-2` |
| `AWS_ACCESS_KEY_ID` | IAM user with S3 PutObject / GetObject / DeleteObject |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |
| `S3_BUCKET_NAME` | e.g. `jobtracker-resumes-dev` |
| `GROQ_API_KEY` | Groq API key (free tier) |
| `GOOGLE_CLIENT_ID` | Google OAuth app client ID (placeholder OK if not using Google login) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app secret (placeholder OK if not using Google login) |
| `CLIENT_URL` | e.g. `http://localhost:3000` |
| `SERVER_URL` | e.g. `http://localhost:4000` (used for the OAuth callback URL) |
| `PORT` | API port (default `4000`) |
| `NODE_ENV` | `development` / `production` / `test` |

### `client/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | e.g. `http://localhost:4000` |
