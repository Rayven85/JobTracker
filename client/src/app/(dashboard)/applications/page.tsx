'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Briefcase } from 'lucide-react'
import { toast } from 'sonner'
import { listApplications, createApplication } from '@/lib/api/applications'
import { listResumes } from '@/lib/api/resumes'
import { ApplicationCard } from '@/components/applications/ApplicationCard'
import { ApplicationForm, type FormData } from '@/components/applications/ApplicationForm'
import { ALL_STATUSES, STATUS_LABELS } from '@/lib/status'
import type { Application, ApplicationStatus, Resume } from '@/types'

const FILTER_TABS: { label: string; value: ApplicationStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  ...ALL_STATUSES.map(s => ({ label: STATUS_LABELS[s], value: s })),
]

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [total, setTotal] = useState(0)
  const [resumes, setResumes] = useState<Resume[]>([])
  const [activeStatus, setActiveStatus] = useState<ApplicationStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchApplications = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = {
        ...(activeStatus !== 'ALL' ? { status: activeStatus } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      }
      const res = await listApplications(params)
      setApplications(res.items)
      setTotal(res.total)
    } catch {
      toast.error('Failed to load applications')
    } finally {
      setIsLoading(false)
    }
  }, [activeStatus, search])

  useEffect(() => { fetchApplications() }, [fetchApplications])

  useEffect(() => {
    listResumes().then(setResumes).catch(() => {})
  }, [])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(fetchApplications, 300)
    return () => clearTimeout(t)
  }, [search, fetchApplications])

  async function handleCreate(data: FormData) {
    const app = await createApplication({
      companyName: data.companyName,
      jobTitle: data.jobTitle,
      status: data.status,
      location: data.location || undefined,
      employmentType: data.employmentType || undefined,
      remote: data.remote,
      appliedDate: data.appliedDate || undefined,
      jobUrl: data.jobUrl || undefined,
      jobDescription: data.jobDescription || undefined,
      resumeId: data.resumeId || undefined,
      notes: data.notes || undefined,
    })
    setApplications(prev => [app, ...prev])
    setTotal(prev => prev + 1)
    toast.success('Application added')
  }

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Applications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} total</p>
        </div>
        <button onClick={() => setShowForm(true)} className={primaryBtn}>
          <Plus size={16} /> New Application
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Status tabs */}
        <div className="flex gap-1 flex-wrap">
          {FILTER_TABS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setActiveStatus(value)}
              className={`px-3 py-1.5 rounded-[--radius] text-xs font-medium transition-colors ${
                activeStatus === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Search */}
        <div className="relative sm:ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search company or role…"
            className="pl-8 w-64 bg-input border border-border rounded-[--radius] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/20 transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-[--radius-lg] h-36 animate-pulse" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Briefcase size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">No applications yet</h3>
          <p className="text-sm text-muted-foreground mb-5">
            {activeStatus !== 'ALL' || search ? 'Try adjusting your filters.' : 'Add your first job application to get started.'}
          </p>
          {activeStatus === 'ALL' && !search && (
            <button onClick={() => setShowForm(true)} className={primaryBtn}>
              <Plus size={15} /> Add Application
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {applications.map(app => (
            <ApplicationCard key={app.id} application={app} />
          ))}
        </div>
      )}

      {showForm && (
        <ApplicationForm
          resumes={resumes}
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}

const primaryBtn = 'flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-[--radius] text-sm font-medium transition-colors'
