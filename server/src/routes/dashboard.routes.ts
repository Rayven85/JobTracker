import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import * as dashboardController from '../controllers/dashboard.controller';

export const dashboardRouter = Router();

dashboardRouter.use(authMiddleware);

dashboardRouter.get('/stats', asyncHandler(dashboardController.getStats));
dashboardRouter.get('/recent', asyncHandler(dashboardController.getRecentActivity));
