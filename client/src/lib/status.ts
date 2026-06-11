import type { ApplicationStatus } from '@/types'

export const ALL_STATUSES: ApplicationStatus[] = [
  'WISHLIST', 'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN',
]

export const PIPELINE_STATUSES: ApplicationStatus[] = [
  'WISHLIST', 'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER',
]

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  WISHLIST: 'Wishlist',
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
}

// Tailwind color classes — safe for static analysis (no dynamic string construction)
const STATUS_COLORS = {
  WISHLIST:  { bg: 'bg-slate-100',   text: 'text-slate-600',  dot: 'bg-slate-400'   },
  APPLIED:   { bg: 'bg-blue-100',    text: 'text-blue-700',   dot: 'bg-blue-500'    },
  SCREENING: { bg: 'bg-amber-100',   text: 'text-amber-700',  dot: 'bg-amber-500'   },
  INTERVIEW: { bg: 'bg-violet-100',  text: 'text-violet-700', dot: 'bg-violet-500'  },
  OFFER:     { bg: 'bg-emerald-100', text: 'text-emerald-700',dot: 'bg-emerald-500' },
  REJECTED:  { bg: 'bg-rose-100',    text: 'text-rose-600',   dot: 'bg-rose-500'    },
  WITHDRAWN: { bg: 'bg-gray-100',    text: 'text-gray-500',   dot: 'bg-gray-400'    },
} satisfies Record<ApplicationStatus, { bg: string; text: string; dot: string }>

export function getStatusColors(status: ApplicationStatus) {
  return STATUS_COLORS[status]
}

export function getStatusLabel(status: ApplicationStatus): string {
  return STATUS_LABELS[status]
}
