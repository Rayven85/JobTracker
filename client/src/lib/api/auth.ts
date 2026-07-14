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

export async function refreshAccessToken(): Promise<{ accessToken: string } | null> {
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
