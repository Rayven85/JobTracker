import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/asyncHandler';
import { authRouter } from './auth.routes';
import { resumeRouter } from './resume.routes';
import { applicationRouter } from './application.routes';
import { contactRouter } from './contact.routes';
import { tagRouter } from './tag.routes';
import { coverLetterRouter } from './cover-letter.routes';
import { dashboardRouter } from './dashboard.routes';
import { profileRouter } from './profile.routes';

export const router = Router();

router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ success: true, data: { status: 'ok', timestamp: new Date() } });
}));

router.use('/auth', authRouter);
router.use('/resumes', resumeRouter);
router.use('/applications', applicationRouter);
router.use('/contacts', contactRouter);
router.use('/tags', tagRouter);
router.use('/cover-letters', coverLetterRouter);
router.use('/dashboard', dashboardRouter);
router.use('/profile', profileRouter);
