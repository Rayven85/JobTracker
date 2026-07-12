# Polish & Hardening Backlog

Deferred improvements to tackle **after core features are complete**. These are known
rough edges — not bugs blocking development — captured so nothing gets lost. Add new
items here as they come up.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Docker / Local Onboarding

- [ ] **`docker compose up` likely fails to connect to the DB.** The `server` service
  loads `server/.env`, whose `DATABASE_URL` points at `localhost:5432`. Inside the Docker
  network `localhost` resolves to the container itself, not the `postgres` service, so the
  API can't reach the database. Fix by pointing the containerised DB host at the service
  name (`postgres:5432`) — e.g. override `DATABASE_URL` in `docker-compose.yml` for the
  `server` service, rather than relying on the local `.env`.
  _(Inferred from config; not yet reproduced — verify once Docker is installed.)_

- [ ] **Verify the full `docker compose up --build` stack end-to-end.** Docker Desktop is
  not installed on the current dev machine, so the compose path has never been run here.
  Install Docker, bring up all three services (postgres + server + client), confirm the app
  works at `localhost:3000`. Goal: "clone → one command → full stack running" as a genuine,
  demoable claim.

- [ ] **README references `server/.env.example`, which does not exist.** The setup step
  `cp server/.env.example server/.env` can't work. Add a real `server/.env.example`
  (keys only, no secrets) so onboarding actually works.

## Stale Docs — AI provider swapped Gemini → Groq

The app now uses Groq (`groq-sdk`, `GROQ_API_KEY`), but several places still say Gemini:

- [ ] `README.md` — architecture diagram + tech-stack table + prerequisites still say
  "Google Gemini 1.5-flash". Update to Groq.
- [ ] `CLAUDE.md` (root) — the whole "AI Integration" section documents Gemini APIs
  (`@google/generative-ai`, `responseMimeType` JSON mode). Rewrite for Groq.
- [ ] `.github/workflows/ci.yml` — passes `GEMINI_API_KEY` secret; the code reads
  `GROQ_API_KEY`. Update the CI env (and the GitHub secret) accordingly.

## Features / UX

- [ ] **Multiple tailored-resume PDF templates.** The tailored-resume PDF export (Resume tab
  on an application) currently renders one default single-column template. Offer a few
  templates (e.g. classic, modern, compact) the user can pick from before Download/Save.
  Template lives in `client/src/lib/resume-pdf.tsx` (`@react-pdf/renderer`).

## Deployment / "Going live"

- [ ] Confirm current Railway deploy status. Production path (`server/Dockerfile.prod` +
  `railway.toml`) is sound and independent of the local compose issues above. Verify the
  live URL works, env vars are set on Railway (incl. `GROQ_API_KEY`, not `GEMINI_API_KEY`),
  and migrations run on deploy. Add the live URL to the README once confirmed.

---

_Last updated: 2026-07-12_
