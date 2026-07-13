# Client — Next.js 15 App Router (port 3000)

See root CLAUDE.md for full conventions, auth system, and code standards.
This file covers client-specific patterns only.

---

## Route Group Layouts

```
app/
  (auth)/          ← login, register — no sidebar, no header
    login/page.tsx
    register/page.tsx
  (dashboard)/     ← all authenticated pages — includes Sidebar + Header via layout
    layout.tsx     ← wraps all dashboard pages with auth check + sidebar
    dashboard/page.tsx
    applications/page.tsx     (+ applications/[id]/page.tsx detail with tabs)
    resumes/page.tsx
    profile/page.tsx
  auth/callback/   ← Google OAuth landing (outside both groups)
```

Never put dashboard pages inside `(auth)/` or vice versa.

---

## API Call Pattern

All fetch calls live in `src/lib/api/` files, never inline in components. Every call goes
through `apiFetch` (src/lib/api/client.ts), which attaches the Bearer token and retries
once on 401 via the refresh cookie:

```typescript
// src/lib/api/applications.ts
import { apiFetch } from './client'

export async function getApplications(): Promise<Application[]> {
  const res = await apiFetch('/api/v1/applications')
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to fetch applications')
  return json.data
}
```

Pages and feature components call these lib/api functions directly (with useState/useEffect
for loading/error state); presentational components receive data as props.

---

## Token Storage

Access token: stored in memory (React state or context) — never localStorage.
Refresh is handled via HttpOnly cookie (automatic on every request to /api/v1/auth/refresh).
On 401 response: call refresh endpoint → retry original request once → if still 401, redirect to /login.

---

## Component Conventions

- All components are hand-rolled Tailwind — no UI kit (shadcn was considered, not adopted)
- `src/components/applications/`, `shared/`, `profile-forms/`, `layout/` — feature components
- Test files co-located: `ApplicationCard.test.tsx` next to `ApplicationCard.tsx`
- Keep data fetching in pages/feature components via lib/api; presentational components take props

---

## Adding a New Page

1. Create `app/(dashboard)/your-page/page.tsx`
2. Add nav link in `components/layout/Sidebar.tsx`
3. Add the path to root CLAUDE.md structure map
