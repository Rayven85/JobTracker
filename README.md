# JobTracker

AI-powered job application tracker built as a full-stack portfolio project targeting New Zealand tech employers (Xero, ASB, Orion Health, Spark, Windcave). Demonstrates TypeScript end-to-end, PostgreSQL with Prisma, AWS S3 presigned uploads, JWT auth from scratch with refresh token rotation, Google OAuth via Passport.js, Gemini AI integration for resume analysis and cover letter generation, Docker, and GitHub Actions CI/CD.

[![CI](https://github.com/Rayven85/JobTracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Rayven85/JobTracker/actions/workflows/ci.yml)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                    │
│  Next.js 15 App Router (port 3000)                          │
│  - Auth pages  (login / register / Google OAuth callback)   │
│  - Dashboard   (stats + activity feed)                      │
│  - Applications (list, detail, AI analysis, cover letters)  │
│  - Resumes     (S3 presigned upload, set default)           │
└────────────────────────┬────────────────────────────────────┘
                         │ REST (Bearer token)
┌────────────────────────▼────────────────────────────────────┐
│  Express.js API (port 4000)                                 │
│  - JWT access token (15 min) + refresh token rotation       │
│  - Zod validation on every POST / PATCH                     │
│  - Controllers → Services → Prisma                          │
│  - AI calls isolated to ai.service.ts (swap provider here)  │
└──────┬────────────────────────────┬───────────────┬─────────┘
       │                            │               │
┌──────▼──────┐   ┌─────────────────▼───┐   ┌──────▼──────┐
│ PostgreSQL  │   │ AWS S3              │   │ Gemini AI   │
│ (Prisma 7)  │   │ presigned uploads   │   │ 1.5-flash   │
└─────────────┘   └─────────────────────┘   └─────────────┘
```

---

## Tech Stack

| Layer       | Technology                                  |
|-------------|---------------------------------------------|
| Frontend    | Next.js 15 (App Router), React 19, Tailwind v4, shadcn/ui |
| Backend     | Node.js, Express.js, TypeScript             |
| Database    | PostgreSQL 16, Prisma 7 (PrismaPg adapter)  |
| Auth        | JWT (access + refresh rotation), bcrypt, Passport.js (Google OAuth) |
| File storage| AWS S3 (presigned URL upload — never buffered in Express) |
| AI          | Google Gemini 1.5-flash (provider-swappable via `server/src/lib/ai.ts`) |
| Testing     | Jest + Supertest (server), Jest + React Testing Library (client) |
| DevOps      | Docker, docker-compose, GitHub Actions CI/CD |

---

## Local Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 16 (or Docker)
- AWS S3 bucket (for resume uploads)
- Google Gemini API key (free tier)
- Google OAuth credentials (optional — for social login)

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

### Option B — Docker (all-in-one)

```bash
docker compose up --build

# Run migrations inside the container (first time only)
docker compose exec server npx prisma migrate deploy
```

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

---

## Environment Variables

### `server/.env`

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
| `GEMINI_API_KEY` | Google AI Studio free-tier key |
| `GOOGLE_CLIENT_ID` | Google OAuth app client ID (optional) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app secret (optional) |
| `CLIENT_URL` | e.g. `http://localhost:3000` |
| `PORT` | API port (default `4000`) |
| `NODE_ENV` | `development` / `production` / `test` |

### `client/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | e.g. `http://localhost:4000` |

### GitHub Secrets (for CI)

`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GEMINI_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
