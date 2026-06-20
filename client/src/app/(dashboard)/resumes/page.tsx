'use client'

import { useEffect, useState, useRef } from 'react'
import { Upload, Trash2, Star, FileText, Loader2, CheckCircle2, AlertTriangle, XCircle, Eye, X, Save, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { listResumes, getPresignedUrl, uploadToS3, confirmUpload, setDefaultResume, deleteResume, getResume, updateParsedText } from '@/lib/api/resumes'
import type { Resume, ExtractionStatus } from '@/types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function formatDate(date: string | null, isCurrent: boolean) {
  if (isCurrent) return 'Present'
  if (!date) return ''
  const [year, month] = date.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' })
}

function ExtractionPill({ status }: { status: ExtractionStatus }) {
  switch (status) {
    case 'READY': return <span className="text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 size={11} /> Text extracted</span>
    case 'EMPTY': return <span className="text-amber-600 inline-flex items-center gap-1"><AlertTriangle size={11} /> No text found</span>
    case 'FAILED': return <span className="text-destructive inline-flex items-center gap-1"><XCircle size={11} /> Extraction failed</span>
    default: return <span className="text-amber-600 inline-flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Processing…</span>
  }
}

// ─── Structured profile view inside the modal ─────────────────────────────────

function ProfileView({ resume, onEditRaw }: { resume: Resume; onEditRaw: () => void }) {
  const d = resume.extractedData
  if (!d) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Loader2 size={20} className="animate-spin text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">AI is extracting structured data…</p>
        <p className="text-xs text-muted-foreground mt-1">This may take up to 30 seconds after text extraction completes.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 overflow-y-auto max-h-[420px] pr-1">
      {/* Identity */}
      {(d.name || d.email || d.phone || d.location) && (
        <div>
          {d.name && <p className="text-base font-bold text-foreground">{d.name}</p>}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {d.email && <p className="text-xs text-muted-foreground">{d.email}</p>}
            {d.phone && <p className="text-xs text-muted-foreground">{d.phone}</p>}
            {d.location && <p className="text-xs text-muted-foreground">{d.location}</p>}
          </div>
          {d.summary && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{d.summary}</p>}
        </div>
      )}

      {/* Skills */}
      {d.skills.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {d.skills.map(s => (
              <span key={s} className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full text-xs">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Experience */}
      {d.experience.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Experience</p>
          <div className="space-y-3">
            {d.experience.map((exp, i) => (
              <div key={i} className="border-l-2 border-border pl-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{exp.title}</p>
                    <p className="text-xs text-muted-foreground">{exp.company}{exp.location ? ` · ${exp.location}` : ''}</p>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {formatDate(exp.startDate, false)}{(exp.startDate || exp.endDate || exp.current) ? ' – ' : ''}{formatDate(exp.endDate, exp.current)}
                  </p>
                </div>
                {exp.description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{exp.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {d.education.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Education</p>
          <div className="space-y-2">
            {d.education.map((edu, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{edu.institution}</p>
                  <p className="text-xs text-muted-foreground">{edu.degree}{edu.field ? ` · ${edu.field}` : ''}</p>
                </div>
                {(edu.startYear || edu.endYear) && (
                  <p className="text-xs text-muted-foreground shrink-0">{edu.startYear}{edu.endYear ? `–${edu.endYear}` : ''}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Certifications */}
      {d.certifications.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Certifications</p>
          <div className="space-y-1.5">
            {d.certifications.map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <p className="text-sm text-foreground">{c.name}{c.issuer ? ` — ${c.issuer}` : ''}</p>
                {c.year && <p className="text-xs text-muted-foreground shrink-0">{c.year}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={onEditRaw} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
        View / edit raw text
      </button>
    </div>
  )
}

// ─── Raw text editor ──────────────────────────────────────────────────────────

function RawTextEditor({
  initialText,
  onBack,
  onSave,
}: {
  initialText: string
  onBack: () => void
  onSave: (text: string) => Promise<void>
}) {
  const [text, setText] = useState(initialText)
  const [isSaving, setIsSaving] = useState(false)
  const isDirty = text !== initialText

  async function handleSave() {
    setIsSaving(true)
    try { await onSave(text) } finally { setIsSaving(false) }
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors self-start">
        <ChevronUp size={13} /> Back to profile view
      </button>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        className="flex-1 min-h-[300px] resize-none bg-muted/40 border border-border rounded-[--radius] px-3 py-2.5 text-xs text-foreground font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{text.length.toLocaleString()} characters</p>
        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm rounded-[--radius] transition-colors disabled:opacity-40"
        >
          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ResumesPage() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [viewingResume, setViewingResume] = useState<Resume | null>(null)
  const [isFetchingResume, setIsFetchingResume] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    listResumes()
      .then(setResumes)
      .catch(() => toast.error('Failed to load resumes'))
      .finally(() => setIsLoading(false))
  }, [])

  const hasProcessing = resumes.some(r => r.extractionStatus === 'PENDING')
  useEffect(() => {
    if (!hasProcessing) return
    let attempts = 0
    const interval = setInterval(async () => {
      attempts += 1
      try {
        const fresh = await listResumes()
        setResumes(fresh)
        if (!fresh.some(r => r.extractionStatus === 'PENDING') || attempts >= 10) clearInterval(interval)
      } catch {
        if (attempts >= 10) clearInterval(interval)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [hasProcessing])

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!fileInputRef.current) fileInputRef.current!.value = ''
    if (!file) return
    if (file.type !== 'application/pdf') { toast.error('Only PDF files are accepted'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10 MB'); return }

    const name = window.prompt('Name this resume (e.g. "Software Engineer CV"):', file.name.replace('.pdf', ''))
    if (!name) return

    setIsUploading(true)
    try {
      setUploadProgress('Getting upload URL…')
      const { presignedUrl, s3Key } = await getPresignedUrl(file.name, file.type)
      setUploadProgress('Uploading to S3…')
      await uploadToS3(presignedUrl, file)
      setUploadProgress('Confirming upload…')
      const resume = await confirmUpload({ s3Key, fileName: file.name, fileSize: file.size, name })
      setResumes(prev => [resume, ...prev])
      toast.success('Resume uploaded! Text extraction may take a moment.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
      setUploadProgress('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await setDefaultResume(id)
      setResumes(prev => prev.map(r => ({ ...r, isDefault: r.id === id })))
      toast.success('Default resume updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set default')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this resume? This cannot be undone.')) return
    try {
      await deleteResume(id)
      setResumes(prev => prev.filter(r => r.id !== id))
      toast.success('Resume deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  async function handleOpenModal(resume: Resume) {
    setShowRaw(false)
    setViewingResume(resume)
    setIsFetchingResume(true)
    try {
      const full = await getResume(resume.id)
      setViewingResume(full)
    } catch {
      toast.error('Failed to load resume details')
      setViewingResume(null)
    } finally {
      setIsFetchingResume(false)
    }
  }

  async function handleSaveRaw(text: string) {
    if (!viewingResume) return
    await updateParsedText(viewingResume.id, text)
    const newStatus = text.trim() ? 'READY' : 'EMPTY'
    setResumes(prev => prev.map(r => r.id === viewingResume.id ? { ...r, extractionStatus: newStatus as ExtractionStatus } : r))
    setViewingResume(prev => prev ? { ...prev, parsedText: text } : null)
    toast.success('Resume text saved')
  }

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Resumes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{resumes.length} uploaded</p>
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileSelect} className="hidden" id="resume-upload" />
          <label
            htmlFor="resume-upload"
            className={`flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-[--radius] text-sm font-medium transition-colors cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {isUploading ? <><Loader2 size={15} className="animate-spin" /> {uploadProgress || 'Uploading…'}</> : <><Upload size={15} /> Upload PDF</>}
          </label>
        </div>
      </div>

      {/* Resume list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card border border-border rounded-[--radius-lg] h-20 animate-pulse" />)}
        </div>
      ) : resumes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <FileText size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">No resumes yet</h3>
          <p className="text-sm text-muted-foreground mb-5">Upload a PDF to attach to your applications and enable AI features.</p>
          <label htmlFor="resume-upload" className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-[--radius] text-sm font-medium transition-colors cursor-pointer">
            <Upload size={15} /> Upload PDF
          </label>
        </div>
      ) : (
        <ul className="space-y-3">
          {resumes.map(resume => (
            <li key={resume.id} className="bg-card border border-border rounded-[--radius-lg] p-4 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-[--radius] bg-muted flex items-center justify-center shrink-0">
                <FileText size={18} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{resume.name}</p>
                  {resume.isDefault && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium shrink-0">Default</span>}
                </div>
                <p className="text-xs text-muted-foreground">{resume.fileName} · {formatBytes(resume.fileSize)}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(resume.createdAt).toLocaleDateString('en-NZ', { dateStyle: 'medium' })} · <ExtractionPill status={resume.extractionStatus} />
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {resume.extractionStatus !== 'PENDING' && (
                  <button onClick={() => handleOpenModal(resume)} title="View extracted profile" className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-[--radius] transition-colors">
                    <Eye size={15} />
                  </button>
                )}
                {!resume.isDefault && (
                  <button onClick={() => handleSetDefault(resume.id)} title="Set as default" className="p-2 text-muted-foreground hover:text-amber-500 hover:bg-muted rounded-[--radius] transition-colors">
                    <Star size={15} />
                  </button>
                )}
                <button onClick={() => handleDelete(resume.id)} title="Delete" className="p-2 text-muted-foreground hover:text-destructive hover:bg-muted rounded-[--radius] transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Profile / raw text modal */}
      {viewingResume && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={e => { if (e.target === e.currentTarget) setViewingResume(null) }}>
          <div className="bg-card border border-border rounded-[--radius-lg] shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{viewingResume.name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {showRaw ? 'Raw extracted text — edit if AI missed content' : 'AI-extracted profile from this resume'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!showRaw && !isFetchingResume && viewingResume.extractedData && (
                  <button onClick={() => setShowRaw(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronDown size={13} /> Raw text
                  </button>
                )}
                <button onClick={() => setViewingResume(null)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-[--radius] transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-hidden px-5 py-4">
              {isFetchingResume ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                </div>
              ) : showRaw ? (
                <RawTextEditor
                  initialText={viewingResume.parsedText ?? ''}
                  onBack={() => setShowRaw(false)}
                  onSave={handleSaveRaw}
                />
              ) : (
                <ProfileView resume={viewingResume} onEditRaw={() => setShowRaw(true)} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
