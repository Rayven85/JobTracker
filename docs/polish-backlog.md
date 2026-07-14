# Polish & Hardening Backlog

Deferred improvements to tackle **after core features are complete**. These are known
rough edges — not bugs blocking development — captured so nothing gets lost. Add new
items here as they come up.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Production Bugs (verified or near-certain)

- [x] **Cross-site refresh cookie is dead in production.** Fixed and verified in prod
  2026-07-14. The full story turned out to be **three stacked bugs** with one symptom
  (page refresh bounced to /login):
  1. Cross-site cookie: fixed via same-origin proxy (`next.config.ts` rewrites `/api/*`;
     `API_PROXY_URL` on Vercel, `SERVER_URL` on Railway points at the client origin,
     Google console redirect URI updated). _(a2e2e16)_
  2. `getMe()` response-shape mismatch: `data` IS the user object, but an `as` cast
     claimed `{ user }`, so session restore set `user=undefined` while every request
     returned 200. Regression tests added. _(c9de91d)_
  3. Concurrent-refresh race: AuthProvider and the OAuth callback page both fired
     `/auth/refresh` with the same cookie; rotation 401'd the loser. Callback page now
     waits for AuthProvider; `refreshAccessToken` is single-flight. _(2333428)_

- [x] **OAuth callback leaks the access token in the redirect URL.** Fixed 2026-07-13:
  callback sets only the refresh cookie and redirects with a clean URL; the client
  exchanges the cookie via the AuthProvider restore flow. Legacy `?token=` branch
  removed 2026-07-14. Verified in prod (Google login end-to-end).

- [ ] **Rate limiter IP granularity behind double proxy.** With requests flowing
  client → Vercel proxy → Railway, `trust proxy: 1` resolves `req.ip` to Vercel's egress
  IP, so all users share rate-limit buckets. Irrelevant at current scale; revisit
  X-Forwarded-For depth if the app ever has real traffic.

## Docker / Local Onboarding

- [ ] **`docker compose up` likely fails to connect to the DB.** The `server` service
  loads `server/.env`, whose `DATABASE_URL` points at `localhost:5432`. Inside the Docker
  network `localhost` resolves to the container itself, not the `postgres` service, so the
  API can't reach the database. Fix by pointing the containerised DB host at the service
  name (`postgres:5432`) — e.g. override `DATABASE_URL` in `docker-compose.yml` for the
  `server` service, rather than relying on the local `.env`.
  _(Inferred from config; not yet reproduced — verify once Docker is installed.)_
  _Note: the README's Docker quick-start section was removed until this works; add it back
  once verified._

- [ ] **Verify the full `docker compose up --build` stack end-to-end.** Docker Desktop is
  not installed on the current dev machine, so the compose path has never been run here.
  Install Docker, bring up all three services (postgres + server + client), confirm the app
  works at `localhost:3000`. Goal: "clone → one command → full stack running" as a genuine,
  demoable claim.

- [x] **README references `server/.env.example`, which does not exist.** Added a real
  `server/.env.example` (keys only, no secrets). _(2026-07-13)_

- [ ] **Google OAuth env vars are mandatory at startup** (`lib/passport.ts` throws if
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are empty), although the feature is optional.
  Register the Google strategy conditionally and hide/disable the "Sign in with Google"
  button when unconfigured, so a fresh clone runs without placeholder values.

## Stale Docs — AI provider swapped Gemini → Groq

- [x] `README.md` — rewritten: Groq, Next 16, live demo link, features section, no shadcn
  claim, `SERVER_URL` documented. _(2026-07-13)_
- [x] `CLAUDE.md` (root) — AI Integration section rewritten for Groq (`generateJSON`/
  `generateText` contract), structure map aligned with the real file tree. _(2026-07-13)_
- [x] `.github/workflows/ci.yml` — CI had **never** passed (19/19 failures) because
  `GROQ_API_KEY`, `SERVER_URL`, and `GOOGLE_CLIENT_*` were missing at import time. Now uses
  hermetic dummy values (Groq SDK is mocked in tests; S3 presigning is local; JWT accepts
  any string) — **no repository secrets required**. _(2026-07-13)_
- [x] Removed dead `@google/generative-ai` dependency from `server/package.json`;
  deleted stray root `.env`. **TODO (manual): revoke the old Gemini API key in Google AI
  Studio.** _(2026-07-13)_

## Testing

- [x] **E2E golden path (Playwright).** Done 2026-07-14 (`feat/e2e-golden-path`):
  hermetic suite (stubbed Groq via `GROQ_BASE_URL`, real Postgres) covering the golden
  path (application → tailored resume → PDF download) and session persistence across
  refresh — the regression test for the auth saga. Wired into CI as `test-e2e`.

- [x] **Cover the smart-merge logic with unit tests.** Done 2026-07-14
  (`test/smart-merge-coverage`): 11 tests in `profile-merge.test.ts` covering
  case-insensitive suggestion dedupe (skills/experience/education), dismiss flow + 403,
  AI merge-plan index filtering (out-of-range / malformed matches from the LLM are
  dropped), no-AI-call short circuits, and `buildProfileFromResumes` surviving individual
  extraction failures. Server suite: 33 → 44 tests.

## Features / UX

- [ ] **Kanban board for applications.** Commit `ab49db9` mentions Kanban but only the
  dashboard funnel chart exists. A drag-and-drop status board (e.g. dnd-kit) is the most
  demo-friendly missing feature.

- [ ] **Multiple tailored-resume PDF templates.** The tailored-resume PDF export (Resume tab
  on an application) currently renders one default single-column template. Offer a few
  templates (e.g. classic, modern, compact) the user can pick from before Download/Save.
  Template lives in `client/src/lib/resume-pdf.tsx` (`@react-pdf/renderer`).

- [x] **README screenshots.** Done 2026-07-14 (`chore/readme-screenshots`): four shots
  (dashboard, applications, AI analysis, tailored-resume editor) generated by a
  reproducible Playwright pipeline (`cd e2e && npm run screenshots`) that seeds a demo
  account against the stubbed LLM — re-run any time the UI changes. Bonus: the pipeline
  caught a real bug (dashboard activity feed showed raw `TAILORED_RESUME_GENERATED`
  enum — missing EVENT_LABELS entry).
  - [ ] Optional follow-up: 60–90s golden-path GIF for the README.

## Deployment / "Going live"

- [~] Confirm current Railway deploy status. **Verified 2026-07-12:** frontend
  (job-tracker-gamma-lyart.vercel.app) serves, API `/health` returns ok, CORS allows the
  Vercel origin. Live URL added to README. **Still to verify:** AI features work in prod
  (`GROQ_API_KEY` set on Railway), S3 upload works in prod, and the cross-site cookie bug
  above (which currently undermines "fully working in production").

- [~] Git workflow: feature branches + self-reviewed PRs instead of pushing straight to
  `main` — NZ employers look for PR discipline in the repo history. Started with
  `feat/e2e-golden-path` (2026-07-14); applies to all future feature work.

---

_Last updated: 2026-07-14_
