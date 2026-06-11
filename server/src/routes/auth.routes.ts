import { Router, Request, Response } from 'express';
import { passport } from '../lib/passport';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema } from '../validators/auth.validator';
import * as authController from '../controllers/auth.controller';
import * as authService from '../services/auth.service';

export const authRouter = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

authRouter.post('/register', validate(registerSchema), asyncHandler(authController.register));
authRouter.post('/login', validate(loginSchema), asyncHandler(authController.login));
authRouter.post('/refresh', asyncHandler(authController.refresh));
authRouter.post('/logout', asyncHandler(authController.logout));
authRouter.get('/me', authMiddleware, asyncHandler(authController.me));

// Google OAuth — session:false because we issue our own JWT
authRouter.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

authRouter.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login` }),
  asyncHandler(async (req: Request, res: Response) => {
    // req.user = { userId, email } — normalised in the GoogleStrategy
    const { accessToken, refreshToken } = await authService.loginWithGoogle(
      req.user!.userId,
      req.user!.email
    );
    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${accessToken}`);
  })
);
