import { APIRequestContext, Page, expect } from '@playwright/test';

// The API is called directly (not through the Next proxy) for test setup only —
// assertions always go through the browser + proxy like a real user.
const API = 'http://localhost:4000/api/v1';

export const PASSWORD = 'E2ePassword123!';

export function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@test.jobtracker`;
}

export async function registerViaApi(
  request: APIRequestContext,
  email: string
): Promise<string> {
  const res = await request.post(`${API}/auth/register`, {
    data: { email, password: PASSWORD, name: 'E2E Tester' },
  });
  expect(res.status(), 'register should return 201').toBe(201);
  const json = await res.json();
  return json.data.accessToken as string;
}

// Seeds a master profile so "Generate from profile" has real content to tailor.
export async function seedProfile(request: APIRequestContext, token: string): Promise<void> {
  const res = await request.patch(`${API}/profile`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: 'E2E Candidate',
      summary: 'Full-stack developer with TypeScript and React experience.',
      skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
      experience: [
        {
          company: 'Acme Corp',
          title: 'Software Engineer Intern',
          current: false,
          description: '• Built an internal tracking tool with TypeScript and React',
        },
      ],
      education: [
        { institution: 'University of Auckland', degree: 'BSc', field: 'Computer Science' },
      ],
    },
  });
  expect(res.ok(), 'profile seed should succeed').toBeTruthy();
}

export async function loginViaUi(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
}
