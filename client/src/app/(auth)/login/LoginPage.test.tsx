import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from './page'

// Mock useAuth — factory only references jest globals (no TDZ risk)
jest.mock('@/hooks/use-auth', () => ({ useAuth: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
const mockUseAuth = useAuth as jest.Mock
const mockUseRouter = useRouter as jest.Mock

let mockLogin: jest.Mock
let mockPush: jest.Mock

beforeEach(() => {
  mockLogin = jest.fn()
  mockPush = jest.fn()
  mockUseAuth.mockReturnValue({ login: mockLogin, user: null, isLoading: false })
  mockUseRouter.mockReturnValue({ push: mockPush })
})

// ─── Renders ──────────────────────────────────────────────────────────────────

describe('LoginPage', () => {
  it('renders email, password inputs and submit button', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  // ─── Validation errors ───────────────────────────────────────────────────────

  it('shows error when email is empty', async () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/email is required/i)
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('shows error when password is empty', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/password is required/i)

    expect(mockLogin).not.toHaveBeenCalled()
  })

  // ─── API error state ─────────────────────────────────────────────────────────

  it('shows API error message when login fails', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'))
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.type(screen.getByLabelText(/email/i), 'bad@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'wrongpass')
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid credentials/i)
  })

  // ─── Loading state ───────────────────────────────────────────────────────────

  it('disables the submit button while loading', async () => {
    mockLogin.mockImplementation(() => new Promise(() => {})) // never resolves
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'password123')
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
    })
  })

  // ─── Success ─────────────────────────────────────────────────────────────────

  it('redirects to /dashboard on successful login', async () => {
    mockLogin.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'password123')
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'))
  })
})
