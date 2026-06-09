import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/asyncHandler';
import { authRouter } from './auth.routes';

export const router = Router();

router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ success: true, data: { status: 'ok', timestamp: new Date() } });
}));

router.use('/auth', authRouter);
