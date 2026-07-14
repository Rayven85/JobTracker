import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuthContext } from './AuthContext'

// Regression guard: the session-restore path (refresh cookie → access token → getMe →
// setUser) once silently produced user=undefined because getMe's response shape was
// mis-declared — every request returned 200 yet F5 bounced to /login.

jest.mock('@/lib/api/auth', () => ({
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refreshAccessToken: jest.fn(),
  getMe: jest.fn(),
}))

const { refreshAccessToken, getMe } = jest.requireMock('@/lib/api/auth') as {
  refreshAccessToken: jest.Mock
  getMe: jest.Mock
}

function WhoAmI() {
  const { user, isLoading } = useAuthContext()
  if (isLoading) return <p>loading…</p>
  return <p>{user ? `signed in as ${user.email}` : 'no user'}</p>
}

beforeEach(() => {
  refreshAccessToken.mockReset()
  getMe.mockReset()
})

describe('AuthProvider session restore on mount', () => {
  it('sets the user from getMe after a successful cookie refresh', async () => {
    refreshAccessToken.mockResolvedValueOnce({ accessToken: 'fresh-token' })
    getMe.mockResolvedValueOnce({ id: 'u1', email: 'ray@test.jobtracker', name: 'Ray', avatarUrl: null })

    render(
      <AuthProvider>
        <WhoAmI />
      </AuthProvider>
    )

    await waitFor(() =>
      expect(screen.getByText('signed in as ray@test.jobtracker')).toBeInTheDocument()
    )
    expect(getMe).toHaveBeenCalledWith('fresh-token')
  })

  it('leaves user null when there is no refresh cookie', async () => {
    refreshAccessToken.mockResolvedValueOnce(null)

    render(
      <AuthProvider>
        <WhoAmI />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByText('no user')).toBeInTheDocument())
    expect(getMe).not.toHaveBeenCalled()
  })

  it('leaves user null when getMe fails after refresh', async () => {
    refreshAccessToken.mockResolvedValueOnce({ accessToken: 'fresh-token' })
    getMe.mockRejectedValueOnce(new Error('boom'))

    render(
      <AuthProvider>
        <WhoAmI />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByText('no user')).toBeInTheDocument())
  })
})
