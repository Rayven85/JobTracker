import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AppError } from './AppError';

if (!process.env.JWT_ACCESS_SECRET) throw new Error('JWT_ACCESS_SECRET is required');
if (!process.env.JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET is required');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

export interface AccessTokenPayload {
  userId: string;
  email: string;
}

export function signAccessToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, ACCESS_SECRET, { expiresIn: '15m' });
}

export function signRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    if (typeof decoded === 'string') {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid token payload');
    }
    return decoded as AccessTokenPayload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token');
  }
}
