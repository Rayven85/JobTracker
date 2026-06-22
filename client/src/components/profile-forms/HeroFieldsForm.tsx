'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { UserProfile } from '@/types'
import { FormModal } from './FormModal'
import { inputCls, labelCls } from './styles'

export type HeroFields = Pick<UserProfile, 'name' | 'email' | 'phone' | 'location' | 'summary'>

interface HeroFieldsFormProps {
  initial: HeroFields
  onSubmit: (fields: HeroFields) => Promise<void>
  onClose: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function HeroFieldsForm({ initial, onSubmit, onClose }: HeroFieldsFormProps) {
  const [form, setForm] = useState<HeroFields>(initial)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function set<K extends keyof HeroFields>(key: K, value: HeroFields[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.email && !EMAIL_RE.test(form.email)) { setError('Email is invalid'); return }
    setIsSubmitting(true)
    try {
      await onSubmit({
        name: form.name?.trim() || null,
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        location: form.location?.trim() || null,
        summary: form.summary?.trim() || null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <FormModal title="Edit Details" error={error} isSubmitting={isSubmitting} onSubmit={handleSubmit} onClose={onClose}>
      <div>
        <label className={labelCls}>Name</label>
        <input value={form.name ?? ''} onChange={e => set('name', e.target.value || null)} placeholder="Rayven Zhao" className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Email</label>
          <input value={form.email ?? ''} onChange={e => set('email', e.target.value || null)} placeholder="you@example.com" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input value={form.phone ?? ''} onChange={e => set('phone', e.target.value || null)} placeholder="+64 21 123 4567" className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Location</label>
        <input value={form.location ?? ''} onChange={e => set('location', e.target.value || null)} placeholder="Auckland, NZ" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Summary</label>
        <textarea
          value={form.summary ?? ''}
          onChange={e => set('summary', e.target.value || null)}
          rows={4}
          placeholder="A short professional summary…"
          className={cn(inputCls, 'resize-none')}
        />
      </div>
    </FormModal>
  )
}
