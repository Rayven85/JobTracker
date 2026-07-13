# JobTracker — Claude Code Project Intelligence

## What This Is
AI-powered job application tracker built as a software engineering portfolio project.
Target audience: NZ tech employers (Xero, ASB, Orion Health, Spark, Windcave, etc.)
Demonstrates: TypeScript full-stack, PostgreSQL, AWS S3, Docker, GitHub Actions CI/CD,
JWT auth from scratch, provider-swappable AI integration (currently Groq).
Deployed: client on Vercel (job-tracker-gamma-lyart.vercel.app), API + Postgres on Railway.

---

## Monorepo Structure

```
jobtracker/
├── client/                        # Next.js 16 App Router — port 3000 (see client/CLAUDE.md)
│   ├── src/
│   │   ├── app/                   # Pages (App Router only — no pages/ directory)
│   │   │   ├── (auth)/            # login/, register/ — no layout chrome
│   │   │   ├── (dashboard)/       # dashboard/, applications/ (+[id] detail), resumes/, profile/ — with sidebar
│   │   │   ├── auth/callback/     # Google OAuth landing page (reads token, stores, redirects)
│   │   │   └── layout.tsx
│   │   ├── components/            # Hand-rolled Tailwind components — no UI kit
│   │   │   ├── applications/      # ApplicationCard, ApplicationForm, LocationCombobox
│   │   │   ├── shared/            # StatusBadge
│   │   │   ├── profile-forms/      # Shared structured-edit forms used by BOTH profile page & resume modal: FormModal, styles, ExperienceForm, EducationForm, CertificationForm, HeroFieldsForm, SkillsEditor, ExtractedDataEditor, MergeReview (smart-merge review)
│   │   │   └── layout/            # Sidebar
│   │   ├── contexts/              # AuthContext, ThemeContext
│   │   ├── lib/
│   │   │   ├── api/               # One file per resource: client.ts (token+refresh), applications.ts, resumes.ts, auth.ts, profile.ts, dashboard.ts
│   │   │   ├── resume-pdf.tsx     # Tailored-resume PDF template (@react-pdf/renderer, client-side export)
│   │   │   ├── status.ts          # Status labels/colors/pipeline order
│   │   │   ├── token.ts           # In-memory access token store
│   │   │   └── utils.ts
│   │   ├── hooks/                 # use-auth.ts
│   │   └── types/                 # TypeScript types (keep in sync with server validators)
│   ├── .env.local
│   └── package.json
│
├── server/                        # Express.js API — port 4000 (see server/CLAUDE.md)
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── resume.controller.ts
│   │   │   ├── application.controller.ts  # + analyzeApplication, generateCoverLetter, generateInterviewQuestions, generateTailoredResume
│   │   │   ├── contact.controller.ts
│   │   │   ├── tag.controller.ts
│   │   │   ├── cover-letter.controller.ts # updateCoverLetter, downloadCoverLetter
│   │   │   ├── tailored-resume.controller.ts # updateTailoredResume (PDF export is client-side, no download endpoint)
│   │   │   └── dashboard.controller.ts    # getStats, getRecentActivity
│   │   ├── services/
│   │   │   ├── auth.service.ts    # register, login, refresh, logout, getMe, findOrCreateGoogleUser, loginWithGoogle
│   │   │   ├── resume.service.ts        # + updateParsedText, updateExtractedData, reExtractProfile (re-run AI) — return {resume, suggestion} via profile diff
│   │   │   ├── profile.service.ts       # getProfile, updateProfile, syncResume (applies experienceMerges), buildProfileFromResumes, dismissResumeSuggestions, computeResumeProfileDiff, getSyncPlan (AI merge detection)
│   │   │   ├── application.service.ts  # listApplications, createApplication, getApplication, updateApplication, updateStatus, deleteApplication, getEvents, addTag, removeTag
│   │   │   ├── contact.service.ts      # createContact, updateContact, deleteContact
│   │   │   ├── tag.service.ts          # listTags, createTag, deleteTag
│   │   │   ├── ai.service.ts           # analyzeApplication, generateCoverLetter, generateInterviewQuestions, updateCoverLetter, getCoverLetter, extractProfileFromResume, detectExperienceMerges (smart merge), generateTailoredResume/updateTailoredResume (JD-matched resume from profile), serializeProfileToText. AI resume-text source: attached Resume.parsedText → else active TailoredResume. Tailored-resume PDF export is client-side (client/src/lib/resume-pdf.tsx, @react-pdf/renderer); "Save to Resumes" reuses the presigned S3 upload flow
│   │   │   └── dashboard.service.ts    # getStats (groupBy + responseRate + avgDaysToResponse), getRecentActivity
│   │   ├── routes/
│   │   │   ├── index.ts           # Mounts all routers, /health endpoint
│   │   │   ├── auth.routes.ts
│   │   │   ├── resume.routes.ts        # /resumes + /:id/parsed-text, /:id/extracted-data (PATCH structured AI data), /:id/re-extract (POST re-run AI), /:id/set-default
│   │   │   ├── profile.routes.ts       # /profile (GET, PATCH), /build, /sync-plan/:resumeId (POST — AI merge plan), /sync/:resumeId (POST, DELETE)
│   │   │   ├── application.routes.ts  # /applications + nested /:id/tags, /:id/contacts, /:id/events, /:id/analyze, /:id/cover-letter, /:id/interview-prep, /:id/tailored-resume
│   │   │   ├── contact.routes.ts      # /contacts/:id (PATCH, DELETE)
│   │   │   ├── tag.routes.ts          # /tags (GET, POST, DELETE /:id)
│   │   │   ├── cover-letter.routes.ts # /cover-letters/:id (PATCH), /:id/download (GET)
│   │   │   ├── tailored-resume.routes.ts # /tailored-resumes/:id (PATCH structured edits)
│   │   │   └── dashboard.routes.ts    # /dashboard/stats, /dashboard/recent
│   │   ├── middleware/
│   │   │   ├── auth.ts            # JWT verification → attaches req.user
│   │   │   ├── asyncHandler.ts    # Wraps async handlers, passes errors to next()
│   │   │   ├── validate.ts        # Zod validation middleware factory
│   │   │   ├── rateLimit.ts       # authLimiter (login/register), refreshLimiter — skipped when NODE_ENV=test
│   │   │   └── errorHandler.ts    # Global error handler — formats AppError to response; generic message on prod 500s
│   │   ├── validators/
│   │   │   ├── auth.validator.ts
│   │   │   ├── resume.validator.ts        # + updateParsedTextSchema, updateExtractedDataSchema (reuses profile.validator item schemas)
│   │   │   ├── profile.validator.ts       # updateProfileSchema, syncResumeSchema + exported educationSchema/experienceSchema/certificationSchema (shared with resume.validator)
│   │   │   ├── application.validator.ts  # createApplicationSchema, updateApplicationSchema, updateStatusSchema
│   │   │   ├── contact.validator.ts      # createContactSchema, updateContactSchema
│   │   │   ├── tag.validator.ts          # createTagSchema
│   │   │   ├── cover-letter.validator.ts # coverLetterRequestSchema, updateCoverLetterSchema
│   │   │   └── tailored-resume.validator.ts # updateTailoredResumeSchema (reuses profile item schemas)
│   │   ├── lib/
│   │   │   ├── prisma.ts          # PrismaClient singleton (uses PrismaPg adapter)
│   │   │   ├── tokens.ts          # signAccessToken, signRefreshToken, hashToken, verifyAccessToken
│   │   │   ├── passport.ts        # GoogleStrategy config — normalises req.user to { userId, email }
│   │   │   ├── s3.ts              # AWS S3Client singleton + helper functions
│   │   │   ├── ai.ts              # AI client singleton (currently Gemini — swap provider here)
│   │   │   └── AppError.ts        # Custom error class
│   │   ├── types/
│   │   │   └── express.d.ts       # Augments Express.Request with req.user
│   │   └── tests/                 # Jest + Supertest
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/            # Auto-generated by prisma migrate dev
│   ├── prisma.config.ts           # Prisma 7 config — datasource URL for CLI + migrations
│   ├── .env
│   └── package.json
│
├── docker-compose.yml
├── .github/workflows/ci.yml
└── CLAUDE.md
```

---

## Prisma 7 Notes (breaking changes from Prisma 5/6)

Prisma 7 removes `url = env("DATABASE_URL")` from schema.prisma datasource blocks.
Instead, use `prisma.config.ts` at the server root for CLI/migrate operations,
and pass an adapter to PrismaClient for runtime:

```typescript
// prisma.config.ts — used by prisma CLI (migrate, generate, studio)
import { defineConfig } from 'prisma/config';
export default defineConfig({ schema: 'prisma/schema.prisma', datasource: { url: process.env.DATABASE_URL } });

// src/lib/prisma.ts — used at runtime by Express
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
export const prisma = new PrismaClient({ adapter });
```

The datasource block in schema.prisma has only `provider = "postgresql"` — no url.

---

## Strict Layer Rules (enforce at all times)

Controllers do exactly three things: extract validated input, call one service method, send response.
No DB queries in controllers. No business logic. No direct AI/S3 calls.

Services own: DB queries (Prisma), external API calls (AI, S3), all business logic.
Services never import from Express (no Request, Response types).

Routes attach middleware and map HTTP verbs to controllers. Nothing else.

Validators are Zod schemas. Every validator file exports both the Zod schema AND the inferred TypeScript type.

---

## API Response Contract (every single endpoint — no exceptions)

Success:
```json
{ "success": true, "data": { ... } }
```

Error:
```json
{ "success": false, "error": { "code": "SNAKE_CASE_ERROR_CODE", "message": "Human readable" } }
```

HTTP Status Codes:
- 200 — GET, PATCH success
- 201 — POST success (resource created)
- 400 — Zod validation failure
- 401 — Missing, invalid, or expired access token
- 403 — Authenticated but accessing another user's resource
- 404 — Resource not found
- 409 — Conflict (e.g. duplicate email on register)
- 500 — Unexpected server error

---

## asyncHandler (use on every route handler)

```typescript
// server/src/middleware/asyncHandler.ts
import { RequestHandler } from 'express';

export const asyncHandler = (fn: RequestHandler): RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
```

Never use try/catch in controllers. Throw errors from services — asyncHandler catches them.

---

## AppError

```typescript
// server/src/lib/AppError.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

Throw from services: `throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found')`
The global errorHandler formats AppError into the standard error response shape.

---

## Auth System (JWT + Refresh Token Rotation)

No NextAuth. Implemented from scratch to demonstrate auth fundamentals.

Login flow:
1. POST /api/v1/auth/login → verify password (bcrypt) → issue access token + refresh token
2. Access token: 15 min expiry, JWT signed with JWT_ACCESS_SECRET, payload: { userId, email }
3. Refresh token: 7-day expiry, stored in DB as bcrypt hash, set as HttpOnly cookie
4. Every authenticated request: Authorization: Bearer <accessToken> header

Token refresh:
1. POST /api/v1/auth/refresh → read HttpOnly cookie → verify hash → issue new pair → revoke old

Auth middleware reads Authorization header, verifies JWT, attaches req.user = { userId: string, email: string }.
Throws AppError(401, 'INVALID_TOKEN', ...) on any failure.

Authorization check (services): always verify `resource.userId === req.user.userId` before returning or mutating.

Google OAuth via Passport.js:
- GET /api/v1/auth/google → redirects to Google consent
- GET /api/v1/auth/google/callback → finds or creates User, issues tokens, redirects to client

---

## S3 Upload Flow (presigned URLs — never buffer files in Express)

Step 1 — Client POSTs to get a presigned URL:
```
POST /api/v1/resumes/presigned-url
Body: { fileName: "Rayven_CV.pdf", contentType: "application/pdf" }
Returns: { presignedUrl: string, s3Key: string }
```
The s3Key format: `resumes/{userId}/{nanoid()}.pdf`
Presigned URL expiry: 600 seconds (10 minutes, no more).

Step 2 — Client PUTs file directly to S3 (browser → S3, no Express involved):
```
PUT presignedUrl
Headers: Content-Type: application/pdf
Body: File binary
```

Step 3 — Client confirms upload:
```
POST /api/v1/resumes/confirm
Body: { s3Key, fileName, fileSize, name }
Server: creates Resume row in DB, enqueues PDF text extraction
```

Step 4 — Background PDF extraction:
Server fetches PDF from S3 → extracts text with pdf-parse → saves to resumes.parsedText.
This text is used verbatim in all Gemini prompts. Never re-fetch from S3 during AI calls.

---

## AI Integration

Provider-swappable AI layer. Changing provider = editing one file only: server/src/lib/ai.ts.
All prompts and AI calls live exclusively in server/src/services/ai.service.ts.
Never call the AI provider from controllers or other service files.

Current provider: Groq (free tier)
Package: groq-sdk
Model: llama-3.3-70b-versatile (free tier — 12k tokens/min counting input + reserved max_tokens)

lib/ai.ts exposes a two-function contract — ai.service.ts uses ONLY these:

```typescript
// server/src/lib/ai.ts  ← only file that changes when swapping providers
generateJSON<T>(prompt: string, maxTokens = 4000): Promise<T>   // response_format json_object; throws AppError(500,'AI_PARSE_ERROR') on bad JSON
generateText(prompt: string, maxTokens = 1500): Promise<string> // plain text (cover letters)
```

Free-tier handling inside lib/ai.ts (do not duplicate in callers):
- 429s are retried with backoff honouring the server's retry-after; genuine exhaustion
  becomes AppError(503, 'AI_RATE_LIMITED', ...).
- Callers pass a max_tokens budget sized to each call; ai.service.ts also truncates large
  inputs (MAX_RESUME_CHARS / MAX_PROFILE_CHARS / MAX_JD_CHARS) so input + budget fits the limit.

Core AI service methods (public signatures take (applicationId, userId) and resolve resume
text internally; also: extractProfileFromResume, detectExperienceMerges, generateTailoredResume):

analyzeApplication(resumeText, jobDescription):
  Returns: { score: number, summary: string, matched: string[], missing: string[],
             strengths: {title,detail}[], gaps: {title,detail}[], suggestions: {title,detail}[] }
  (client renders strengths/gaps/suggestions as click-to-expand cards; tolerates the old
   {matched,missing,suggestions:string[]} shape for pre-existing analyses)

generateCoverLetter(resumeText, jobDescription, applicantName, companyName, jobTitle):
  Returns: string (plain text, ~300 words, ready to display in textarea)

generateInterviewQuestions(resumeText, jobDescription, companyName):
  Returns: { questions: Array<{ question: string, category: 'technical'|'behavioral'|'company', tips: string }> }

---

## Testing

Server: Jest + Supertest
Test files: server/src/tests/*.test.ts
Test DB: DATABASE_TEST_URL pointing to jobtracker_test database (separate from dev DB)
Strategy: real DB with transactions that rollback after each test — never mock Prisma.

Must test:
- Auth middleware: valid token, expired token, missing token, wrong user's resource (403)
- Each service method: happy path + main error cases (not found, wrong user, etc.)
- API endpoints: correct response shape, 400 on invalid body, 401 on no auth, 404 on missing

Client: Jest + React Testing Library
Test files: co-located *.test.tsx next to components
Must test: form validation, API error states, loading states, success renders.

Run server tests: cd server && npx jest --runInBand
Run client tests: cd client && npx jest

---

## Environment Variables

server/.env:
```
DATABASE_URL=postgresql://jobtracker:password@localhost:5432/jobtracker
DATABASE_TEST_URL=postgresql://jobtracker:password@localhost:5432/jobtracker_test
JWT_ACCESS_SECRET=<64 random chars>
JWT_REFRESH_SECRET=<64 different random chars>
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=jobtracker-resumes-dev
GROQ_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
CLIENT_URL=http://localhost:3000
SERVER_URL=http://localhost:4000
PORT=4000
NODE_ENV=development
```

client/.env.local:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## Code Conventions

- async/await everywhere — no .then() chains, no callbacks
- TypeScript strict mode ON in both tsconfig files — no `any` without // reason: comment
- Zod validates every POST and PATCH request body, never trust raw req.body
- Prisma for all DB access — no raw SQL unless a specific query has a documented performance reason
- Component files: PascalCase.tsx | Route/service files: kebab-case.ts | Hooks: use-camel-case.ts
- Client API calls: use fetch (not axios) in client/src/lib/api/ files
- Server HTTP calls: use axios in server (for interceptors, timeout config)
- No barrel files (index.ts re-exports) — they create circular dependency risk
- Path alias: @/ maps to client/src/ for imports

---

## DO NOT — Critical Rules

- Never put DB queries or business logic in controllers
- Never call the AI provider or S3 from anywhere except their designated service files
- Never return a password field, refresh token value, or AWS credentials in any response
- Never use res.json(data) without the { success: true, data } wrapper
- Never buffer a file upload in Express memory — always use presigned S3 URLs
- Never use any TypeScript without a comment explaining why
- Never wrap route handlers without asyncHandler
- Never skip Zod validation on POST/PATCH
- Never set presigned URL expiry longer than 10 minutes
- Never store plain text passwords — bcrypt with saltRounds: 12
- Never create barrel files
- Never hardcode secrets — always use process.env and check for undefined at startup