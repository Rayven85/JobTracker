# JobTracker — Implementation Guide

Use these prompts sequentially in Claude Code sessions.
Always start a new session by reading CLAUDE.md first.
Reference the prisma schema and api-spec as you go.

---

## Before You Start

Prerequisites to install manually before Phase 0:
- Node.js 20+
- PostgreSQL 16 running locally (or Docker)
- AWS account with S3 bucket created (ap-southeast-2)
- Google AI Studio API key (Gemini) — get free at aistudio.google.com
- Google Cloud OAuth credentials (Client ID + Secret)

---

## Phase 0 — Project Scaffold

**Goal:** Create monorepo structure, install dependencies, configure TypeScript.

```
Set up a TypeScript monorepo for a project called JobTracker. Two packages:

1. server/ — Express.js API
   Install: express @types/express typescript ts-node-dev @types/node
   Install: @prisma/client prisma
   Install: jsonwebtoken @types/jsonwebtoken bcrypt @types/bcrypt
   Install: @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
   Install: @google/generative-ai
   Install: passport passport-google-oauth20 @types/passport @types/passport-google-oauth20
   Install: zod cors cookie-parser @types/cookie-parser helmet morgan @types/morgan
   Install: pdf-parse @types/pdf-parse
   Dev: jest @types/jest ts-jest supertest @types/supertest

2. client/ — Next.js 15
   Use: npx create-next-app@latest client --typescript --tailwind --app --no-src-dir --no-import-alias
   Then add: shadcn/ui (npx shadcn@latest init), recharts, lucide-react

Both packages need tsconfig.json with strict: true.

Server tsconfig: target ES2022, module commonjs, outDir dist/, rootDir src/.
Create server/src/index.ts that:
- Loads dotenv
- Creates Express app
- Registers cors (origin: CLIENT_URL, credentials: true)
- Registers cookie-parser
- Registers helmet
- Registers morgan('dev') in development
- Mounts /api/v1 router (placeholder for now)
- Registers global error handler middleware (placeholder)
- Listens on process.env.PORT || 4000
- Validates required env vars at startup and throws if any are missing

Create root docker-compose.yml with three services:
- postgres: image postgres:16, env POSTGRES_DB=jobtracker POSTGRES_USER=jobtracker POSTGRES_PASSWORD=password, port 5432:5432
- server: build ./server, volumes ./server:/app, env_file server/.env, port 4000:4000
- client: build ./client, port 3000:3000

Create .gitignore at root (node_modules, .env, .env.local, dist/, .next/).
```

---

## Phase 1 — Database Setup

**Goal:** Prisma schema applied, client generated, test connection.

```
The Prisma schema is already written at server/prisma/schema.prisma.
Do the following:

1. Copy the content from prisma/schema.prisma into server/prisma/schema.prisma
2. Run: cd server && npx prisma migrate dev --name init
3. Run: npx prisma generate
4. Create server/src/lib/prisma.ts — PrismaClient singleton:
   - Use the global pattern to prevent multiple instances in development
   - Export a single `prisma` const

5. Create server/src/lib/AppError.ts — the custom error class as documented in CLAUDE.md
6. Create server/src/middleware/asyncHandler.ts — as documented in CLAUDE.md
7. Create server/src/middleware/errorHandler.ts:
   - Catches AppError → returns { success: false, error: { code, message } } with AppError.statusCode
   - Catches Prisma known request errors (P2002 unique constraint → 409, P2025 not found → 404)
   - Catches anything else → 500 with code INTERNAL_ERROR
   - In development, include err.stack in the response for debugging

Verify connection works by adding a test route GET /api/v1/health that returns
{ success: true, data: { status: 'ok', timestamp: new Date() } }
```

---

## Phase 2 — Auth System

**Goal:** Register, login, refresh, logout endpoints. JWT + refresh token rotation.

```
Implement the complete auth system following CLAUDE.md auth specifications exactly.

File structure to create:
- server/src/validators/auth.validator.ts — Zod schemas for register, login
- server/src/services/auth.service.ts — all auth business logic
- server/src/controllers/auth.controller.ts — HTTP layer only
- server/src/routes/auth.routes.ts — mount all auth endpoints
- server/src/middleware/auth.ts — JWT verification middleware

auth.service.ts must implement:
- register(email, password, name) → creates User (bcrypt password, saltRounds 12), creates initial RefreshToken pair, returns { accessToken, user }
- login(email, password) → verifies password, creates token pair, returns { accessToken, user }
- refresh(cookieToken) → finds token by hash, checks not expired/revoked, rotates (revoke old, create new), returns { accessToken }
- logout(cookieToken) → revokes the refresh token

Token utilities (server/src/lib/tokens.ts):
- signAccessToken(userId, email) → JWT with 15m expiry
- signRefreshToken() → crypto.randomBytes(64).toString('hex')
- hashToken(token) → crypto.createHash('sha256').update(token).digest('hex')
- verifyAccessToken(token) → decoded payload or throws AppError(401, 'INVALID_TOKEN', ...)

Refresh token DB operations:
- Store: { tokenHash: hashToken(rawToken), userId, expiresAt: 7 days from now }
- On use: verify hash, check revoked === false and expiresAt > now, then revoke + create new

Auth middleware reads `req.headers.authorization`:
- Split 'Bearer <token>'
- verifyAccessToken → attaches req.user = { userId, email }
- On any failure: throw AppError(401, 'UNAUTHORIZED', 'Invalid or expired token')

Endpoints (follow api-spec.md exactly for request/response shapes):
- POST /api/v1/auth/register
- POST /api/v1/auth/login
- POST /api/v1/auth/refresh (reads HttpOnly cookie 'refreshToken')
- POST /api/v1/auth/logout
- GET /api/v1/auth/me (auth required)

refreshToken cookie settings: httpOnly: true, secure: NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000

Write tests in server/src/tests/auth.test.ts:
- Register with valid data → 201, access token in body
- Register with duplicate email → 409
- Login with correct credentials → 200, access token
- Login with wrong password → 401
- Access protected route with valid token → 200
- Access protected route without token → 401
- Access protected route with expired token → 401
- Refresh with valid cookie → 200, new access token
- Refresh with revoked token → 401
```

---

## Phase 3 — Google OAuth

**Goal:** Google login as alternative to email/password.

```
Add Google OAuth using Passport.js to the existing auth system.

1. Create server/src/lib/passport.ts:
   - Configure GoogleStrategy with GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
   - Callback URL: {SERVER_URL}/api/v1/auth/google/callback
   - In verify callback: find User by googleId or email
     - If found by email but no googleId: link the googleId to existing account
     - If not found: create new User with googleId, email, name, avatarUrl from Google profile
   - Call done(null, user)
   - Initialize passport in server/src/index.ts

2. Add to auth.routes.ts:
   - GET /auth/google → passport.authenticate('google', { scope: ['profile', 'email'] })
   - GET /auth/google/callback → passport.authenticate strategy → on success:
     issue token pair (same as login), set cookie, redirect to {CLIENT_URL}/auth/callback?token=<accessToken>

3. Update auth.service.ts with findOrCreateGoogleUser(googleId, email, name, avatarUrl) method.

The client will handle the redirect: read token from URL param, store in memory/state, redirect to dashboard.
```

---

## Phase 4 — Resume Upload

**Goal:** S3 presigned URL upload flow. PDF text extraction.

```
Implement the resume upload system following the S3 flow in CLAUDE.md exactly.

Files to create:
- server/src/lib/s3.ts — S3Client singleton + two helper functions:
  generatePresignedUploadUrl(s3Key, contentType, expiresIn=600) → string
  deleteS3Object(s3Key) → void
- server/src/services/resume.service.ts
- server/src/controllers/resume.controller.ts
- server/src/routes/resume.routes.ts
- server/src/validators/resume.validator.ts

s3.ts:
- S3Client with region: AWS_REGION, credentials from env
- generatePresignedUploadUrl uses PutObjectCommand + getSignedUrl
- s3Key format for uploads: `resumes/${userId}/${nanoid()}.pdf` (install nanoid)

resume.service.ts must implement:
- getPresignedUrl(userId, fileName, contentType) → { presignedUrl, s3Key }
  - Validate contentType === 'application/pdf'
  - Generate s3Key using the naming format
  - Return presigned URL via s3.ts helper
- confirmUpload(userId, { s3Key, fileName, fileSize, name }) → Resume
  - Create Resume row in DB
  - Trigger PDF text extraction asynchronously (do NOT await — fire and forget)
  - Return the created resume
- extractAndSaveText(resumeId, s3Key) → void (background job)
  - Fetch PDF from S3 using GetObjectCommand
  - Convert stream to Buffer
  - Use pdf-parse to extract text
  - Update Resume.parsedText in DB
  - Log any errors but do not throw (it's a background job)
- listResumes(userId) → Resume[] with parsedTextPreview (first 200 chars)
- getResume(resumeId, userId) → Resume (throw 404 if not found, 403 if wrong user)
- updateResume(resumeId, userId, { name }) → Resume
- deleteResume(resumeId, userId) → void (delete from DB + S3)
- setDefault(resumeId, userId) → Resume (clear isDefault on all others, set this one)

All endpoints are auth-protected. Follow api-spec.md for request/response shapes.

Write tests:
- getPresignedUrl returns a URL and s3Key in correct format
- confirmUpload creates a Resume row with correct fields
- getResume throws 403 when userId doesn't match
- deleteResume removes from DB (mock S3 delete in tests)
```

---

## Phase 5 — Applications CRUD

**Goal:** Full application lifecycle management with event tracking.

```
Implement the applications resource following api-spec.md.

Files to create:
- server/src/validators/application.validator.ts — createApplication, updateApplication, updateStatus schemas
- server/src/services/application.service.ts
- server/src/controllers/application.controller.ts
- server/src/routes/application.routes.ts

application.service.ts must implement:
- listApplications(userId, { status?, search?, page, limit }) → { items, total, page, limit }
  - status filter: WHERE status = ?
  - search filter: WHERE companyName ILIKE '%search%' OR jobTitle ILIKE '%search%'
  - Always add ORDER BY updatedAt DESC
  - Return items with resume (id, name) and tags (id, name, color) included
- createApplication(userId, data) → Application
  - Create Application row
  - Create ApplicationEvent of type CREATED
  - Return full application
- getApplication(applicationId, userId) → full Application with all relations (see api-spec.md)
  - Throw 404 if not found, 403 if wrong user
- updateApplication(applicationId, userId, data) → Application
- updateStatus(applicationId, userId, status, note?) → Application
  - Update status
  - Create ApplicationEvent of type STATUS_CHANGED with oldStatus, newStatus, note
- deleteApplication(applicationId, userId) → void

Tag endpoints in application.service.ts:
- addTag(applicationId, userId, tagId) → void
- removeTag(applicationId, userId, tagId) → void

Also implement in separate contact.service.ts:
- createContact, updateContact, deleteContact (standard CRUD, check userId via application)

Write tests for:
- listApplications filters work correctly
- createApplication creates both Application and CREATED event
- updateStatus creates STATUS_CHANGED event with correct old/new status
- getApplication returns 403 for wrong user
- getApplication includes all relations
```

---

## Phase 6 — AI Integration

**Goal:** Three AI endpoints: analyze, cover letter, interview prep.

```
Implement AI integration following CLAUDE.md AI Integration section exactly.
Provider is abstracted — swapping providers only requires editing server/src/lib/ai.ts.

Files to create:
- server/src/lib/ai.ts — AI client singleton (currently Gemini, swap here to change provider)
- server/src/services/ai.service.ts — all three AI methods (signatures never change)
- Add AI route handlers to server/src/controllers/application.controller.ts
- Add AI routes to server/src/routes/application.routes.ts

server/src/lib/ai.ts:
  import { GoogleGenerativeAI } from '@google/generative-ai';
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required');
  export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

ai.service.ts — implement three methods. For each:
  - Build a detailed prompt
  - For JSON responses: use generationConfig: { responseMimeType: 'application/json' }
  - Parse response with JSON.parse in try/catch
  - Throw AppError(500, 'AI_PARSE_ERROR', ...) on parse failure

analyzeApplication(resumeText: string, jobDescription: string):
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  });
  
  Prompt structure:
  "You are an expert technical recruiter helping a candidate assess their job application fit.
   
   CANDIDATE RESUME:
   [resumeText]
   
   JOB DESCRIPTION:
   [jobDescription]
   
   Analyze the match and return JSON in this exact format:
   {
     \"score\": <integer 0-100 representing overall fit>,
     \"matched\": [<keywords/skills present in both resume and JD>],
     \"missing\": [<important keywords/skills in JD not in resume>],
     \"suggestions\": [<specific, actionable resume improvement suggestions>]
   }"
  
  After getting response:
  - Update Application with matchScore and matchAnalysis
  - Create ApplicationEvent of type ANALYSIS_COMPLETED

generateCoverLetter(resumeText, jobDescription, applicantName, companyName, jobTitle):
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });  // plain text — no JSON mode
  
  Prompt should instruct the model to:
  - Write a professional, enthusiastic cover letter (~300 words)
  - Reference specific skills/experiences from the resume that match the JD
  - Not invent experience not in the resume
  - Format: "Dear Hiring Manager," opening, 3 body paragraphs, "Sincerely, [name]" closing
  - Return plain text only
  
  After getting response:
  - Create CoverLetter row (set any existing isActive to false first)
  - Create ApplicationEvent of type COVER_LETTER_GENERATED

generateInterviewQuestions(resumeText, jobDescription, companyName):
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  });
  
  Returns JSON: { questions: [{ question, category, tips }] }
  Generate 8 questions: 3 technical, 3 behavioral, 2 company-specific
  
  After getting response:
  - Upsert InterviewPrep row (use updateOrCreate pattern with applicationId as unique key)
  - Create ApplicationEvent of type INTERVIEW_PREP_GENERATED

Route handlers (auth required for all):
- POST /applications/:id/analyze
- POST /applications/:id/cover-letter
- PATCH /cover-letters/:id (update content only)
- GET /cover-letters/:id/download
- POST /applications/:id/interview-prep

Each handler must:
1. Get the application (check userId match)
2. Verify resume is attached and parsedText is not null (throw AppError 400 if missing)
3. Call ai.service method
4. Return formatted response per api-spec.md

Write tests:
- Mock the @google/generative-ai module (jest.mock)
- analyzeApplication returns correct shape and updates Application row
- generateCoverLetter creates CoverLetter row with isActive: true
- generateInterviewQuestions creates 8 questions
- All endpoints return 400 if application has no resume attached
```

---

## Phase 7 — Dashboard Stats Endpoint

**Goal:** Aggregate stats for the dashboard charts.

```
Implement GET /dashboard/stats and GET /dashboard/recent.

dashboard.service.ts:
- getStats(userId):
  Use Prisma groupBy to count applications by status in one query:
  prisma.application.groupBy({ by: ['status'], where: { userId }, _count: true })
  
  Calculate responseRate: count apps with any event of type STATUS_CHANGED to SCREENING or later
  divided by count apps with status != WISHLIST.
  
  Calculate avgDaysToResponse: for apps that have a SCREENING event,
  compute average of (event.createdAt - application.appliedDate) in days.
  Use raw query or JavaScript computation after fetching relevant records.

- getRecentActivity(userId):
  Return last 10 ApplicationEvents across all user's applications,
  include application.companyName and application.jobTitle via join.

Mount at GET /api/v1/dashboard/stats and GET /api/v1/dashboard/recent (auth required).
```

---

## Phase 8 — Frontend: Auth Pages

**Goal:** Login and register pages that call the API and store the access token.

```
Build the client auth system in Next.js 15 App Router.

Token storage strategy: store accessToken in memory (React state/context).
Do NOT use localStorage or sessionStorage (these are banned in this project).
On page refresh, call POST /auth/refresh (the cookie persists) to get a new access token.

Create:
1. client/src/lib/api/auth.ts — fetch wrappers for register, login, logout, refresh, getMe
   All use: fetch(NEXT_PUBLIC_API_URL + '/api/v1/auth/...')
   For authenticated calls: include Authorization header
   For cookie calls: include credentials: 'include'

2. client/src/hooks/use-auth.ts — useAuth hook backed by React context
   Provides: { user, accessToken, login, logout, register, isLoading }
   On mount: calls refresh() to restore session from cookie → sets token in state

3. client/src/app/(auth)/login/page.tsx
   Form: email + password fields (use react-hook-form + zod validation)
   On submit: call login() → redirect to /dashboard
   Link to register page
   Google login button: links to {API_URL}/api/v1/auth/google

4. client/src/app/(auth)/register/page.tsx
   Form: name + email + password + confirm password
   Same validation pattern as login

5. client/src/app/auth/callback/page.tsx
   Reads ?token= from URL, stores in auth context, redirects to /dashboard

6. client/src/app/(dashboard)/layout.tsx
   Checks if user is authenticated (via useAuth). If not, redirect to /login.
   Renders Sidebar + main content area.

Use shadcn/ui Form, Input, Button components.
Show API error messages under the form on submit failure.
Show loading state on submit button while request is in flight.
```

---

## Phase 9 — Frontend: Applications UI

**Goal:** The main application management interface.

```
Build the core application tracking UI.

Pages to create in client/src/app/(dashboard)/:

1. applications/page.tsx — Application list
   - Fetch GET /applications with status filter + search
   - Render ApplicationCard components in a grid
   - Filter bar: status tabs (All / Wishlist / Applied / etc.), search input
   - Empty state with CTA to add first application
   - "New Application" button → opens AddApplicationModal

2. applications/[id]/page.tsx — Application detail
   - Fetch GET /applications/:id
   - Tabs: Overview | Cover Letter | Interview Prep | Timeline | Contacts
   
   Overview tab:
   - Job details (company, title, location, salary, employment type, URL link)
   - Match score display (circular progress or badge, color coded 0-50 red, 51-75 amber, 76+ green)
   - Match analysis cards: Matched Keywords (green chips), Missing Keywords (red chips), Suggestions (list)
   - "Analyze Match" button (calls POST /analyze, shows loading state)
   - Status pipeline (horizontal stepper showing current status)
   - "Change Status" dropdown
   - Notes textarea (auto-saves on blur)

   Cover Letter tab:
   - If no cover letter: "Generate Cover Letter" button
   - If exists: textarea showing content (editable), Save button
   - Version history in sidebar (click to restore)
   - Download as text file button

   Interview Prep tab:
   - If status is not INTERVIEW: locked state with message "Unlock when you reach Interview stage"
   - If INTERVIEW: "Generate Interview Questions" button (if none yet)
   - Questions displayed as accordion: question text + category badge + tips on expand

   Timeline tab:
   - Vertical timeline showing all ApplicationEvents
   - Each event: icon (different per EventType) + description + timestamp
   - "Add note" button → inline form

   Contacts tab:
   - List of contacts with email + LinkedIn links
   - "Add Contact" form (name, role, email, linkedin)

3. resumes/page.tsx — Resume management
   - List of resume versions with default badge
   - Upload button → file input → presigned URL flow:
     (a) POST /resumes/presigned-url → get URL and s3Key
     (b) PUT file to presigned URL
     (c) POST /resumes/confirm
   - Set as default button
   - Delete button
   - Show extraction status (parsedText === null → "Processing..." spinner)

4. dashboard/page.tsx — Dashboard
   - Fetch GET /dashboard/stats
   - Application funnel chart (Recharts BarChart): count per status
   - Stats row: Total Applied, Response Rate %, Active Applications
   - Recent activity feed (GET /dashboard/recent)

Create client/src/lib/api/ files for each resource that wrap fetch with proper auth headers.
All data fetching via React state + useEffect (no React Query needed for portfolio scope).
Show loading skeleton (shadcn Skeleton component) while fetching.
Show toast notification on success/error for all mutations (shadcn Toast or Sonner).
```

---

## Phase 10 — Tests

**Goal:** Bring test coverage to a presentable level.

```
Write the remaining tests to reach ~70% service layer coverage.

Server tests to add/complete:

1. server/src/tests/auth.test.ts — already specified in Phase 2

2. server/src/tests/application.test.ts:
   - createApplication creates Application + CREATED event
   - updateStatus creates STATUS_CHANGED event, records correct old/new status
   - listApplications with status filter returns only matching items
   - listApplications with search filter is case-insensitive
   - getApplication returns 403 when userId doesn't match
   - getApplication includes coverLetters, contacts, interviewPrep, events in response

3. server/src/tests/ai.test.ts:
   - Mock the @google/generative-ai module (jest.mock)
   - analyzeApplication returns correct shape when AI returns valid JSON
   - analyzeApplication throws AI_PARSE_ERROR when AI returns invalid JSON
   - generateCoverLetter creates CoverLetter row and sets previous isActive to false
   - All three methods throw 400 if application.resume.parsedText is null

4. server/src/tests/resume.test.ts:
   - confirmUpload creates Resume row with correct fields
   - getResume throws 403 for wrong userId
   - deleteResume returns 404 if resume doesn't exist

Client tests (React Testing Library):
- login/page.tsx: renders form, shows validation errors, shows API error on failed login
- ApplicationCard: renders company name, status badge, match score
- StatusBadge: renders correct color for each status
- AddApplicationModal: validates required fields before submit

Run all tests: 
cd server && npx jest --coverage
cd client && npx jest --coverage
```

---

## Phase 11 — Docker

**Goal:** Full local dev environment via docker-compose.

```
Finalize docker-compose.yml for local development.

docker-compose.yml should have three services:

postgres:
  image: postgres:16-alpine
  environment: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
  volumes: postgres-data:/var/lib/postgresql/data
  ports: 5432:5432
  healthcheck: pg_isready -U jobtracker

server:
  build: ./server (create server/Dockerfile — multi-stage is overkill for dev)
  Dockerfile: FROM node:20-alpine, COPY package.json, RUN npm install, COPY ., CMD ts-node-dev src/index.ts
  volumes: ./server/src:/app/src (hot reload)
  env_file: ./server/.env
  ports: 4000:4000
  depends_on: postgres (condition: service_healthy)

client:
  build: ./client
  Dockerfile: FROM node:20-alpine, COPY, RUN npm install, CMD npm run dev
  volumes: ./client/src:/app/src
  env_file: ./client/.env.local
  ports: 3000:3000
  depends_on: server

Also create server/Dockerfile.prod (multi-stage):
  Stage 1: build — npm ci, tsc
  Stage 2: production — copy dist/, node_modules, run node dist/index.js

Run locally: docker compose up --build
Run migrations inside container: docker compose exec server npx prisma migrate deploy
```

---

## Phase 12 — GitHub Actions CI/CD

**Goal:** CI pipeline that runs on every PR and push to main.

```
Create .github/workflows/ci.yml

The workflow should trigger on: push to main, pull_request to main.

Jobs:

1. test-server:
   runs-on: ubuntu-latest
   services:
     postgres:
       image: postgres:16
       env: POSTGRES_DB=jobtracker_test POSTGRES_USER=jobtracker POSTGRES_PASSWORD=password
       options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
       ports: 5432:5432
   
   steps:
   - uses: actions/checkout@v4
   - uses: actions/setup-node@v4 with node-version: '20'
   - run: cd server && npm ci
   - run: cd server && npx prisma migrate deploy
     env: DATABASE_URL=postgresql://jobtracker:password@localhost:5432/jobtracker_test
   - run: cd server && npx jest --coverage --runInBand
     env: (all required env vars as GitHub secrets)

2. test-client:
   runs-on: ubuntu-latest
   steps:
   - uses: actions/checkout@v4
   - uses: actions/setup-node@v4 with node-version: '20'
   - run: cd client && npm ci
   - run: cd client && npx jest --coverage

3. build (runs after both tests pass):
   - Build server TypeScript: cd server && npx tsc --noEmit
   - Build client: cd client && npm run build

Store secrets in GitHub repo settings: GEMINI_API_KEY, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

Add README.md at project root documenting:
- What the project is (1 paragraph)
- Architecture diagram (link to CLAUDE.md or inline ASCII)
- Tech stack (table)
- Local setup instructions (step by step)
- Running tests
- Environment variables reference
```

---

## Interview Talking Points (prepare these for each phase)

Phase 2 — Auth: "Why refresh token rotation? What happens if a refresh token is stolen?"
Phase 4 — S3: "Why presigned URLs instead of routing through the server? What are the tradeoffs?"
Phase 5 — Events: "Why store status change history rather than just the current status?"
Phase 6 — AI: "How did you abstract the AI provider so you can swap Gemini for Claude by editing one file? Why native JSON mode over prompt-based extraction?"
Phase 7 — Dashboard: "How did you calculate response rate and avgDaysToResponse efficiently in one DB round trip?"
Phase 10 — Tests: "What's your testing strategy? Why real DB over mocked Prisma?"
Phase 12 — CI: "Walk me through what happens when you push a PR to this repo."