import { Request, Response } from 'express';
import * as resumeService from '../services/resume.service';

export async function getPresignedUrl(req: Request, res: Response) {
  const { fileName, contentType } = req.body;
  const result = await resumeService.getPresignedUrl(req.user!.userId, fileName, contentType);
  res.status(201).json({ success: true, data: result });
}

export async function confirmUpload(req: Request, res: Response) {
  const resume = await resumeService.confirmUpload(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: resume });
}

export async function listResumes(req: Request, res: Response) {
  const resumes = await resumeService.listResumes(req.user!.userId);
  res.json({ success: true, data: resumes });
}

export async function getResume(req: Request, res: Response) {
  const resume = await resumeService.getResume(req.params['id'] as string, req.user!.userId);
  res.json({ success: true, data: resume });
}

export async function updateResume(req: Request, res: Response) {
  const resume = await resumeService.updateResume(req.params['id'] as string, req.user!.userId, req.body.name);
  res.json({ success: true, data: resume });
}

export async function deleteResume(req: Request, res: Response) {
  await resumeService.deleteResume(req.params['id'] as string, req.user!.userId);
  res.json({ success: true, data: null });
}

export async function updateParsedText(req: Request, res: Response) {
  const result = await resumeService.updateParsedText(req.params['id'] as string, req.user!.userId, req.body.parsedText);
  res.json({ success: true, data: result });
}

export async function setDefault(req: Request, res: Response) {
  const resume = await resumeService.setDefault(req.params['id'] as string, req.user!.userId);
  res.json({ success: true, data: resume });
}
