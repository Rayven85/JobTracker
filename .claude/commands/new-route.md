# New API Route

Create a complete new API route following JobTracker conventions from CLAUDE.md.

Resource name: $ARGUMENTS

## Files to create

Create these four files for the `$ARGUMENTS` resource:

### 1. server/src/validators/$ARGUMENTS.validator.ts
- Import zod
- Export a Zod schema for each operation (create, update, etc.)
- Export the inferred TypeScript type from each schema
- Follow the naming convention: create${PascalCase}Schema, update${PascalCase}Schema

### 2. server/src/services/$ARGUMENTS.service.ts
- Import { prisma } from '../lib/prisma'
- Import { AppError } from '../lib/AppError'
- Implement all CRUD operations as exported async functions
- Every operation that touches a specific resource must verify req.user.userId === resource.userId (throw AppError 403 if mismatch)
- Throw AppError(404, 'RESOURCE_NOT_FOUND', ...) when Prisma returns null
- No Express types (Request, Response) in this file

### 3. server/src/controllers/$ARGUMENTS.controller.ts
- Import asyncHandler from '../middleware/asyncHandler'
- Import the service functions
- Each controller method: extract from req.body/req.params/req.query → call service → res.json({ success: true, data: result })
- For create operations, use status 201: res.status(201).json(...)
- req.user is typed as { userId: string, email: string } (set by auth middleware)

### 4. server/src/routes/$ARGUMENTS.routes.ts
- Import Router from express
- Import authMiddleware from '../middleware/auth'
- Import validate from '../middleware/validate'
- Import the controller methods
- Import the Zod schemas
- Wire up: router.get('/', authMiddleware, controller.list)
- Mount in server/src/routes/index.ts: router.use('/$ARGUMENTS', $ARGUMENTSRouter)

### 5. server/src/tests/$ARGUMENTS.test.ts
- Import supertest and the Express app
- Test: success case returns correct shape
- Test: 401 when no auth token
- Test: 403 when accessing another user's resource
- Test: 404 when resource doesn't exist
- Test: 400 when required fields are missing (for POST routes)

## Checklist after creating files
- [ ] Validator exports both schema and inferred type
- [ ] Service has no Express imports
- [ ] Controller wraps every handler in asyncHandler
- [ ] Route is mounted in the main router index
- [ ] All protected routes have authMiddleware
- [ ] POST/PATCH routes have validate(schema) middleware
- [ ] Tests cover happy path + 401 + 403 + 404 + 400