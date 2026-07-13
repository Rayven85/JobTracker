// Single source of truth for the refresh-token cookie (used by auth controller + OAuth route).
// sameSite 'lax' is safe because the client proxies /api/* through its own origin
// (Next.js rewrites), so this cookie is always first-party.
export const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
