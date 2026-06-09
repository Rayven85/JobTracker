import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/AppError';
import { signAccessToken, signRefreshToken, hashToken } from '../lib/tokens';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function issueTokenPair(userId: string, email: string) {
  const accessToken = signAccessToken(userId, email);
  const rawRefreshToken = signRefreshToken();
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(rawRefreshToken),
      userId,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  return { accessToken, rawRefreshToken };
}

export async function register(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, 'EMAIL_TAKEN', 'Email already in use');

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, password: hashed, name },
    select: { id: true, email: true, name: true, avatarUrl: true },
  });

  const { accessToken, rawRefreshToken } = await issueTokenPair(user.id, user.email);
  return { accessToken, refreshToken: rawRefreshToken, user };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.password) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

  const { accessToken, rawRefreshToken } = await issueTokenPair(user.id, user.email);
  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
  };
}

export async function refresh(cookieToken: string | undefined) {
  if (!cookieToken) throw new AppError(401, 'UNAUTHORIZED', 'No refresh token');

  const tokenHash = hashToken(cookieToken);
  const stored = await prisma.refreshToken.findFirst({ where: { tokenHash } });

  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw new AppError(401, 'INVALID_TOKEN', 'Refresh token invalid or expired');
  }

  // Revoke old token (rotation)
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) throw new AppError(401, 'INVALID_TOKEN', 'User not found');

  const { accessToken, rawRefreshToken } = await issueTokenPair(user.id, user.email);
  return { accessToken, refreshToken: rawRefreshToken };
}

export async function logout(cookieToken: string | undefined) {
  if (!cookieToken) return;
  const tokenHash = hashToken(cookieToken);
  await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, avatarUrl: true },
  });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  return user;
}
