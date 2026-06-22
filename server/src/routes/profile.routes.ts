import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { updateProfileSchema, syncResumeSchema } from '../validators/profile.validator';
import * as profileController from '../controllers/profile.controller';

export const profileRouter = Router();

profileRouter.use(authMiddleware);

profileRouter.get('/', asyncHandler(profileController.getProfile));
profileRouter.post('/build', asyncHandler(profileController.buildProfile));
profileRouter.patch('/', validate(updateProfileSchema), asyncHandler(profileController.updateProfile));
profileRouter.post('/sync-plan/:resumeId', asyncHandler(profileController.getSyncPlan));
profileRouter.post('/sync/:resumeId', validate(syncResumeSchema), asyncHandler(profileController.syncResume));
profileRouter.delete('/sync/:resumeId', asyncHandler(profileController.dismissResumeSuggestions));
