import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'
import type { ApplicationStatus } from '@/types'

const cases: Array<[ApplicationStatus, string, string]> = [
  ['WISHLIST',  'Wishlist',  'bg-slate-100'],
  ['APPLIED',   'Applied',   'bg-blue-100'],
  ['SCREENING', 'Screening', 'bg-amber-100'],
  ['INTERVIEW', 'Interview', 'bg-violet-100'],
  ['OFFER',     'Offer',     'bg-emerald-100'],
  ['REJECTED',  'Rejected',  'bg-rose-100'],
  ['WITHDRAWN', 'Withdrawn', 'bg-gray-100'],
]

describe('StatusBadge', () => {
  test.each(cases)('%s renders label "%s" with correct background', (status, label, bgClass) => {
    render(<StatusBadge status={status} />)
    const badge = screen.getByText(label)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass(bgClass)
  })

  it('renders with sm size', () => {
    render(<StatusBadge status="APPLIED" size="sm" />)
    expect(screen.getByText('Applied')).toHaveClass('text-xs', 'px-2', 'py-0.5')
  })
})
