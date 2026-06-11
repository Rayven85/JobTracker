import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { presignedUrlSchema, confirmUploadSchema, updateResumeSchema } from '../validators/resume.validator';
import * as resumeController from '../controllers/resume.controller';

export const resumeRouter = Router();

resumeRouter.use(authMiddleware);

resumeRouter.get('/', asyncHandler(resumeController.listResumes));
resumeRouter.post('/presigned-url', validate(presignedUrlSchema), asyncHandler(resumeController.getPresignedUrl));
resumeRouter.post('/confirm', validate(confirmUploadSchema), asyncHandler(resumeController.confirmUpload));
resumeRouter.get('/:id', asyncHandler(resumeController.getResume));
resumeRouter.patch('/:id', validate(updateResumeSchema), asyncHandler(resumeController.updateResume));
resumeRouter.delete('/:id', asyncHandler(resumeController.deleteResume));
resumeRouter.post('/:id/set-default', asyncHandler(resumeController.setDefault));
