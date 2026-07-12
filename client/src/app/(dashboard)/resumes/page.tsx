'use client'

import { useEffect, useState, useRef } from 'react'
import { Upload, Trash2, FileText, Loader2, CheckCircle2, AlertTriangle, XCircle, Eye, X, Save, ChevronDown, ChevronUp, Sparkles, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { listResumes, getPresignedUrl, uploadToS3, confirmUpload, setDefaultResume, deleteResume, getResume, updateExtractedData, reExtractResume } from '@/lib/api/resumes'
import { syncResume, getSyncPlan } from '@/lib/api/profile'
import type { Resume, ExtractionStatus, ExtractedData, ProfileSuggestion, SyncPlan } from '@/types'
import { ExtractedDataEditor } from '@/components/profile-forms/ExtractedDataEditor'
import { MergeReview, type MergeReviewResult } from '@/components/profile-forms/MergeReview'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function ExtractionPill({ status }: { status: ExtractionStatus }) {
  switch (status) {
    case 'READY': return <span className="text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 size={11} /> Text extracted</span>
    case 'EMPTY': return <span className="text-amber-600 inline-flex items-center gap-1"><AlertTriangle size={11} /> No text found</span>
    case 'FAILED': return <span className="text-destructive inline-flex items-center gap-1"><XCircle size={11} /> Extraction failed</span>
    default: return <span className="text-amber-600 inline-flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Processing…</span>
  }
}

// ─── Read-only raw text view ──────────────────────────────────────────────────
// parsedText still feeds per-application AI (Analyze / Cover Letter); shown read-only
// so the user can sanity-check what the AI saw without wrangling messy text.

function RawTextView({ text, onBack }: { text: string; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors self-start">
        <ChevronUp size={13} /> Back to structured view
      </button>
      <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap bg-muted/40 border border-border rounded-[--radius] px-3 py-2.5 text-xs text-muted-foreground font-mono leading-relaxed">
        {text || 'No text extracted.'}
      </pre>
      <p className="text-xs text-muted-foreground">{text.length.toLocaleString()} characters · read-only</p>
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
  const [draft, setDraft] = useState<ExtractedData | null>(null)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isReExtracting, setIsReExtracting] = useState(false)
  const [syncDialog, setSyncDialog] = useState<ProfileSuggestion | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [mergePlan, setMergePlan] = useState<SyncPlan | null>(null)

  const isDirty = !!draft && !!viewingResume && JSON.stringify(draft) !== JSON.stringify(viewingResume.extractedData)

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

  function closeModal() {
    setViewingResume(null)
    setDraft(null)
    setShowRaw(false)
    setSyncDialog(null)
    setMergePlan(null)
  }

  async function handleOpenModal(resume: Resume) {
    setShowRaw(false)
    setDraft(null)
    setViewingResume(resume)
    setIsFetchingResume(true)
    try {
      const full = await getResume(resume.id)
      setViewingResume(full)
      setDraft(full.extractedData ?? null)
    } catch {
      toast.error('Failed to load resume details')
      setViewingResume(null)
    } finally {
      setIsFetchingResume(false)
    }
  }

  async function handleSaveDraft() {
    if (!viewingResume || !draft) return
    setIsSavingDraft(true)
    try {
      const { resume, suggestion } = await updateExtractedData(viewingResume.id, draft)
      const saved = resume.extractedData ?? draft
      setResumes(prev => prev.map(r => r.id === viewingResume.id ? { ...r, extractionStatus: resume.extractionStatus } : r))
      setViewingResume(prev => prev ? { ...prev, extractedData: saved } : null)
      setDraft(saved)
      if (suggestion) setSyncDialog(suggestion)
      else toast.success('Resume profile saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSavingDraft(false)
    }
  }

  async function handleReExtract() {
    if (!viewingResume) return
    if (isDirty && !confirm('Re-extract will overwrite your unsaved edits with fresh AI output. Continue?')) return
    setIsReExtracting(true)
    try {
      const { resume, suggestion } = await reExtractResume(viewingResume.id)
      const saved = resume.extractedData ?? null
      setResumes(prev => prev.map(r => r.id === viewingResume.id ? { ...r, extractionStatus: resume.extractionStatus } : r))
      setViewingResume(prev => prev ? { ...prev, extractedData: saved } : null)
      setDraft(saved)
      if (suggestion) setSyncDialog(suggestion)
      else toast.success('Re-extracted with AI')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to re-extract')
    } finally {
      setIsReExtracting(false)
    }
  }

  async function applySync(suggestion: ProfileSuggestion, result: MergeReviewResult) {
    const experience = suggestion.newExperience.filter((_, i) => !result.mergedIncomingIndexes.includes(i))
    await syncResume(suggestion.resumeId, {
      skills: suggestion.newSkills,
      experience,
      education: suggestion.newEducation,
      certifications: suggestion.newCertifications,
      experienceMerges: result.experienceMerges,
    })
    toast.success('Profile updated')
    setSyncDialog(null)
    setMergePlan(null)
  }

  // Sync dialog "Sync to profile" → run AI merge detection; show review if matches exist.
  async function handleSync() {
    if (!syncDialog) return
    setIsSyncing(true)
    try {
      const plan = await getSyncPlan(syncDialog.resumeId)
      if (!plan.suggestion) { setSyncDialog(null); toast.success('Profile already up to date'); return }
      if (plan.merges.length > 0) {
        setMergePlan(plan)
        setSyncDialog(null)
      } else {
        await applySync(plan.suggestion, { experienceMerges: [], mergedIncomingIndexes: [] })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sync to profile')
    } finally {
      setIsSyncing(false)
    }
  }

  async function handleMergeConfirm(result: MergeReviewResult) {
    if (!mergePlan?.suggestion) return
    setIsSyncing(true)
    try {
      await applySync(mergePlan.suggestion, result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sync to profile')
    } finally {
      setIsSyncing(false)
    }
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
                  <button
                    onClick={() => handleSetDefault(resume.id)}
                    title="Use this resume by default when creating new applications"
                    className="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:bg-muted rounded-[--radius] transition-colors whitespace-nowrap"
                  >
                    Set default
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

      {/* Structured editor / raw text modal */}
      {viewingResume && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="bg-card border border-border rounded-[--radius-lg] shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{viewingResume.name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {showRaw ? 'Original extracted text (read-only)' : 'Edit the AI-extracted profile from this resume'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!showRaw && !isFetchingResume && (
                  <button onClick={() => setShowRaw(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronDown size={13} /> Original text
                  </button>
                )}
                <button onClick={closeModal} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-[--radius] transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal body — this is the scroll container (flex-1 + min-h-0 + overflow-y-auto) */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
              {isFetchingResume ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                </div>
              ) : showRaw ? (
                <RawTextView text={viewingResume.parsedText ?? ''} onBack={() => setShowRaw(false)} />
              ) : draft ? (
                <ExtractedDataEditor data={draft} onChange={setDraft} />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  {isReExtracting ? (
                    <>
                      <Loader2 size={20} className="animate-spin text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">Running AI extraction…</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">No structured data yet.</p>
                      <p className="text-xs text-muted-foreground mt-1 mb-4">Extraction may still be running, or it may have failed. Run it manually to see the result (or any error).</p>
                      <button
                        onClick={handleReExtract}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-[--radius] transition-colors"
                      >
                        <RefreshCw size={14} /> Run AI extraction
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Modal footer — re-extract + save structured edits */}
            {!showRaw && !isFetchingResume && draft && (
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-border shrink-0">
                <button
                  onClick={handleReExtract}
                  disabled={isReExtracting || isSavingDraft}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-[--radius] transition-colors disabled:opacity-50"
                  title="Re-run AI extraction from the original text (overwrites current data)"
                >
                  {isReExtracting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Re-extract with AI
                </button>
                <div className="flex items-center gap-3">
                  <button onClick={closeModal} className="px-4 py-2 bg-muted hover:bg-accent border border-border text-foreground rounded-[--radius] text-sm font-medium transition-colors">Close</button>
                  <button
                    onClick={handleSaveDraft}
                    disabled={!isDirty || isSavingDraft}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-[--radius] transition-colors disabled:opacity-40"
                  >
                    {isSavingDraft ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save changes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sync-to-profile confirmation */}
      {syncDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={e => { if (e.target === e.currentTarget && !isSyncing) setSyncDialog(null) }}>
          <div className="bg-card border border-border rounded-[--radius-lg] shadow-xl w-full max-w-md flex flex-col">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <Sparkles size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Sync changes to your profile?</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-muted-foreground">This resume now contains information not yet in your profile:</p>
              <ul className="text-xs text-foreground space-y-1">
                {syncDialog.newSkills.length > 0 && <li>• {syncDialog.newSkills.length} new skill{syncDialog.newSkills.length !== 1 ? 's' : ''}</li>}
                {syncDialog.newExperience.length > 0 && <li>• {syncDialog.newExperience.length} new experience entr{syncDialog.newExperience.length !== 1 ? 'ies' : 'y'}</li>}
                {syncDialog.newEducation.length > 0 && <li>• {syncDialog.newEducation.length} new education entr{syncDialog.newEducation.length !== 1 ? 'ies' : 'y'}</li>}
                {syncDialog.newCertifications.length > 0 && <li>• {syncDialog.newCertifications.length} new certification{syncDialog.newCertifications.length !== 1 ? 's' : ''}</li>}
              </ul>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-border">
              <button onClick={() => setSyncDialog(null)} disabled={isSyncing} className="px-4 py-2 bg-muted hover:bg-accent border border-border text-foreground rounded-[--radius] text-sm font-medium transition-colors disabled:opacity-50">Not now</button>
              <button onClick={handleSync} disabled={isSyncing} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-[--radius] transition-colors disabled:opacity-50">
                {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Sync to profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 2: smart-merge review */}
      {mergePlan?.suggestion && (
        <MergeReview
          matches={mergePlan.merges}
          existing={mergePlan.existingExperience}
          incoming={mergePlan.suggestion.newExperience}
          busy={isSyncing}
          onConfirm={handleMergeConfirm}
          onCancel={() => setMergePlan(null)}
        />
      )}
    </div>
  )
}
