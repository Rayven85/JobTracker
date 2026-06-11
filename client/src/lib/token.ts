// Access token lives in module memory — cleared on page refresh.
// Session is restored from the HttpOnly refresh token cookie on mount.
let _accessToken: string | null = null

export function getAccessToken(): string | null {
  return _accessToken
}

export function setAccessToken(token: string): void {
  _accessToken = token
}

export function clearAccessToken(): void {
  _accessToken = null
}
