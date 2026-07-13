import { Router, Request, Response } from 'express';
import { passport } from '../lib/passport';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authLimiter, refreshLimiter } from '../middleware/rateLimit';
import { registerSchema, loginSchema } from '../validators/auth.validator';
import * as authController from '../controllers/auth.controller';
import * as authService from '../services/auth.service';
import { REFRESH_COOKIE_OPTS } from '../lib/cookies';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validate(registerSchema), asyncHandler(authController.register));
authRouter.post('/login', authLimiter, validate(loginSchema), asyncHandler(authController.login));
authRouter.post('/refresh', refreshLimiter, asyncHandler(authController.refresh));
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
    // Set only the refresh cookie and redirect with a clean URL — no token in the
    // query string (URLs leak into history/logs). The client callback page exchanges
    // the cookie for an access token via POST /auth/refresh.
    const { refreshToken } = await authService.loginWithGoogle(
      req.user!.userId,
      req.user!.email
    );
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);
    res.redirect(`${process.env.CLIENT_URL}/auth/callback`);
  })
);
