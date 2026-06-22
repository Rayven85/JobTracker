'use client'

import { useState } from 'react'
import type { ProfileCertification } from '@/types'
import { FormModal } from './FormModal'
import { inputCls, labelCls } from './styles'

interface CertificationFormProps {
  initial?: ProfileCertification
  onSubmit: (cert: ProfileCertification) => Promise<void>
  onClose: () => void
}

const empty: ProfileCertification = {
  name: '',
  issuer: null,
  year: null,
}

function parseYear(value: string): number | null {
  const n = parseInt(value, 10)
  return Number.isNaN(n) ? null : n
}

export function CertificationForm({ initial, onSubmit, onClose }: CertificationFormProps) {
  const [form, setForm] = useState<ProfileCertification>(initial ?? empty)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function set<K extends keyof ProfileCertification>(key: K, value: ProfileCertification[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Name is required'); return }
    setIsSubmitting(true)
    try {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        issuer: form.issuer?.trim() || null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <FormModal title={initial ? 'Edit Certification / Award' : 'Add Certification / Award'} error={error} isSubmitting={isSubmitting} onSubmit={handleSubmit} onClose={onClose}>
      <div>
        <label className={labelCls}>Name <span className="text-destructive">*</span></label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="AWS Certified Solutions Architect / First Prize…" className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Issuer</label>
          <input value={form.issuer ?? ''} onChange={e => set('issuer', e.target.value || null)} placeholder="Amazon Web Services / Awarding body" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Year</label>
          <input type="number" value={form.year ?? ''} onChange={e => set('year', parseYear(e.target.value))} placeholder="2023" className={inputCls} />
        </div>
      </div>
    </FormModal>
  )
}
