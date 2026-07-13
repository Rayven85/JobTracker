# JobTracker — Frontend Context for Claude Code

## Project Overview

A job application tracking SPA. Frontend is complete with mock data. The task is to **connect it to the real backend API** — replacing all mock data and simulated AI calls with real HTTP requests.

## Tech Stack

- **Framework**: React 18 + Vite 6
- **Styling**: Tailwind CSS v4 (use `@theme` CSS variables, NOT `tailwind.config.js`)
- **Routing**: `react-router` v7 (NOT `react-router-dom`)
- **State**: React Context only (`AppContext`, `ThemeContext`) — no Redux, no Zustand
- **Forms**: `react-hook-form` v7.55.0
- **Charts**: `recharts`
- **Drag & Drop**: `react-dnd` + `react-dnd-html5-backend`
- **Toasts**: `sonner` — import as `import { toast } from "sonner"`
- **Icons**: `lucide-react`
- **Package manager**: `pnpm`

## Directory Structure

src/ ├── app/ │ ├── App.tsx # Router root, providers (DndProvider > ThemeProvider > AppProvider) │ ├── contexts/ │ │ ├── AppContext.tsx # ALL app state + mutations (replace mock with API calls here) │ │ └── ThemeContext.tsx # Theme toggle (default/alt), persisted to localStorage │ ├── hooks/ │ │ └── useAppColors.ts # Theme-aware status colors + avatar palette │ ├── data/ │ │ └── mockData.ts # DELETE after backend integration │ ├── types/ │ │ └── index.ts # All TypeScript interfaces — keep these, they match the backend schema │ ├── pages/ │ │ ├── LoginPage.tsx │ │ ├── RegisterPage.tsx │ │ ├── DashboardPage.tsx │ │ ├── ApplicationsPage.tsx │ │ ├── ApplicationDetailPage.tsx │ │ └── ResumesPage.tsx │ └── components/ │ ├── layout/Sidebar.tsx │ ├── shared/ │ │ ├── StatusBadge.tsx # Uses useAppColors() — do not hardcode colors │ │ ├── MatchScoreBadge.tsx │ │ ├── TagChip.tsx │ │ ├── EmptyState.tsx │ │ └── ConfirmDeleteDialog.tsx │ └── applications/ │ ├── ApplicationCard.tsx │ ├── KanbanCard.tsx # KanbanCard + KanbanColumn │ └── ApplicationForm.tsx # Slide-in drawer ├── styles/ │ ├── index.css │ ├── theme.css # CSS variables for both themes │ ├── fonts.css │ └── tailwind.css


## Design System — Critical Rules

### Never hardcode colors in components

| Purpose | Class |
|---|---|
| Page background | `bg-background` |
| Card/surface | `bg-card` |
| Subtle background | `bg-muted` |
| Input background | `bg-input` |
| Primary text | `text-foreground` |
| Secondary text | `text-muted-foreground` |
| Border | `border-border` |
| Primary action | `bg-primary text-primary-foreground` |
| Destructive | `bg-destructive text-destructive-foreground` |
| Sidebar | `bg-sidebar` |

### Theme-aware status/avatar colors

Always use the hook, never import STATUS_COLORS directly:

```tsx
import { useAppColors } from "../hooks/useAppColors";
const { statusColors, getAvatarColor } = useAppColors();
Two themes
Default (Earthy): warm cream bg, Georgia serif, rust primary, radius 6px
Alt (Rose): pale pink bg, Playfair Display serif, pink primary, radius 16px
Toggled via .alt-theme class on <html>, saved to localStorage key jt-theme
Border radius
Always use rounded-[--radius], rounded-[--radius-lg], rounded-[--radius-xl] — never rounded-md etc.

Key Data Types
type Status = "WISHLIST" | "APPLIED" | "SCREENING" | "INTERVIEW" | "OFFER" | "REJECTED" | "WITHDRAWN"

interface Application {
  id: string
  company: string
  role: string
  status: Status
  location?: string
  employmentType: "Full Time" | "Part Time" | "Contract" | "Internship" | "Graduate"
  remote: boolean
  appliedDate?: string       // ISO string
  deadline?: string          // ISO string
  jobDescription?: string
  jobUrl?: string
  resumeId?: string
  salaryMin?: number
  salaryMax?: number
  notes?: string
  tags: Tag[]
  contacts: Contact[]
  events: ApplicationEvent[]
  coverLetters: CoverLetter[]
  interviewQuestions: InterviewQuestion[]
  analysis?: AIAnalysis
}

interface Resume {
  id: string
  name: string
  filename: string
  size: number
  uploadedAt: string
  isDefault: boolean
  parsedText?: string
}

interface AIAnalysis {
  matchScore: number
  matchedSkills: string[]
  missingSkills: string[]
  suggestions: string[]
}
AppContext — Where to Replace Mock with Real API
src/app/contexts/AppContext.tsx is the single source of truth. Pattern to follow:

// BEFORE (mock):
const addApplication = useCallback((data) => {
  const newApp = { ...data, id: generateId(), events: [...] }
  setApplications(prev => [newApp, ...prev])
  toast.success("Added")
}, [])

// AFTER (real API):
const addApplication = useCallback(async (data) => {
  const res = await fetch("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
  const newApp = await res.json()
  setApplications(prev => [newApp, ...prev])
  toast.success("Added")
}, [])
AI functions to replace (currently setTimeout mock):
analyzeWithAI(appId) → POST /api/applications/:id/analyze
generateCoverLetter(appId) → POST /api/applications/:id/cover-letter
generateInterviewQuestions(appId) → POST /api/applications/:id/interview-questions
Resume upload
addResume() currently takes metadata only — replace with FormData multipart POST.

Auth
Login/Register currently mock-navigate to /dashboard. Wire up:

POST /api/auth/login → store JWT → navigate
POST /api/auth/register → same
Add route guard wrapping AppShell routes
Logout: clear token, navigate to /login
UI Patterns
// Primary button
<button className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-[--radius] text-sm font-medium transition-colors">

// Secondary button
<button className="px-4 py-2 bg-muted hover:bg-accent border border-border text-foreground rounded-[--radius] text-sm font-medium transition-colors">

// Input
<input className="w-full bg-input border border-border rounded-[--radius] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/20 transition-colors" />

// Card
<div className="bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm">
Routes
Path	Component	Auth required
/	→ redirect /login	No
/login	LoginPage	No
/register	RegisterPage	No
/dashboard	DashboardPage	Yes
/applications	ApplicationsPage	Yes
/applications/:id	ApplicationDetailPage	Yes
/resumes	ResumesPage	Yes
Do NOT
Use react-router-dom — only react-router v7
Hardcode hex colors — use CSS variable classes
Create tailwind.config.js — Tailwind v4 config is in CSS
Add dark: variants — dark mode uses .dark class + CSS vars
Import STATUS_COLORS from types in UI — use useAppColors() hook