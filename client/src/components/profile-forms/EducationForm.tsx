'use client'

import { useState } from 'react'
import type { ProfileEducation } from '@/types'
import { FormModal } from './FormModal'
import { inputCls, labelCls } from './styles'

interface EducationFormProps {
  initial?: ProfileEducation
  onSubmit: (edu: ProfileEducation) => Promise<void>
  onClose: () => void
}

const empty: ProfileEducation = {
  institution: '',
  degree: '',
  field: null,
  startYear: null,
  endYear: null,
}

// Parse a year input to int|null — never NaN (server validates int().nullable()).
function parseYear(value: string): number | null {
  const n = parseInt(value, 10)
  return Number.isNaN(n) ? null : n
}

export function EducationForm({ initial, onSubmit, onClose }: EducationFormProps) {
  const [form, setForm] = useState<ProfileEducation>(initial ?? empty)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function set<K extends keyof ProfileEducation>(key: K, value: ProfileEducation[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.institution.trim()) { setError('Institution is required'); return }
    if (!form.degree.trim()) { setError('Degree is required'); return }
    setIsSubmitting(true)
    try {
      await onSubmit({
        ...form,
        institution: form.institution.trim(),
        degree: form.degree.trim(),
        field: form.field?.trim() || null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <FormModal title={initial ? 'Edit Education' : 'Add Education'} error={error} isSubmitting={isSubmitting} onSubmit={handleSubmit} onClose={onClose}>
      <div>
        <label className={labelCls}>Institution <span className="text-destructive">*</span></label>
        <input value={form.institution} onChange={e => set('institution', e.target.value)} placeholder="University of Auckland" className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Degree <span className="text-destructive">*</span></label>
          <input value={form.degree} onChange={e => set('degree', e.target.value)} placeholder="Bachelor of Science" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Field</label>
          <input value={form.field ?? ''} onChange={e => set('field', e.target.value || null)} placeholder="Computer Science" className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Start Year</label>
          <input type="number" value={form.startYear ?? ''} onChange={e => set('startYear', parseYear(e.target.value))} placeholder="2018" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>End Year</label>
          <input type="number" value={form.endYear ?? ''} onChange={e => set('endYear', parseYear(e.target.value))} placeholder="2022" className={inputCls} />
        </div>
      </div>
    </FormModal>
  )
}
