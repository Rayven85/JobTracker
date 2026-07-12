'use client'

import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ExternalLink, Loader2, ChevronDown, ChevronRight,
  Sparkles, FileText, Download, Save, Plus, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  getApplication, updateApplication, updateStatus, deleteApplication,
  analyzeApplication, generateCoverLetter, updateCoverLetter,
  generateInterviewPrep, addContact,
  generateTailoredResume, updateTailoredResume,
} from '@/lib/api/applications'
import { listResumes, getPresignedUrl, uploadToS3, confirmUpload } from '@/lib/api/resumes'
import { ExtractedDataEditor } from '@/components/profile-forms/ExtractedDataEditor'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ALL_STATUSES, STATUS_LABELS, PIPELINE_STATUSES, getStatusColors } from '@/lib/status'
import type { Application, ApplicationStatus, CoverLetter, InterviewQuestion, Resume, ExtractedData } from '@/types'
import Link from 'next/link'

const TABS = ['Overview', 'Resume', 'Cover Letter', 'Interview Prep', 'Timeline', 'Contacts'] as const
type Tab = typeof TABS[number]

// AI features work off either an attached resume or a generated tailored resume.
function hasResumeSource(app: Application) {
  return !!app.resumeId || (app.tailoredResumes?.length ?? 0) > 0
}

const EVENT_ICONS: Record<string, string> = {
  CREATED: '🎯',
  STATUS_CHANGED: '🔄',
  ANALYSIS_COMPLETED: '🤖',
  COVER_LETTER_GENERATED: '✉️',
  INTERVIEW_PREP_GENERATED: '📝',
  NOTE_ADDED: '📌',
}

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [app, setApp] = useState<Application | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('Overview')

  useEffect(() => {
    getApplication(id)
      .then(setApp)
      .catch(() => { toast.error('Application not found'); router.push('/applications') })
      .finally(() => setIsLoading(false))
  }, [id, router])

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 size={24} className="animate-spin text-muted-foreground" />
    </div>
  )

  if (!app) return null

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      {/* Back + title */}
      <div className="flex items-start gap-4 mb-6">
        <button onClick={() => router.push('/applications')} className="mt-1 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-foreground truncate">{app.jobTitle}</h1>
            <StatusBadge status={app.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{app.companyName}{app.location ? ` · ${app.location}` : ''}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Overview' && <OverviewTab app={app} onAppChange={setApp} />}
      {activeTab === 'Resume' && <ResumeTab app={app} onAppChange={setApp} />}
      {activeTab === 'Cover Letter' && <CoverLetterTab app={app} onAppChange={setApp} />}
      {activeTab === 'Interview Prep' && <InterviewPrepTab app={app} onAppChange={setApp} />}
      {activeTab === 'Timeline' && <TimelineTab app={app} />}
      {activeTab === 'Contacts' && <ContactsTab app={app} onAppChange={setApp} />}
    </div>
  )
}

// ─── Resume source card (attach an existing resume) ─────────────────────────────

function ResumeSourceCard({ app, onAppChange }: { app: Application; onAppChange: (a: Application) => void }) {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loading, setLoading] = useState(true)
  const [isAttaching, setIsAttaching] = useState(false)

  useEffect(() => {
    listResumes().then(setResumes).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function handleAttach(resumeId: string) {
    setIsAttaching(true)
    try {
      const updated = await updateApplication(app.id, { resumeId: resumeId || null })
      onAppChange(updated)
      toast.success(resumeId ? 'Resume attached' : 'Resume detached')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update resume')
    } finally {
      setIsAttaching(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Resume</h2>
        {app.resumeId && <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-medium">Attached</span>}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading resumes…</div>
      ) : resumes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No resumes yet. <Link href="/resumes" className="text-primary hover:underline">Upload one</Link> to unlock AI analysis, cover letters and interview prep.
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-muted-foreground shrink-0" />
          <select
            value={app.resumeId ?? ''}
            onChange={e => handleAttach(e.target.value)}
            disabled={isAttaching}
            className="flex-1 min-w-0 bg-input border border-border rounded-[--radius] px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/20 disabled:opacity-50"
          >
            <option value="">— No resume attached —</option>
            {resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          {isAttaching && <Loader2 size={14} className="animate-spin text-muted-foreground shrink-0" />}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        {app.resumeId
          ? 'This resume feeds AI analysis, cover letters and interview prep.'
          : 'Attach a resume to unlock AI analysis, cover letters and interview prep.'}
      </p>
    </div>
  )
}

// ─── Resume tab (AI-tailored resume generated from the master profile) ──────────

function ResumeTab({ app, onAppChange }: { app: Application; onAppChange: (a: Application) => void }) {
  const tailored = app.tailoredResumes?.[0] ?? null
  const tailoredId = tailored?.id ?? null
  const [draft, setDraft] = useState<ExtractedData | null>(tailored?.data ?? null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSavingToLibrary, setIsSavingToLibrary] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  async function persistDraft(data: ExtractedData) {
    if (!tailoredId) return
    setSaveState('saving')
    try {
      await updateTailoredResume(tailoredId, data)
      setSaveState('saved')
    } catch {
      setSaveState('idle')
      toast.error('Auto-save failed')
    }
  }

  // Structured edits auto-save (debounced) so reopening keeps them.
  function handleDraftChange(data: ExtractedData) {
    setDraft(data)
    setSaveState('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persistDraft(data), 900)
  }

  async function handleSaveEdits() {
    if (!draft) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    await persistDraft(draft)
  }

  async function handleGenerate() {
    setIsGenerating(true)
    try {
      const result = await generateTailoredResume(app.id)
      onAppChange(await getApplication(app.id))
      setDraft(result.data)
      setSaveState('saved')
      toast.success('Tailored resume generated!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleDownloadPdf() {
    if (!draft) return
    setIsDownloading(true)
    try {
      const { generateResumePdfBlob, resumePdfFileName } = await import('@/lib/resume-pdf')
      const blob = await generateResumePdfBlob(draft)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = resumePdfFileName(app.companyName, app.jobTitle)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PDF export failed')
    } finally {
      setIsDownloading(false)
    }
  }

  async function handleSaveToLibrary() {
    if (!draft) return
    setIsSavingToLibrary(true)
    try {
      const { generateResumePdfBlob, resumePdfFileName } = await import('@/lib/resume-pdf')
      const blob = await generateResumePdfBlob(draft)
      const fileName = resumePdfFileName(app.companyName, app.jobTitle)
      const file = new File([blob], fileName, { type: 'application/pdf' })
      const { presignedUrl, s3Key } = await getPresignedUrl(fileName, 'application/pdf')
      await uploadToS3(presignedUrl, file)
      await confirmUpload({ s3Key, fileName, fileSize: file.size, name: `Tailored — ${app.companyName} ${app.jobTitle}` })
      toast.success('Saved to your Resumes library')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save to library failed')
    } finally {
      setIsSavingToLibrary(false)
    }
  }

  if (!draft) {
    return (
      <div className="bg-card border border-border rounded-[--radius-lg] p-8 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
          <Sparkles size={20} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No tailored resume yet</p>
        <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
          Generate a resume from your profile, automatically matched to this job&apos;s description. It uses only facts already in your profile — nothing is invented. You&apos;ll need some profile content first.
        </p>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-[--radius] text-sm font-medium transition-colors"
        >
          {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Generate from profile
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Tailored Resume</h2>
            <span className="text-[11px] text-muted-foreground">
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : ''}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">AI-generated from your profile, matched to this job. Edits save automatically.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSaveEdits}
            disabled={saveState === 'saving'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-accent border border-border text-foreground rounded-[--radius] text-xs font-medium transition-colors disabled:opacity-50"
          >
            {saveState === 'saving' ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save edits
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-accent border border-border text-foreground rounded-[--radius] text-xs font-medium transition-colors disabled:opacity-50"
          >
            {isDownloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            Download PDF
          </button>
          <button
            onClick={handleSaveToLibrary}
            disabled={isSavingToLibrary}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-accent border border-border text-foreground rounded-[--radius] text-xs font-medium transition-colors disabled:opacity-50"
            title="Generate a PDF and save it into your Resumes library"
          >
            {isSavingToLibrary ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
            Save to Resumes
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-[--radius] text-xs font-medium transition-colors"
          >
            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Regenerate
          </button>
        </div>
      </div>

      {app.resumeId && (
        <p className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-[--radius] px-3 py-2">
          An uploaded resume is attached, so AI analysis, cover letters and interview prep use that. This tailored resume is here to review, download, or save to your library.
        </p>
      )}

      <div className="bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm">
        <ExtractedDataEditor data={draft} onChange={handleDraftChange} />
      </div>
    </div>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ app, onAppChange }: { app: Application; onAppChange: (a: Application) => void }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [notes, setNotes] = useState(app.notes ?? '')
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  async function handleAnalyze() {
    if (!hasResumeSource(app)) { toast.error('Attach a resume or generate one from your profile (Resume tab) first'); return }
    setIsAnalyzing(true)
    try {
      await analyzeApplication(app.id)
      const updated = await getApplication(app.id)
      onAppChange(updated)
      toast.success('Analysis complete!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function handleStatusChange(status: ApplicationStatus) {
    setIsChangingStatus(true)
    try {
      const updated = await updateStatus(app.id, status)
      onAppChange(updated)
      toast.success(`Status updated to ${STATUS_LABELS[status]}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setIsChangingStatus(false)
    }
  }

  async function handleSaveNotes() {
    setIsSavingNotes(true)
    try {
      const updated = await updateApplication(app.id, { notes })
      onAppChange(updated)
    } catch {
      toast.error('Failed to save notes')
    } finally {
      setIsSavingNotes(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Resume source */}
      <ResumeSourceCard app={app} onAppChange={onAppChange} />

      {/* Job details + status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2 bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Job Details</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ['Company', app.companyName],
              ['Role', app.jobTitle],
              ['Location', app.location],
              ['Type', app.employmentType],
              ['Remote', app.remote ? 'Yes' : 'No'],
              ['Applied', app.appliedDate ? new Date(app.appliedDate).toLocaleDateString() : null],
              ['Salary', app.salaryMin || app.salaryMax ? `$${app.salaryMin ?? '?'}–$${app.salaryMax ?? '?'}` : null],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-medium text-foreground mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
          {app.jobUrl && (
            <a href={app.jobUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink size={12} /> View job posting
            </a>
          )}
        </div>

        {/* Status card */}
        <div className="bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-3">Status</h2>
          {/* Pipeline stepper */}
          <div className="space-y-1 mb-4">
            {PIPELINE_STATUSES.map((s, i) => {
              const current = app.status === s
              const passed = PIPELINE_STATUSES.indexOf(app.status) > i &&
                app.status !== 'REJECTED' && app.status !== 'WITHDRAWN'
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs shrink-0',
                    current ? 'border-primary bg-primary text-primary-foreground' :
                    passed ? 'border-emerald-500 bg-emerald-500 text-white' :
                    'border-border bg-background'
                  )}>
                    {passed ? '✓' : (i + 1)}
                  </div>
                  <span className={cn('text-xs', current ? 'font-semibold text-foreground' : passed ? 'text-muted-foreground line-through' : 'text-muted-foreground')}>
                    {STATUS_LABELS[s]}
                  </span>
                </div>
              )
            })}
          </div>
          {/* Change status */}
          <div className="relative">
            <label className="block text-xs text-muted-foreground mb-1">Change status</label>
            <select
              value={app.status}
              onChange={e => handleStatusChange(e.target.value as ApplicationStatus)}
              disabled={isChangingStatus}
              className="w-full bg-input border border-border rounded-[--radius] px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/20 disabled:opacity-50"
            >
              {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      <div className="bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">AI Match Analysis</h2>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-[--radius] text-xs font-medium transition-colors"
          >
            {isAnalyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {app.matchScore !== null ? 'Re-analyze' : 'Analyze Match'}
          </button>
        </div>

        {app.matchScore !== null ? (
          <div className="space-y-4">
            {/* Score */}
            <div className="flex items-center gap-4">
              <div className={cn(
                'text-4xl font-black',
                app.matchScore >= 76 ? 'text-emerald-600' : app.matchScore >= 51 ? 'text-amber-600' : 'text-rose-500'
              )}>
                {app.matchScore}%
              </div>
              <div className="flex-1">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', app.matchScore >= 76 ? 'bg-emerald-500' : app.matchScore >= 51 ? 'bg-amber-500' : 'bg-rose-500')}
                    style={{ width: `${app.matchScore}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {app.matchScore >= 76 ? 'Strong match' : app.matchScore >= 51 ? 'Moderate match' : 'Weak match'}
                </p>
              </div>
            </div>

            {/* Analysis breakdown */}
            {app.matchAnalysis && (() => {
              try {
                const analysis = JSON.parse(app.matchAnalysis)
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs font-medium text-emerald-700 mb-2">✓ Matched Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(analysis.matched ?? []).map((s: string) => (
                          <span key={s} className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-rose-600 mb-2">✗ Missing Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(analysis.missing ?? []).map((s: string) => (
                          <span key={s} className="text-xs px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-amber-700 mb-2">💡 Suggestions</p>
                      <ul className="space-y-1">
                        {(analysis.suggestions ?? []).map((s: string, i: number) => (
                          <li key={i} className="text-xs text-foreground">{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )
              } catch { return null }
            })()}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {hasResumeSource(app) ? 'Run an analysis to see how well your resume matches this job.' : 'Attach a resume (Overview) or generate one from your profile (Resume tab) first, then run an AI analysis.'}
          </p>
        )}
      </div>

      {/* Notes */}
      <div className="bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-3">Notes</h2>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={handleSaveNotes}
          rows={4}
          placeholder="Add notes about this application…"
          className="w-full bg-input border border-border rounded-[--radius] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/20 transition-colors resize-none"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleSaveNotes}
            disabled={isSavingNotes}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-accent border border-border text-foreground rounded-[--radius] text-xs font-medium transition-colors disabled:opacity-50"
          >
            {isSavingNotes ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Cover Letter tab ─────────────────────────────────────────────────────────

function CoverLetterTab({ app, onAppChange }: { app: Application; onAppChange: (a: Application) => void }) {
  const activeLetters = app.coverLetters ?? []
  const activeLetter = activeLetters.find(l => l.isActive) ?? activeLetters[0] ?? null
  const [content, setContent] = useState(activeLetter?.content ?? '')
  const [selectedId, setSelectedId] = useState(activeLetter?.id ?? '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  async function handleGenerate() {
    setIsGenerating(true)
    try {
      await generateCoverLetter(app.id)
      const updated = await getApplication(app.id)
      onAppChange(updated)
      const newActive = (updated.coverLetters ?? []).find(l => l.isActive)
      if (newActive) { setContent(newActive.content); setSelectedId(newActive.id) }
      toast.success('Cover letter generated!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSave() {
    if (!selectedId) return
    setIsSaving(true)
    try {
      await updateCoverLetter(selectedId, content)
      toast.success('Saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  // Client-side download from state — the access token lives in memory, so a plain
  // <a href> to the API can't send it (would 401). The content is already here anyway.
  function handleDownload() {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cover-letter-${app.companyName.replace(/\s+/g, '-').toLowerCase()}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function handleSelectVersion(letter: CoverLetter) {
    setSelectedId(letter.id)
    setContent(letter.content)
  }

  if (!hasResumeSource(app)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText size={32} className="text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">No resume yet</p>
        <p className="text-xs text-muted-foreground">Attach a resume (Overview) or generate one from your profile (Resume tab) to write a cover letter.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
      {/* Editor */}
      <div className="md:col-span-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Cover Letter</h2>
          <div className="flex gap-2">
            {selectedId && (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-accent border border-border text-foreground rounded-[--radius] text-xs font-medium transition-colors"
                >
                  {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-accent border border-border text-foreground rounded-[--radius] text-xs font-medium transition-colors"
                >
                  <Download size={12} /> Download
                </button>
              </>
            )}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-[--radius] text-xs font-medium transition-colors"
            >
              {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {activeLetters.length > 0 ? 'Regenerate' : 'Generate'}
            </button>
          </div>
        </div>

        {activeLetters.length > 0 ? (
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={20}
            className="w-full bg-input border border-border rounded-[--radius] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/20 transition-colors resize-none font-mono"
          />
        ) : (
          <div className="border-2 border-dashed border-border rounded-[--radius-lg] flex flex-col items-center justify-center py-20 text-center">
            <Sparkles size={28} className="text-muted-foreground mb-3" />
            <p className="text-sm text-foreground font-medium mb-1">No cover letter yet</p>
            <p className="text-xs text-muted-foreground">Click "Generate" to create an AI-tailored cover letter.</p>
          </div>
        )}
      </div>

      {/* Version history */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Versions</h3>
        <div className="space-y-2">
          {activeLetters.length === 0 && <p className="text-xs text-muted-foreground">No versions yet.</p>}
          {[...activeLetters].sort((a, b) => b.version - a.version).map(letter => (
            <button
              key={letter.id}
              onClick={() => handleSelectVersion(letter)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-[--radius] text-xs transition-colors',
                selectedId === letter.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'
              )}
            >
              <div className="flex items-center justify-between">
                <span>Version {letter.version}</span>
                {letter.isActive && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Active</span>}
              </div>
              <span className="text-[11px] opacity-70">{new Date(letter.createdAt).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Interview Prep tab ───────────────────────────────────────────────────────

function InterviewPrepTab({ app, onAppChange }: { app: Application; onAppChange: (a: Application) => void }) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const questions: InterviewQuestion[] = app.interviewPrep?.questions ?? []

  async function handleGenerate() {
    setIsGenerating(true)
    try {
      await generateInterviewPrep(app.id)
      const updated = await getApplication(app.id)
      onAppChange(updated)
      toast.success('Interview questions ready!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!hasResumeSource(app)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">Attach a resume (Overview) or generate one from your profile (Resume tab) to generate interview prep.</p>
      </div>
    )
  }

  const CATEGORY_COLORS: Record<string, string> = {
    technical: 'bg-blue-100 text-blue-700',
    behavioral: 'bg-violet-100 text-violet-700',
    company: 'bg-amber-100 text-amber-700',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Interview Questions</h2>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-[--radius] text-xs font-medium transition-colors"
        >
          {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {questions.length > 0 ? 'Regenerate' : 'Generate Questions'}
        </button>
      </div>

      {questions.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-[--radius-lg] flex flex-col items-center justify-center py-20 text-center">
          <Sparkles size={28} className="text-muted-foreground mb-3" />
          <p className="text-sm text-foreground font-medium mb-1">No questions yet</p>
          <p className="text-xs text-muted-foreground">Generate 8 tailored interview questions for this role.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <div key={i} className="bg-card border border-border rounded-[--radius-lg] overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', CATEGORY_COLORS[q.category] ?? 'bg-gray-100 text-gray-600')}>
                    {q.category}
                  </span>
                  <span className="text-sm text-foreground truncate">{q.question}</span>
                </div>
                {openIdx === i ? <ChevronDown size={15} className="shrink-0 text-muted-foreground" /> : <ChevronRight size={15} className="shrink-0 text-muted-foreground" />}
              </button>
              {openIdx === i && (
                <div className="px-4 pb-4 pt-1 border-t border-border/50">
                  <p className="text-sm text-foreground mb-2 font-medium">{q.question}</p>
                  <p className="text-xs text-muted-foreground"><span className="font-medium text-amber-700">Tip: </span>{q.tips}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Timeline tab ─────────────────────────────────────────────────────────────

function TimelineTab({ app }: { app: Application }) {
  const events = [...(app.events ?? [])].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  function describeEvent(event: Application['events'][number]): string {
    if (event.eventType === 'STATUS_CHANGED' && event.oldStatus && event.newStatus) {
      return `${STATUS_LABELS[event.oldStatus]} → ${STATUS_LABELS[event.newStatus]}`
    }
    return event.note ?? ''
  }

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No events yet.</p>
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
      <ul className="space-y-6">
        {events.map(event => (
          <li key={event.id} className="relative">
            <div className="absolute -left-4 w-4 h-4 rounded-full bg-card border-2 border-border flex items-center justify-center text-[10px]">
              {EVENT_ICONS[event.eventType] ?? '•'}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">
                {new Date(event.createdAt).toLocaleString('en-NZ', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
              <p className="text-sm font-medium text-foreground capitalize">{event.eventType.replace(/_/g, ' ').toLowerCase()}</p>
              {describeEvent(event) && (
                <p className="text-sm text-muted-foreground mt-0.5">{describeEvent(event)}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Contacts tab ─────────────────────────────────────────────────────────────

function ContactsTab({ app, onAppChange }: { app: Application; onAppChange: (a: Application) => void }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', role: '', email: '', phone: '', linkedInUrl: '' })
  const [isSaving, setIsSaving] = useState(false)
  const contacts = app.contacts ?? []

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setIsSaving(true)
    try {
      await addContact(app.id, {
        name: form.name.trim(),
        role: form.role || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        linkedInUrl: form.linkedInUrl || undefined,
      })
      const updated = await getApplication(app.id)
      onAppChange(updated)
      setForm({ name: '', role: '', email: '', phone: '', linkedInUrl: '' })
      setShowForm(false)
      toast.success('Contact added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add contact')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Contacts</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-accent border border-border text-foreground rounded-[--radius] text-xs font-medium transition-colors"
        >
          <Plus size={13} /> Add Contact
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-card border border-border rounded-[--radius-lg] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {([['name', 'Name *'], ['role', 'Role'], ['email', 'Email'], ['phone', 'Phone'], ['linkedInUrl', 'LinkedIn URL']] as const).map(([key, label]) => (
              <div key={key} className={key === 'linkedInUrl' ? 'col-span-2' : ''}>
                <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                <input
                  value={form[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full bg-input border border-border rounded-[--radius] px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/20 transition-colors"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 bg-muted hover:bg-accent border border-border text-foreground rounded-[--radius] text-xs font-medium transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-[--radius] text-xs font-medium transition-colors">
              {isSaving ? <Loader2 size={12} className="animate-spin" /> : null} Save
            </button>
          </div>
        </form>
      )}

      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No contacts added yet.</p>
      ) : (
        <ul className="space-y-3">
          {contacts.map(contact => (
            <li key={contact.id} className="bg-card border border-border rounded-[--radius-lg] p-4">
              <p className="text-sm font-semibold text-foreground">{contact.name}</p>
              {contact.role && <p className="text-xs text-muted-foreground">{contact.role}</p>}
              <div className="flex flex-wrap gap-3 mt-2">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="text-xs text-primary hover:underline">{contact.email}</a>
                )}
                {contact.linkedInUrl && (
                  <a href={contact.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                    <ExternalLink size={11} /> LinkedIn
                  </a>
                )}
                {contact.phone && <span className="text-xs text-muted-foreground">{contact.phone}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
