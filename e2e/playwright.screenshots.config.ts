import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

// Screenshot pipeline — not part of the test suite. Boots the same full stack as the
// E2E config (stubbed Groq, real Postgres), seeds demo data, and captures the README
// screenshots at a crisp 2x scale. Run with: npm run screenshots
export default defineConfig({
  ...baseConfig,
  testDir: './screenshots',
  retries: 0,
  reporter: [['list']],
  use: {
    ...baseConfig.use,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  },
});
