import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/AppError';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  const isDev = process.env.NODE_ENV === 'development';
  const message = err instanceof Error ? err.message : 'Internal server error';

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
      ...(isDev && err instanceof Error ? { stack: err.stack } : {}),
    },
  });
}
