import { test, expect } from '@playwright/test';
import { uniqueEmail, registerViaApi, seedProfile, loginViaUi } from './helpers';

// The flagship flow, end to end in a real browser: sign in → create an application
// with a job description → generate a profile-tailored resume (stubbed LLM) →
// download it as a client-rendered PDF. Setup (register + profile seed) goes through
// the API; everything asserted happens through the UI and the same-origin proxy.
test('golden path: application → tailored resume → PDF download', async ({ page, request }) => {
  const email = uniqueEmail('golden');
  const token = await registerViaApi(request, email);
  await seedProfile(request, token);

  await loginViaUi(page, email);

  // Create an application with a pasted JD
  await page.goto('/applications');
  await page.getByRole('button', { name: 'New Application' }).click();
  await page.getByPlaceholder('Xero').fill('Acme Corp');
  await page.getByPlaceholder('Senior Engineer').fill('Graduate Software Engineer');
  await page
    .getByPlaceholder('Paste the job description here for AI analysis…')
    .fill('We are hiring a graduate engineer: TypeScript, React, Node.js and PostgreSQL. Playwright experience is a plus.');
  // Two "Add Application" buttons exist while the modal is open (empty-state CTA +
  // modal submit); the modal renders last in the DOM.
  await page.getByRole('button', { name: 'Add Application' }).last().click();
  await expect(page.getByText('Application added')).toBeVisible();

  // Open the detail page
  await page.getByRole('link', { name: /Acme Corp/ }).click();
  await page.waitForURL(/\/applications\/[0-9a-f-]+/);

  // Resume tab → generate a tailored resume from the profile (mock Groq responds)
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Generate from profile' }).click();
  await expect(page.getByText('Tailored resume generated!')).toBeVisible({ timeout: 20_000 });

  // The structured editor renders the tailored content
  await expect(page.getByText('Software Engineer Intern').first()).toBeVisible();

  // Download the PDF — rendered client-side with @react-pdf/renderer
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^resume-.+\.pdf$/);
});
