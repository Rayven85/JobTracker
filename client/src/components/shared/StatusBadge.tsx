import { cn } from '@/lib/utils'
import { getStatusColors, getStatusLabel } from '@/lib/status'
import type { ApplicationStatus } from '@/types'

interface StatusBadgeProps {
  status: ApplicationStatus
  size?: 'sm' | 'md'
  className?: string
}

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const { bg, text } = getStatusColors(status)
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full whitespace-nowrap',
        bg, text,
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1',
        className
      )}
    >
      {getStatusLabel(status)}
    </span>
  )
}
