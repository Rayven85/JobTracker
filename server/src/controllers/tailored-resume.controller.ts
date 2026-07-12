import { Request, Response } from 'express';
import * as aiService from '../services/ai.service';
import type { ExtractedProfile } from '../services/ai.service';

export async function updateTailoredResume(req: Request, res: Response) {
  const tailoredResume = await aiService.updateTailoredResume(
    req.params['id'] as string,
    req.user!.userId,
    req.body as ExtractedProfile
  );
  res.json({ success: true, data: tailoredResume });
}
