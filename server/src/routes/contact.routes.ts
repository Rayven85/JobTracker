import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { updateContactSchema } from '../validators/contact.validator';
import * as contactController from '../controllers/contact.controller';

export const contactRouter = Router();

contactRouter.use(authMiddleware);

contactRouter.patch('/:id', validate(updateContactSchema), asyncHandler(contactController.updateContact));
contactRouter.delete('/:id', asyncHandler(contactController.deleteContact));
