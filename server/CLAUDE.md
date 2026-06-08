# Server — Express.js API (port 4000)

See root CLAUDE.md for full layer rules, API contract, auth system, S3 flow, and Claude integration.
This file covers server-specific patterns only.

---

## Middleware Order on Protected Routes

```
router.post('/path', authMiddleware, validate(schema), asyncHandler(controller.method))
```

Always: auth → validate → asyncHandler(controller). Never swap this order.

---

## Prisma Patterns

```typescript
// Always check ownership before returning data
const record = await prisma.application.findUnique({ where: { id } });
if (!record) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
if (record.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');
```

For list queries, always filter by userId — never fetch all rows then filter in JS:
```typescript
// Correct
await prisma.application.findMany({ where: { userId } })
// Wrong
const all = await prisma.application.findMany(); all.filter(a => a.userId === userId)
```

---

## Test Setup Pattern

```typescript
// server/src/tests/resource.test.ts
import request from 'supertest';
import { app } from '../index';
import { prisma } from '../lib/prisma';
import { signAccessToken } from '../lib/tokens';

let userId: string;
let token: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: 'resource@test.jobtracker', name: 'Test User', password: 'hashed' }
  });
  userId = user.id;
  token = signAccessToken(userId, user.email);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: '@test.jobtracker' } } });
  await prisma.$disconnect();
});
```

Use `@test.jobtracker` email suffix consistently — makes cleanup safe and predictable.

---

## Adding a New Resource

Run `/new-route <resource-name>` to scaffold all four files at once.
After scaffolding, mount in `server/src/routes/index.ts`.
Then add the new paths to the structure map in root CLAUDE.md.
