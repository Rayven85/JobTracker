import { Request, Response } from 'express';
import * as applicationService from '../services/application.service';

export async function listApplications(req: Request, res: Response) {
  const { status, search, page, limit } = req.query;
  const result = await applicationService.listApplications(req.user!.userId, {
    status: status as string | undefined,
    search: search as string | undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json({ success: true, data: result });
}

export async function createApplication(req: Request, res: Response) {
  const application = await applicationService.createApplication(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: application });
}

export async function getApplication(req: Request, res: Response) {
  const application = await applicationService.getApplication(
    req.params['id'] as string,
    req.user!.userId
  );
  res.json({ success: true, data: application });
}

export async function updateApplication(req: Request, res: Response) {
  const application = await applicationService.updateApplication(
    req.params['id'] as string,
    req.user!.userId,
    req.body
  );
  res.json({ success: true, data: application });
}

export async function updateStatus(req: Request, res: Response) {
  const application = await applicationService.updateStatus(
    req.params['id'] as string,
    req.user!.userId,
    req.body
  );
  res.json({ success: true, data: application });
}

export async function deleteApplication(req: Request, res: Response) {
  await applicationService.deleteApplication(req.params['id'] as string, req.user!.userId);
  res.json({ success: true, data: null });
}

export async function getEvents(req: Request, res: Response) {
  const events = await applicationService.getEvents(
    req.params['id'] as string,
    req.user!.userId
  );
  res.json({ success: true, data: events });
}

export async function addTag(req: Request, res: Response) {
  await applicationService.addTag(
    req.params['id'] as string,
    req.user!.userId,
    req.params['tagId'] as string
  );
  res.json({ success: true, data: null });
}

export async function removeTag(req: Request, res: Response) {
  await applicationService.removeTag(
    req.params['id'] as string,
    req.user!.userId,
    req.params['tagId'] as string
  );
  res.json({ success: true, data: null });
}
