import { test, expect } from '@playwright/test';
import { uniqueEmail, registerViaApi, loginViaUi } from './helpers';

// Regression for the production auth saga (three stacked bugs, one symptom):
// a page refresh must restore the session from the HttpOnly refresh cookie via the
// same-origin proxy — not bounce the user to /login.
test('session survives a page refresh', async ({ page, request }) => {
  const email = uniqueEmail('session');
  await registerViaApi(request, email);

  await loginViaUi(page, email);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(/Welcome back/)).toBeVisible();

  await page.reload();

  // AuthProvider shows a loader, then either restores the user or the dashboard
  // guard redirects to /login — the bug this test pins down.
  await expect(page.getByText(/Welcome back/)).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/dashboard/);
});

test('unauthenticated visitors are sent to /login', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForURL('**/login');
});
