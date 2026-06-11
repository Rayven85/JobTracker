'use client'

import { useEffect, useState, useRef } from 'react'
import { Upload, Trash2, Star, FileText, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { listResumes, getPresignedUrl, uploadToS3, confirmUpload, setDefaultResume, deleteResume } from '@/lib/api/resumes'
import type { Resume } from '@/types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export default function ResumesPage() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listResumes()
      .then(setResumes)
      .catch(() => toast.error('Failed to load resumes'))
      .finally(() => setIsLoading(false))
  }, [])

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

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Resumes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{resumes.length} uploaded</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileSelect}
            className="hidden"
            id="resume-upload"
          />
          <label
            htmlFor="resume-upload"
            className={`flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-[--radius] text-sm font-medium transition-colors cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {isUploading ? (
              <><Loader2 size={15} className="animate-spin" /> {uploadProgress || 'Uploading…'}</>
            ) : (
              <><Upload size={15} /> Upload PDF</>
            )}
          </label>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-[--radius-lg] h-20 animate-pulse" />
          ))}
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
                  {resume.isDefault && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium shrink-0">Default</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{resume.fileName} · {formatBytes(resume.fileSize)}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(resume.createdAt).toLocaleDateString('en-NZ', { dateStyle: 'medium' })}
                  {' · '}
                  {resume.parsedText ? (
                    <span className="text-emerald-600 inline-flex items-center gap-1">
                      <CheckCircle2 size={11} /> Text extracted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <Loader2 size={11} className="animate-spin" /> Processing…
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!resume.isDefault && (
                  <button
                    onClick={() => handleSetDefault(resume.id)}
                    title="Set as default"
                    className="p-2 text-muted-foreground hover:text-amber-500 hover:bg-muted rounded-[--radius] transition-colors"
                  >
                    <Star size={15} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(resume.id)}
                  title="Delete"
                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-muted rounded-[--radius] transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
