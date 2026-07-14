import { refreshAccessToken } from './auth'

// Refresh tokens rotate server-side on every use, so two concurrent refresh calls with
// the same cookie make the loser 401 (this bounced Google OAuth logins to /login).
// Concurrent callers must share a single in-flight request.
describe('refreshAccessToken single-flight', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('shares one request between concurrent callers', async () => {
    let resolveFetch!: (value: unknown) => void
    const fetchMock = jest.fn().mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve })
    )
    global.fetch = fetchMock as unknown as typeof fetch

    const first = refreshAccessToken()
    const second = refreshAccessToken()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveFetch({
      ok: true,
      json: async () => ({ success: true, data: { accessToken: 'tok' } }),
    })
    await expect(first).resolves.toEqual({ accessToken: 'tok' })
    await expect(second).resolves.toEqual({ accessToken: 'tok' })
  })

  it('issues a fresh request once the previous one has settled', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false })
    global.fetch = fetchMock as unknown as typeof fetch

    await refreshAccessToken()
    await refreshAccessToken()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
