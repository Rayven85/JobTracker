import { Request, Response } from 'express';
import * as dashboardService from '../services/dashboard.service';

export async function getStats(req: Request, res: Response) {
  const stats = await dashboardService.getStats(req.user!.userId);
  res.json({ success: true, data: stats });
}

export async function getRecentActivity(req: Request, res: Response) {
  const activity = await dashboardService.getRecentActivity(req.user!.userId);
  res.json({ success: true, data: activity });
}
