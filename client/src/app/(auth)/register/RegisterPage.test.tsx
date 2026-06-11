import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegisterPage from './page'

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

let mockRegister: jest.Mock
let mockPush: jest.Mock

beforeEach(() => {
  mockRegister = jest.fn()
  mockPush = jest.fn()
  mockUseAuth.mockReturnValue({ register: mockRegister, user: null, isLoading: false })
  mockUseRouter.mockReturnValue({ push: mockPush })
})

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  opts: { name?: string; email?: string; password?: string; confirm?: string } = {}
) {
  const { name = 'Test User', email = 'test@example.com', password = 'password123', confirm = 'password123' } = opts
  if (name) await user.type(screen.getByLabelText(/^name/i), name)
  if (email) await user.type(screen.getByLabelText(/email/i), email)
  if (password) await user.type(screen.getByLabelText(/^password/i), password)
  if (confirm) await user.type(screen.getByLabelText(/confirm password/i), confirm)
}

// ─── Renders ──────────────────────────────────────────────────────────────────

describe('RegisterPage', () => {
  it('renders name, email, password, confirm password inputs and submit button', () => {
    render(<RegisterPage />)
    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  // ─── Validation errors ───────────────────────────────────────────────────────

  it('shows error when name is empty', async () => {
    render(<RegisterPage />)
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/name is required/i)
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('shows error when password is shorter than 8 characters', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)
    await fillForm(user, { password: 'short', confirm: 'short' })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8 characters/i)
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)
    await fillForm(user, { password: 'password123', confirm: 'different99' })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/passwords do not match/i)
    expect(mockRegister).not.toHaveBeenCalled()
  })

  // ─── API error state ─────────────────────────────────────────────────────────

  it('shows API error when email is already taken', async () => {
    mockRegister.mockRejectedValueOnce(new Error('Email already in use'))
    const user = userEvent.setup()
    render(<RegisterPage />)
    await fillForm(user)
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/email already in use/i)
  })

  // ─── Loading state ───────────────────────────────────────────────────────────

  it('disables the submit button while loading', async () => {
    mockRegister.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    render(<RegisterPage />)
    await fillForm(user)
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled()
    })
  })

  // ─── Success ─────────────────────────────────────────────────────────────────

  it('redirects to /dashboard on successful registration', async () => {
    mockRegister.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    render(<RegisterPage />)
    await fillForm(user)
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'))
  })
})
