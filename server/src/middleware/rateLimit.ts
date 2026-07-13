import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// 429 body must follow the standard API error contract.
function handler(_req: Request, res: Response): void {
  res.status(429).json({
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Please try again later.' },
  });
}

// Skipped in tests so Supertest suites can hit auth endpoints freely.
const skip = () => process.env.NODE_ENV === 'test';

// Credential endpoints (login/register) — tight window against brute force.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  handler,
});

// Refresh fires on every page load, so it needs far more headroom.
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  handler,
});
