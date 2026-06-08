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
    applications/page.tsx
    resumes/page.tsx
```

Never put dashboard pages inside `(auth)/` or vice versa.

---

## API Call Pattern

All fetch calls live in `src/lib/api/` files, never inline in components:

```typescript
// src/lib/api/applications.ts
export async function getApplications(): Promise<Application[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` }
  });
  if (!res.ok) throw new Error('Failed to fetch applications');
  const json = await res.json();
  return json.data;
}
```

Components call the lib/api functions via hooks in `src/hooks/`.

---

## Token Storage

Access token: stored in memory (React state or context) — never localStorage.
Refresh is handled via HttpOnly cookie (automatic on every request to /api/v1/auth/refresh).
On 401 response: call refresh endpoint → retry original request once → if still 401, redirect to /login.

---

## Component Conventions

- `src/components/ui/` — shadcn/ui primitives only, never modify
- `src/components/applications/`, `resumes/`, `layout/` — feature components
- Test files co-located: `ApplicationCard.test.tsx` next to `ApplicationCard.tsx`
- Never create a component that fetches data — use hooks, pass data as props

---

## Adding a New Page

1. Create `app/(dashboard)/your-page/page.tsx`
2. Add nav link in `components/layout/Sidebar.tsx`
3. Add the path to root CLAUDE.md structure map
