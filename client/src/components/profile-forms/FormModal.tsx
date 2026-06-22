'use client'

import { X, Loader2 } from 'lucide-react'
import { primaryBtn, secondaryBtn } from './styles'

interface FormModalProps {
  title: string
  error?: string
  isSubmitting: boolean
  submitLabel?: string
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  children: React.ReactNode
}

// Shared modal shell (overlay + header/body/footer) matching ApplicationForm.tsx conventions.
export function FormModal({ title, error, isSubmitting, submitLabel = 'Save', onSubmit, onClose, children }: FormModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-card border border-border rounded-[--radius-xl] shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div role="alert" className="rounded-[--radius] bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {children}
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          <button type="button" onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button onClick={onSubmit} disabled={isSubmitting} className={primaryBtn}>
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
