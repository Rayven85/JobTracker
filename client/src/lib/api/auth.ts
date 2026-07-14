import { AuthResponse, User } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Login failed')
  return json.data as AuthResponse
}

export async function register(
  email: string,
  password: string,
  name: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, name }),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Registration failed')
  return json.data as AuthResponse
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/api/v1/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
}

// Single-flight: refresh tokens rotate on use, so two concurrent refreshes with the
// same cookie make the loser 401. Concurrent callers share one in-flight request.
let refreshInFlight: Promise<{ accessToken: string } | null> | null = null

export function refreshAccessToken(): Promise<{ accessToken: string } | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

async function doRefresh(): Promise<{ accessToken: string } | null> {
  const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.success ? (json.data as { accessToken: string }) : null
}

// The API returns the user object directly in `data` — not wrapped in `{ user }`.
export async function getMe(accessToken: string): Promise<User> {
  const res = await fetch(`${API_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch user')
  return json.data as User
}
