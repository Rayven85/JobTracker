import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { REFRESH_COOKIE_OPTS as COOKIE_OPTS } from '../lib/cookies';

export async function register(req: Request, res: Response) {
  const { email, password, name } = req.body;
  const { accessToken, refreshToken, user } = await authService.register(email, password, name);
  res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
  res.status(201).json({ success: true, data: { accessToken, user } });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const { accessToken, refreshToken, user } = await authService.login(email, password);
  res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
  res.json({ success: true, data: { accessToken, user } });
}

export async function refresh(req: Request, res: Response) {
  const { accessToken, refreshToken } = await authService.refresh(req.cookies.refreshToken);
  res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
  res.json({ success: true, data: { accessToken } });
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.cookies.refreshToken);
  res.clearCookie('refreshToken');
  res.json({ success: true, data: null });
}

export async function me(req: Request, res: Response) {
  const user = await authService.getMe(req.user!.userId);
  res.json({ success: true, data: user });
}
