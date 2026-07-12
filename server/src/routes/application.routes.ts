import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { createApplicationSchema, updateApplicationSchema, updateStatusSchema } from '../validators/application.validator';
import { createContactSchema } from '../validators/contact.validator';
import { coverLetterRequestSchema } from '../validators/cover-letter.validator';
import * as applicationController from '../controllers/application.controller';
import * as contactController from '../controllers/contact.controller';

export const applicationRouter = Router();

applicationRouter.use(authMiddleware);

applicationRouter.get('/', asyncHandler(applicationController.listApplications));
applicationRouter.post('/', validate(createApplicationSchema), asyncHandler(applicationController.createApplication));

applicationRouter.get('/:id', asyncHandler(applicationController.getApplication));
applicationRouter.patch('/:id', validate(updateApplicationSchema), asyncHandler(applicationController.updateApplication));
applicationRouter.patch('/:id/status', validate(updateStatusSchema), asyncHandler(applicationController.updateStatus));
applicationRouter.delete('/:id', asyncHandler(applicationController.deleteApplication));

applicationRouter.get('/:id/events', asyncHandler(applicationController.getEvents));

applicationRouter.post('/:id/tags/:tagId', asyncHandler(applicationController.addTag));
applicationRouter.delete('/:id/tags/:tagId', asyncHandler(applicationController.removeTag));

applicationRouter.post('/:id/contacts', validate(createContactSchema), asyncHandler(contactController.createContact));

applicationRouter.post('/:id/analyze', asyncHandler(applicationController.analyzeApplication));
applicationRouter.post('/:id/cover-letter', validate(coverLetterRequestSchema), asyncHandler(applicationController.generateCoverLetter));
applicationRouter.post('/:id/interview-prep', asyncHandler(applicationController.generateInterviewQuestions));
applicationRouter.post('/:id/tailored-resume', asyncHandler(applicationController.generateTailoredResume));
