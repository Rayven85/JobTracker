import { getAccessToken, setAccessToken, clearAccessToken } from '@/lib/token'
import { refreshAccessToken } from '@/lib/api/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

// Delegates to the single-flight refresh in lib/api/auth — refresh tokens rotate on
// use, so concurrent refreshes must share one request or the loser gets 401'd.
async function tryRefresh(): Promise<string | null> {
  const data = await refreshAccessToken()
  return data?.accessToken ?? null
}

// Base fetch that attaches the Bearer token, retries once on 401 via refresh cookie.
// On second 401, clears the token and redirects to /login.
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken()

  const makeHeaders = (t: string | null): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  })

  let res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: makeHeaders(token),
    credentials: 'include',
  })

  if (res.status === 401) {
    const newToken = await tryRefresh()
    if (newToken) {
      setAccessToken(newToken)
      res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: makeHeaders(newToken),
        credentials: 'include',
      })
    } else {
      clearAccessToken()
      if (typeof window !== 'undefined') window.location.href = '/login'
    }
  }

  return res
}
