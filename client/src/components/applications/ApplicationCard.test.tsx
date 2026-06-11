import { render, screen } from '@testing-library/react'
import { ApplicationCard } from './ApplicationCard'
import type { Application } from '@/types'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const baseApp: Application = {
  id: 'app-1',
  companyName: 'Xero',
  jobTitle: 'Senior Engineer',
  status: 'APPLIED',
  location: 'Auckland, NZ',
  employmentType: 'Full Time',
  remote: false,
  appliedDate: '2026-01-15T00:00:00.000Z',
  deadline: null,
  jobDescription: null,
  jobUrl: null,
  resumeId: null,
  salaryMin: null,
  salaryMax: null,
  notes: null,
  matchScore: null,
  matchAnalysis: null,
  tags: [],
  contacts: [],
  events: [],
  coverLetters: [],
  interviewPrep: null,
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
}

describe('ApplicationCard', () => {
  it('renders company name and job title', () => {
    render(<ApplicationCard application={baseApp} />)
    expect(screen.getByText('Senior Engineer')).toBeInTheDocument()
    expect(screen.getByText('Xero')).toBeInTheDocument()
  })

  it('renders a StatusBadge for the current status', () => {
    render(<ApplicationCard application={baseApp} />)
    expect(screen.getByText('Applied')).toBeInTheDocument()
  })

  it('renders location when provided', () => {
    render(<ApplicationCard application={baseApp} />)
    expect(screen.getByText('Auckland, NZ')).toBeInTheDocument()
  })

  it('does not render match score bar when matchScore is null', () => {
    render(<ApplicationCard application={baseApp} />)
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('renders match score bar and percentage when matchScore is set', () => {
    render(<ApplicationCard application={{ ...baseApp, matchScore: 82 }} />)
    expect(screen.getByText('82%')).toBeInTheDocument()
  })

  it('renders tags when present (max 3 + overflow)', () => {
    const tags = [
      { id: '1', name: 'TypeScript', color: '#3178C6' },
      { id: '2', name: 'React', color: '#61DAFB' },
      { id: '3', name: 'Node.js', color: '#68A063' },
      { id: '4', name: 'Docker', color: '#2496ED' },
    ]
    render(<ApplicationCard application={{ ...baseApp, tags }} />)
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('Node.js')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  it('links to the correct application detail page', () => {
    render(<ApplicationCard application={baseApp} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/applications/app-1')
  })
})
