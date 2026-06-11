import { Request, Response } from 'express';
import * as contactService from '../services/contact.service';

export async function createContact(req: Request, res: Response) {
  const contact = await contactService.createContact(
    req.params['id'] as string,
    req.user!.userId,
    req.body
  );
  res.status(201).json({ success: true, data: contact });
}

export async function updateContact(req: Request, res: Response) {
  const contact = await contactService.updateContact(
    req.params['id'] as string,
    req.user!.userId,
    req.body
  );
  res.json({ success: true, data: contact });
}

export async function deleteContact(req: Request, res: Response) {
  await contactService.deleteContact(req.params['id'] as string, req.user!.userId);
  res.json({ success: true, data: null });
}
