import { Request, Response } from 'express';
import * as profileService from '../services/profile.service';

export async function getProfile(req: Request, res: Response) {
  const profile = await profileService.getProfile(req.user!.userId);
  res.json({ success: true, data: profile });
}

export async function updateProfile(req: Request, res: Response) {
  const profile = await profileService.updateProfile(req.user!.userId, req.body);
  res.json({ success: true, data: profile });
}

export async function syncResume(req: Request, res: Response) {
  const profile = await profileService.syncResume(req.user!.userId, req.params['resumeId'] as string, req.body);
  res.json({ success: true, data: profile });
}

export async function buildProfile(req: Request, res: Response) {
  const profile = await profileService.buildProfileFromResumes(req.user!.userId);
  res.json({ success: true, data: profile });
}

export async function dismissResumeSuggestions(req: Request, res: Response) {
  await profileService.dismissResumeSuggestions(req.user!.userId, req.params['resumeId'] as string);
  res.json({ success: true, data: null });
}
