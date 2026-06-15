'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApplicationStatus, Resume } from '@/types'
import { ALL_STATUSES, STATUS_LABELS } from '@/lib/status'
import { LocationCombobox } from './LocationCombobox'

// value must match the server's employmentType enum; label is what the user sees
const EMPLOYMENT_TYPES: { value: string; label: string }[] = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'GRADUATE', label: 'Graduate' },
]

interface ApplicationFormProps {
  onSubmit: (data: FormData) => Promise<void>
  onClose: () => void
  resumes?: Resume[]
}

export interface FormData {
  companyName: string
  jobTitle: string
  status: ApplicationStatus
  location: string
  employmentType: string
  remote: boolean
  jobUrl: string
  jobDescription: string
  appliedDate: string
  resumeId: string
  notes: string
}

export function ApplicationForm({ onSubmit, onClose, resumes = [] }: ApplicationFormProps) {
  const [form, setForm] = useState<FormData>({
    companyName: '',
    jobTitle: '',
    status: 'WISHLIST',
    location: '',
    employmentType: '',
    remote: false,
    jobUrl: '',
    jobDescription: '',
    appliedDate: '',
    resumeId: '',
    notes: '',
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.companyName.trim()) { setError('Company name is required'); return }
    if (!form.jobTitle.trim()) { setError('Job title is required'); return }
    setIsSubmitting(true)
    try {
      await onSubmit(form)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    // Overlay
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg bg-card border border-border rounded-[--radius-xl] shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">New Application</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div role="alert" className="rounded-[--radius] bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-foreground mb-1.5">Company Name <span className="text-destructive">*</span></label>
              <input value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Xero" className={inputCls} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-foreground mb-1.5">Job Title <span className="text-destructive">*</span></label>
              <input value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} placeholder="Senior Engineer" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value as ApplicationStatus)} className={inputCls}>
                {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Employment Type</label>
              <select value={form.employmentType} onChange={e => set('employmentType', e.target.value)} className={inputCls}>
                <option value="">Select…</option>
                {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Location</label>
              <LocationCombobox value={form.location} onChange={v => set('location', v)} placeholder="Auckland, NZ" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Applied Date</label>
              <input type="date" value={form.appliedDate} onChange={e => set('appliedDate', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Job URL</label>
            <input value={form.jobUrl} onChange={e => set('jobUrl', e.target.value)} placeholder="https://…" className={inputCls} />
          </div>

          {resumes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Resume</label>
              <select value={form.resumeId} onChange={e => set('resumeId', e.target.value)} className={inputCls}>
                <option value="">None</option>
                {resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Job Description</label>
            <textarea
              value={form.jobDescription}
              onChange={e => set('jobDescription', e.target.value)}
              rows={4}
              placeholder="Paste the job description here for AI analysis…"
              className={cn(inputCls, 'resize-none')}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.remote} onChange={e => set('remote', e.target.checked)} className="rounded" />
            <span className="text-sm text-foreground">Remote position</span>
          </label>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          <button type="button" onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className={primaryBtn}>
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            Add Application
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full bg-input border border-border rounded-[--radius] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/20 transition-colors'
const primaryBtn = 'flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground rounded-[--radius] text-sm font-medium transition-colors'
const secondaryBtn = 'px-4 py-2 bg-muted hover:bg-accent border border-border text-foreground rounded-[--radius] text-sm font-medium transition-colors'
