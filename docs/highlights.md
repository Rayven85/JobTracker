# Engineering Highlights

War stories and quantified outcomes, newest first — raw material for resume bullets and
interview answers. Append an entry after every significant piece of work.

---

## 2026-07-14 — Reproducible README screenshot pipeline (and the orphan-process hunt)

**What:** README screenshots are not hand-taken — `npm run screenshots` boots the same
hermetic stack as the E2E suite, seeds a realistic demo account (6 applications across
the pipeline, AI analysis, tailored resume) via the API, and captures four 2x-scale
shots through a real browser. Re-runnable whenever the UI changes; screenshots can never
drift from the product again. The pipeline immediately caught a real bug: the dashboard
activity feed rendered a raw `TAILORED_RESUME_GENERATED` enum (missing label mapping).

**The debugging story:** the first runs produced a match score of 40 instead of the
stub's 78. Root cause: an **orphaned dev-server process** from a stopped task days
earlier still owned port 4000 — running with the real Groq API key and the dev database.
The "hermetic" tests had been silently talking to a real LLM. Found by comparing the
process start time against the session timeline (`lsof` + `ps -o lstart`), killed the
orphan, and re-ran clean. Lesson: when a stub returns impossible values, first ask
*which process actually answered*.

**Resume angle:** "Automated README screenshots as a reproducible browser pipeline
sharing the E2E stack's hermetic stubs — and traced a 'stub returning wrong values'
mystery to an orphaned process from a previous session holding the port with real
credentials."

## 2026-07-14 — Smart-merge logic under test (server suite 33 → 44)

**What:** The profile smart-merge pipeline — the product's most intricate code — went
from 2 tests to 13. New coverage (`profile-merge.test.ts`, 11 tests): case-insensitive
suggestion dedupe across skills/experience/education, the dismiss flow (incl. 403 on
another user's resume), and `buildProfileFromResumes` surviving individual extraction
failures without losing the batch.

**The interesting part — testing around an LLM:** the AI merge plan is validated at the
trust boundary. Tests prove that malformed LLM output (out-of-range indices, missing
merged entries) is filtered before it can corrupt the profile, and that the service
short-circuits without calling the LLM at all when there is nothing to compare
(asserted via the SDK mock's call count).

**Resume angle:** "Treated LLM output as untrusted input: index-validated every
AI-proposed merge at the service boundary and proved the filters with SDK-boundary
tests, including no-call short-circuit assertions."


## 2026-07-14 — E2E test layer: hermetic Playwright suite in CI

**What:** Added the third testing layer (unit → integration → E2E): Playwright browser
tests covering the flagship golden path (register → create application with JD →
generate profile-tailored resume → download client-rendered PDF) plus a session-persistence
regression test that would have caught the entire auth saga below in CI.

**How it stays hermetic:** Playwright's `webServer` boots three processes — a 60-line
stubbed Groq endpoint (`e2e/mock-groq.mjs`), the real Express API pointed at it via a
one-line `GROQ_BASE_URL` seam in `lib/ai.ts`, and the real Next.js client. Only Postgres
is real; no secrets, no LLM spend, no flakiness from external APIs. Suite runs in ~14s
locally.

**Resume angle:** "Built a hermetic Playwright E2E layer that boots the full stack
(Next.js + Express + Postgres) against a stubbed LLM backend, covering the product's
golden path and pinning a production auth regression — wired into GitHub Actions."

First feature developed on a feature branch + PR (previously everything went straight
to main).

## 2026-07-13/14 — Production auth saga: one symptom, three stacked bugs

**Symptom:** on the live site (Vercel client + Railway API), any page refresh bounced the
user to /login; later, Google OAuth logins bounced too.

**The three bugs, peeled like an onion:**
1. **Cross-site cookie** (`a2e2e16`): the HttpOnly refresh cookie was `SameSite=Lax`
   across `*.vercel.app` ↔ `*.railway.app` — browsers reject it. Fix: same-origin proxy
   via Next.js `rewrites` (`/api/*` → API), making the cookie first-party in every
   browser including Safari. OAuth callback also rerouted through the proxy, and the
   access token removed from the redirect URL.
2. **Response-shape mismatch** (`c9de91d`): `getMe()` declared `{ user: {...} }` via an
   `as` cast but the API returns the user object directly — session restore destructured
   `undefined` and silently logged users out *while every request returned 200*.
   Diagnosed from the user's DevTools evidence (refresh 200 + cookie present, still
   bounced). Lesson: `as` casts silence the type system exactly where it's needed most.
3. **Refresh-rotation race** (`2333428`): AuthProvider and the OAuth callback page both
   fired `/auth/refresh` with the same cookie; rotation 401'd whichever lost the race.
   Fix: callback page waits for AuthProvider; `refreshAccessToken` made single-flight.

Each fix was verified at the HTTP layer with curl against production before asking for
browser confirmation; regression tests added for layers 2 and 3, and the E2E suite now
covers the whole path in a real browser.

**Resume angle:** "Diagnosed and fixed three stacked production auth bugs (cross-site
cookie policy, an `as`-cast response-shape mismatch, a refresh-token rotation race)
behind a single symptom, using layer-by-layer elimination from HTTP probes to DevTools
evidence; hardened with regression and E2E tests."

## 2026-07-13 — CI resurrection: 19/19 failures → consistently green

**Found during a self-audit:** the GitHub Actions pipeline had **never passed** — 19
runs, 19 failures since creation — while the app deployed "successfully" the whole time
(Railway/Vercel builds don't run tests; a green deploy says nothing about correctness).

**Two root causes, found by local reproduction rather than guesswork:**
1. Env vars required at import time (`GROQ_API_KEY` after a Gemini→Groq provider swap,
   `SERVER_URL`, `GOOGLE_CLIENT_*`) were missing in CI — every suite crashed on import.
2. **Prisma 7 removed the postinstall auto-generate**, so a fresh `npm ci` had no
   generated client. Proven by hiding `node_modules/.prisma` locally and reproducing the
   exact CI failure; ruled out Node-version and fresh-DB differences first by downloading
   a standalone Node 20 binary and rebuilding the schema from committed migrations.

**Fix philosophy:** CI now needs **zero repository secrets** — the Groq SDK is mocked in
tests, S3 presigning is a local signature computation, JWT accepts any string. Hermetic
by construction.

**Resume angle:** "Diagnosed a CI pipeline that had never passed (19/19 failures) down to
two root causes — import-time env validation and Prisma 7's removed postinstall generate —
and rebuilt it to run hermetically with zero repository secrets."

## 2026-07-12/13 — Self-audit & hardening sprint

Reviewed the repo as an NZ hiring panel would and fixed the highest-impact gaps in a day:
README rewritten against reality (provider/framework claims had drifted), `.env.example`
added, dead Gemini dependency removed, auth endpoints rate-limited
(429s follow the API error contract; disabled under test), production 500s no longer echo
internal error messages, all docs realigned with the actual file tree.

Also the origin of `docs/polish-backlog.md` as the living known-issues list.

## Earlier — architecture decisions that paid off

- **Provider-swappable AI layer:** all prompts in `ai.service.ts`, all SDK calls behind a
  two-function contract in `lib/ai.ts` (`generateJSON`/`generateText`). Proven when
  swapping Gemini → Groq: exactly one file changed. The same seam later enabled the
  hermetic E2E stub (`GROQ_BASE_URL`).
- **JWT auth from scratch** with rotating, SHA-256-hashed refresh tokens — rotation is
  tested (a reused token 401s), and the E2E layer now covers restore-from-cookie.
- **S3 presigned uploads** (browser → S3 directly, 10-min expiry) with a background
  PDF-extraction status machine (`PENDING/READY/EMPTY/FAILED`).
- **Real-database testing strategy:** Supertest against Postgres (never mock Prisma),
  SDK-boundary mocks for the LLM.
