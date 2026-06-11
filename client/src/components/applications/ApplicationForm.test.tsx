import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ApplicationForm } from './ApplicationForm'

const noop = jest.fn()

describe('ApplicationForm', () => {
  beforeEach(() => {
    noop.mockReset()
  })

  it('renders required fields', () => {
    render(<ApplicationForm onSubmit={noop} onClose={noop} />)
    expect(screen.getByPlaceholderText('Xero')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Senior Engineer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add application/i })).toBeInTheDocument()
  })

  it('shows error when company name is empty on submit', async () => {
    render(<ApplicationForm onSubmit={noop} onClose={noop} />)
    fireEvent.click(screen.getByRole('button', { name: /add application/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Company name is required')
    })
    expect(noop).not.toHaveBeenCalled()
  })

  it('shows error when job title is empty on submit', async () => {
    render(<ApplicationForm onSubmit={noop} onClose={noop} />)
    fireEvent.change(screen.getByPlaceholderText('Xero'), { target: { value: 'Xero' } })
    fireEvent.click(screen.getByRole('button', { name: /add application/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Job title is required')
    })
    expect(noop).not.toHaveBeenCalled()
  })

  it('calls onSubmit with form data when fields are valid', async () => {
    noop.mockResolvedValueOnce(undefined)
    const onClose = jest.fn()
    render(<ApplicationForm onSubmit={noop} onClose={onClose} />)
    fireEvent.change(screen.getByPlaceholderText('Xero'), { target: { value: 'Xero' } })
    fireEvent.change(screen.getByPlaceholderText('Senior Engineer'), { target: { value: 'Engineer' } })
    fireEvent.click(screen.getByRole('button', { name: /add application/i }))
    await waitFor(() => {
      expect(noop).toHaveBeenCalledTimes(1)
      expect(noop.mock.calls[0][0]).toMatchObject({ companyName: 'Xero', jobTitle: 'Engineer' })
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows API error message when onSubmit rejects', async () => {
    noop.mockRejectedValueOnce(new Error('Server error'))
    render(<ApplicationForm onSubmit={noop} onClose={jest.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('Xero'), { target: { value: 'Xero' } })
    fireEvent.change(screen.getByPlaceholderText('Senior Engineer'), { target: { value: 'Engineer' } })
    fireEvent.click(screen.getByRole('button', { name: /add application/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error')
    })
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn()
    render(<ApplicationForm onSubmit={noop} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
