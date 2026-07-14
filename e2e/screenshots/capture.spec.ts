import { test, expect, APIRequestContext } from '@playwright/test';
import path from 'path';

// Seeds a realistic demo account and captures the README screenshots.
// All AI content comes from the local Groq stub, so shots are reproducible.

const API = 'http://localhost:4000/api/v1';
const OUT = (name: string) => path.join(__dirname, '..', '..', 'docs', 'screenshots', name);
const PASSWORD = 'ScreenshotDemo123!';

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

async function api(
  request: APIRequestContext,
  token: string,
  method: 'post' | 'patch',
  url: string,
  data?: object
) {
  const res = await request[method](`${API}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(res.ok(), `${method.toUpperCase()} ${url} → ${res.status()}`).toBeTruthy();
  return res.json();
}

test('capture README screenshots', async ({ page, request }) => {
  test.setTimeout(180_000);

  // ── Seed: user + profile ──────────────────────────────────────────────────
  const email = `screenshot-${Date.now()}@test.jobtracker`;
  const reg = await request.post(`${API}/auth/register`, {
    data: { email, password: PASSWORD, name: 'Alex Chen' },
  });
  expect(reg.status()).toBe(201);
  const token = (await reg.json()).data.accessToken as string;

  await api(request, token, 'patch', '/profile', {
    name: 'Alex Chen',
    location: 'Auckland, NZ',
    summary:
      'Graduate software engineer with end-to-end TypeScript experience: Next.js, Express, PostgreSQL, and AWS. Built and deployed a full-stack AI-powered job tracker with a three-layer test suite.',
    skills: ['TypeScript', 'React', 'Next.js', 'Node.js', 'Express', 'PostgreSQL', 'Prisma', 'AWS S3', 'Docker', 'Jest', 'Playwright', 'GitHub Actions'],
    experience: [
      {
        company: 'Personal Project',
        title: 'JobTracker — AI-powered application tracker',
        location: 'Auckland, NZ',
        startDate: '2026-05',
        endDate: null,
        current: true,
        description:
          '• Built a full-stack TypeScript app: Next.js 16, Express 5, PostgreSQL (Prisma 7), AWS S3 presigned uploads\n• Implemented JWT auth from scratch with rotating hashed refresh tokens\n• Designed a provider-swappable LLM layer — swapped Gemini → Groq by editing one file\n• Three-layer test suite (unit, integration on a real DB, Playwright E2E) in GitHub Actions',
      },
      {
        company: 'Shanghai Huiyin',
        title: 'Software Engineer Intern',
        location: 'Shanghai, China',
        startDate: '2025-11',
        endDate: '2026-02',
        current: false,
        description:
          '• Developed internal dashboard features with React and TypeScript\n• Reduced API latency by 40% by introducing Redis caching on hot read paths\n• Wrote integration tests covering the three highest-traffic endpoints',
      },
    ],
    education: [
      { institution: 'University of Auckland', degree: 'BSc', field: 'Computer Science', startYear: 2023, endYear: 2026 },
    ],
    certifications: [{ name: 'AWS Certified Cloud Practitioner', issuer: 'Amazon Web Services', year: 2026 }],
  });

  // ── Seed: applications across the pipeline ────────────────────────────────
  const mk = (data: object) => api(request, token, 'post', '/applications', data);
  const jd =
    'We are looking for a graduate software engineer to join our product team. You will work across the stack with TypeScript, React and Node.js, own features end-to-end, and care about testing and CI. PostgreSQL and AWS experience is a plus; Kubernetes and GraphQL are nice to have.';

  const xero = (await mk({
    companyName: 'Xero', jobTitle: 'Graduate Software Engineer', jobDescription: jd,
    location: 'Auckland, NZ', employmentType: 'GRADUATE', status: 'APPLIED',
    appliedDate: daysAgo(9), jobUrl: 'https://careers.xero.com',
  })).data;
  const datacom = (await mk({
    companyName: 'Datacom', jobTitle: 'Junior Full-Stack Developer', jobDescription: jd,
    location: 'Auckland, NZ', employmentType: 'FULL_TIME', status: 'APPLIED', appliedDate: daysAgo(14),
  })).data;
  const asb = (await mk({
    companyName: 'ASB Bank', jobTitle: 'Technology Graduate', jobDescription: jd,
    location: 'Auckland, NZ', employmentType: 'GRADUATE', status: 'APPLIED', appliedDate: daysAgo(6),
  })).data;
  await mk({
    companyName: 'Windcave', jobTitle: 'Software Engineer', jobDescription: jd,
    location: 'Auckland, NZ', employmentType: 'FULL_TIME', status: 'WISHLIST', isRemote: true,
  });
  await mk({
    companyName: 'Orion Health', jobTitle: 'Junior Backend Engineer', jobDescription: jd,
    location: 'Auckland, NZ', employmentType: 'FULL_TIME', status: 'APPLIED', appliedDate: daysAgo(3),
  });
  const spark = (await mk({
    companyName: 'Spark NZ', jobTitle: 'Graduate Engineer', jobDescription: jd,
    location: 'Wellington, NZ', employmentType: 'GRADUATE', status: 'APPLIED', appliedDate: daysAgo(20),
  })).data;

  // Status transitions → richer funnel, response stats, and activity feed
  await api(request, token, 'patch', `/applications/${datacom.id}/status`, { status: 'INTERVIEW' });
  await api(request, token, 'patch', `/applications/${asb.id}/status`, { status: 'SCREENING' });
  await api(request, token, 'patch', `/applications/${spark.id}/status`, { status: 'REJECTED' });

  // AI artefacts for the flagship application (stubbed Groq answers instantly).
  // Tailored resume first — analyze/cover-letter need a resume source, and the
  // active tailored resume satisfies that.
  await api(request, token, 'post', `/applications/${xero.id}/tailored-resume`);
  await api(request, token, 'post', `/applications/${xero.id}/analyze`);
  await api(request, token, 'post', `/applications/${xero.id}/cover-letter`, {});

  // ── Log in through the UI ─────────────────────────────────────────────────
  // Hide the Next.js dev-mode indicator on every navigation so it doesn't photobomb
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');

  // ── 1. Dashboard ──────────────────────────────────────────────────────────
  await expect(page.getByText('Application Funnel')).toBeVisible();
  await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Status updated').first()).toBeVisible();
  await page.mouse.move(0, 0); // park the cursor so no chart tooltip is open
  await page.waitForTimeout(600); // chart entrance animation
  await page.screenshot({ path: OUT('dashboard.png') });

  // ── 2. Applications list ──────────────────────────────────────────────────
  await page.goto('/applications');
  await expect(page.getByText('Xero')).toBeVisible();
  await expect(page.getByText('6 total')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT('applications.png') });

  // ── 3. AI match analysis on the detail page ───────────────────────────────
  await page.goto(`/applications/${xero.id}`);
  await expect(page.getByText('AI Match Analysis')).toBeVisible();
  await expect(page.getByText('78%')).toBeVisible();
  // Expand the first strength card so the shot shows the interaction
  await page.getByText('Directly relevant full-stack TypeScript experience').click();
  await page.getByText('AI Match Analysis').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT('ai-analysis.png') });

  // ── 4. Tailored resume editor ─────────────────────────────────────────────
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByText('Tailored Resume')).toBeVisible();
  await expect(page.getByText('Software Engineer Intern').first()).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT('tailored-resume.png') });
});
