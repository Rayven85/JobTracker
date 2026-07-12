import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { updateTailoredResumeSchema } from '../validators/tailored-resume.validator';
import * as tailoredResumeController from '../controllers/tailored-resume.controller';

export const tailoredResumeRouter = Router();

tailoredResumeRouter.use(authMiddleware);

tailoredResumeRouter.patch('/:id', validate(updateTailoredResumeSchema), asyncHandler(tailoredResumeController.updateTailoredResume));
