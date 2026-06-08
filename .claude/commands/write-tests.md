# Write Tests

Write comprehensive tests for an existing file. Target file: $ARGUMENTS

## Instructions

Read the target file at $ARGUMENTS.
Identify all exported functions/methods and their behaviors.
Write tests covering:

### For server service files (*.service.ts):
- Happy path for every public method
- Not found case (when Prisma returns null → should throw AppError 404)
- Authorization case (wrong userId → should throw AppError 403)
- Validation edge cases (empty strings, nulls, boundary values)
- Any method that calls an external service (Claude, S3): mock the module

### For server controller/route files — use Supertest:
- 200/201 on success with correct response shape { success: true, data: { ... } }
- 401 when Authorization header is missing
- 401 when token is expired or invalid
- 400 when required body fields are missing
- 404 when resource doesn't exist
- 403 when authenticated user tries to access another user's resource

### For client component files (*.tsx):
- Renders without crashing
- Shows loading state while fetching
- Shows error message when API returns error
- Shows success state after successful action
- Form validation messages appear for invalid inputs
- Submit button is disabled while request is in flight

## Test file location
- Server: server/src/tests/{filename}.test.ts
- Client: co-located {filename}.test.tsx next to the source file

## Setup pattern for server tests
```typescript
import request from 'supertest';
import { app } from '../index';
import { prisma } from '../lib/prisma';

// Create a test user and get an access token before each test
let testUser: { id: string; email: string };
let accessToken: string;

beforeAll(async () => {
  // Create user directly via Prisma for test isolation
  testUser = await prisma.user.create({ ... });
  // Sign a token directly (don't go through the register endpoint)
  accessToken = signAccessToken(testUser.id, testUser.email);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@test.jobtracker' } } });
  await prisma.$disconnect();
});
```

## Mocking Claude and S3
```typescript
jest.mock('../lib/claude', () => ({
  anthropic: {
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ text: JSON.stringify({ score: 75, matched: ['TypeScript'], missing: [], suggestions: [] }) }]
      })
    }
  }
}));
```