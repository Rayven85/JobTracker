import { Request, Response } from 'express';
import * as aiService from '../services/ai.service';

export async function updateCoverLetter(req: Request, res: Response) {
  const coverLetter = await aiService.updateCoverLetter(
    req.params['id'] as string,
    req.user!.userId,
    req.body.content
  );
  res.json({ success: true, data: coverLetter });
}

export async function downloadCoverLetter(req: Request, res: Response) {
  const coverLetter = await aiService.getCoverLetter(
    req.params['id'] as string,
    req.user!.userId
  );
  const filename = `cover-letter-${coverLetter.application.companyName.replace(/\s+/g, '-').toLowerCase()}.txt`;
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(coverLetter.content);
}
