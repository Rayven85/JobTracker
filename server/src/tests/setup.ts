// Runs before every test file. Sets DATABASE_URL to the test DB before
// prisma.ts is imported so the singleton connects to jobtracker_test, not dev.
import 'dotenv/config';

if (!process.env.DATABASE_TEST_URL) {
  throw new Error('DATABASE_TEST_URL is required for tests');
}
process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
process.env.NODE_ENV = 'test';
