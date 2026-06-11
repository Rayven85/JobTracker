import { Request, Response } from 'express';
import * as tagService from '../services/tag.service';

export async function listTags(req: Request, res: Response) {
  const tags = await tagService.listTags(req.user!.userId);
  res.json({ success: true, data: tags });
}

export async function createTag(req: Request, res: Response) {
  const tag = await tagService.createTag(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: tag });
}

export async function deleteTag(req: Request, res: Response) {
  await tagService.deleteTag(req.params['id'] as string, req.user!.userId);
  res.json({ success: true, data: null });
}
