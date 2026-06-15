import Link from 'next/link'
import { MapPin, Calendar, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { Application } from '@/types'

interface ApplicationCardProps {
  application: Application
}

export function ApplicationCard({ application }: ApplicationCardProps) {
  const { id, jobTitle, companyName, status, location, appliedDate, matchScore, tags = [] } = application

  return (
    <Link href={`/applications/${id}`} className="block group">
      <div className="bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm group-hover:border-ring/40 group-hover:shadow-md transition-all">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-foreground truncate">{jobTitle}</h3>
            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
              <Building2 size={12} />
              <span className="truncate">{companyName}</span>
            </div>
          </div>
          <StatusBadge status={status} size="sm" />
        </div>

        {/* Meta */}
        {(location || appliedDate) && (
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
            {location && (
              <span className="flex items-center gap-1">
                <MapPin size={11} />
                {location}
              </span>
            )}
            {appliedDate && (
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {new Date(appliedDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        )}

        {/* Match score bar */}
        {matchScore !== null && matchScore !== undefined && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  matchScore >= 76 ? 'bg-emerald-500' : matchScore >= 51 ? 'bg-amber-500' : 'bg-rose-500'
                )}
                style={{ width: `${matchScore}%` }}
              />
            </div>
            <span
              className={cn(
                'text-xs font-semibold tabular-nums',
                matchScore >= 76 ? 'text-emerald-600' : matchScore >= 51 ? 'text-amber-600' : 'text-rose-500'
              )}
            >
              {matchScore}%
            </span>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tags.slice(0, 3).map(tag => (
              <span
                key={tag.id}
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
