import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/AppError';

export const validate = (schema: z.ZodType) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join(', ');
      next(new AppError(400, 'VALIDATION_ERROR', message));
      return;
    }
    req.body = result.data;
    next();
  };
