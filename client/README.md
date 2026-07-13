# JobTracker — Client

Next.js 16 (App Router) frontend for [JobTracker](../README.md). See the root README for the full project overview, architecture, and setup instructions.

## Quick start

```bash
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local
npm run dev          # http://localhost:3000 (expects the API on port 4000)
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build |
| `npm test` | Jest + React Testing Library (tests co-located next to components) |
| `npm run lint` | ESLint |

## Structure

- `src/app/(auth)/` — login / register (no layout chrome)
- `src/app/(dashboard)/` — dashboard, applications, resumes, profile (sidebar layout)
- `src/components/` — feature components (hand-rolled Tailwind, no UI kit)
- `src/lib/api/` — one fetch module per resource; `client.ts` handles the Bearer token and retry-once-on-401 refresh flow
- `src/contexts/` — auth + theme providers
