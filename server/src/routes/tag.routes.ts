import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { createTagSchema } from '../validators/tag.validator';
import * as tagController from '../controllers/tag.controller';

export const tagRouter = Router();

tagRouter.use(authMiddleware);

tagRouter.get('/', asyncHandler(tagController.listTags));
tagRouter.post('/', validate(createTagSchema), asyncHandler(tagController.createTag));
tagRouter.delete('/:id', asyncHandler(tagController.deleteTag));
