import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { updateCoverLetterSchema } from '../validators/cover-letter.validator';
import * as coverLetterController from '../controllers/cover-letter.controller';

export const coverLetterRouter = Router();

coverLetterRouter.use(authMiddleware);

coverLetterRouter.patch('/:id', validate(updateCoverLetterSchema), asyncHandler(coverLetterController.updateCoverLetter));
coverLetterRouter.get('/:id/download', asyncHandler(coverLetterController.downloadCoverLetter));
