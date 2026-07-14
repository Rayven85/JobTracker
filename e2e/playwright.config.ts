import { defineConfig } from '@playwright/test';
import path from 'path';

// E2E runs the real stack — Next.js client (:3000, proxying /api/* to the server),
// Express API (:4000), and a stubbed Groq endpoint (:4010) — against a real Postgres DB.
// Only the LLM is faked, so these tests exercise the same auth/cookie/proxy path that
// produced the production login bugs.
const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  'postgresql://jobtracker:password@localhost:5432/jobtracker_test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  // One worker: suites share a DB and the client dev server; parallelism buys little here.
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node mock-groq.mjs',
      cwd: __dirname,
      port: 4010,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev',
      cwd: path.join(__dirname, '..', 'server'),
      port: 4000,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        JWT_ACCESS_SECRET: 'e2e-access-secret',
        JWT_REFRESH_SECRET: 'e2e-refresh-secret',
        GROQ_API_KEY: 'e2e-dummy-key',
        GROQ_BASE_URL: 'http://localhost:4010',
        AWS_REGION: 'ap-southeast-2',
        AWS_ACCESS_KEY_ID: 'e2e-dummy-key-id',
        AWS_SECRET_ACCESS_KEY: 'e2e-dummy-secret',
        S3_BUCKET_NAME: 'jobtracker-resumes-e2e',
        GOOGLE_CLIENT_ID: 'e2e-dummy-client-id',
        GOOGLE_CLIENT_SECRET: 'e2e-dummy-client-secret',
        CLIENT_URL: 'http://localhost:3000',
        SERVER_URL: 'http://localhost:4000',
        PORT: '4000',
        // NOT 'test' — the app skips app.listen() under NODE_ENV=test.
        NODE_ENV: 'development',
        // The dev server persists across local runs (reuseExistingServer), so repeated
        // registers would exhaust the auth rate-limit window mid-iteration.
        DISABLE_RATE_LIMIT: '1',
      },
    },
    {
      command: 'npm run dev',
      cwd: path.join(__dirname, '..', 'client'),
      port: 3000,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
