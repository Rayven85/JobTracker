'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Activity, Briefcase, TrendingUp, Clock } from 'lucide-react'
import { getDashboardStats, getRecentActivity } from '@/lib/api/dashboard'
import { useAuth } from '@/hooks/use-auth'
import { ALL_STATUSES, STATUS_LABELS, getStatusColors } from '@/lib/status'
import type { DashboardStats, RecentActivityItem } from '@/types'

const EVENT_LABELS: Record<string, string> = {
  CREATED: 'Application added',
  STATUS_CHANGED: 'Status updated',
  ANALYSIS_COMPLETED: 'AI analysis completed',
  COVER_LETTER_GENERATED: 'Cover letter generated',
  INTERVIEW_PREP_GENERATED: 'Interview prep generated',
  NOTE_ADDED: 'Note added',
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activity, setActivity] = useState<RecentActivityItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([getDashboardStats(), getRecentActivity()])
      .then(([s, a]) => { setStats(s); setActivity(a) })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  const chartData = stats
    ? ALL_STATUSES.map(s => ({ name: STATUS_LABELS[s], count: stats.totals[s] ?? 0, status: s }))
    : []

  const totalApplied = stats ? (stats.totals['APPLIED'] ?? 0) + (stats.totals['SCREENING'] ?? 0) +
    (stats.totals['INTERVIEW'] ?? 0) + (stats.totals['OFFER'] ?? 0) + (stats.totals['REJECTED'] ?? 0) +
    (stats.totals['WITHDRAWN'] ?? 0) : 0

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Here's how your job search is going.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Total Applied',
            value: isLoading ? '—' : totalApplied,
            icon: Briefcase,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
          {
            label: 'Active',
            value: isLoading ? '—' : (stats?.activeApplications ?? 0),
            icon: Activity,
            color: 'text-violet-600',
            bg: 'bg-violet-50',
          },
          {
            label: 'Response Rate',
            value: isLoading ? '—' : `${Math.round((stats?.responseRate ?? 0) * 100)}%`,
            icon: TrendingUp,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
          },
          {
            label: 'Avg Days to Response',
            value: isLoading ? '—' : (stats?.avgDaysToResponse ?? 0),
            icon: Clock,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm">
            <div className={`inline-flex items-center justify-center w-9 h-9 rounded-[--radius] ${bg} mb-3`}>
              <Icon size={17} className={color} />
            </div>
            <div className="text-2xl font-bold text-foreground">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4">Application Funnel</h2>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <span className="text-sm text-muted-foreground">Loading…</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)',
                    fontSize: 12,
                  }}
                  cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {chartData.map(d => {
                    const col = getStatusColors(d.status)
                    return <Cell key={d.status} fill={BAR_COLOR[d.status]} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent activity */}
        <div className="bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4">Recent Activity</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-4">
              {activity.map(item => (
                <li key={item.id} className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {item.application.companyName} — {item.application.jobTitle}
                    </p>
                    <p className="text-xs text-muted-foreground">{EVENT_LABELS[item.eventType] ?? item.eventType}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">{timeAgo(item.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

const BAR_COLOR: Record<string, string> = {
  WISHLIST: '#94a3b8',
  APPLIED: '#60a5fa',
  SCREENING: '#fbbf24',
  INTERVIEW: '#a78bfa',
  OFFER: '#34d399',
  REJECTED: '#f87171',
  WITHDRAWN: '#9ca3af',
}
