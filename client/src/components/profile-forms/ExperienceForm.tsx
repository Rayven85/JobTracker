'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ProfileExperience } from '@/types'
import { FormModal } from './FormModal'
import { inputCls, labelCls } from './styles'

interface ExperienceFormProps {
  initial?: ProfileExperience
  onSubmit: (exp: ProfileExperience) => Promise<void>
  onClose: () => void
}

const empty: ProfileExperience = {
  company: '',
  title: '',
  location: null,
  startDate: null,
  endDate: null,
  current: false,
  description: '',
}

export function ExperienceForm({ initial, onSubmit, onClose }: ExperienceFormProps) {
  const [form, setForm] = useState<ProfileExperience>(initial ?? empty)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function set<K extends keyof ProfileExperience>(key: K, value: ProfileExperience[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.company.trim()) { setError('Company is required'); return }
    if (!form.title.trim()) { setError('Title is required'); return }
    setIsSubmitting(true)
    try {
      await onSubmit({
        ...form,
        company: form.company.trim(),
        title: form.title.trim(),
        location: form.location?.trim() || null,
        endDate: form.current ? null : form.endDate,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <FormModal title={initial ? 'Edit Experience' : 'Add Experience'} error={error} isSubmitting={isSubmitting} onSubmit={handleSubmit} onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>Title <span className="text-destructive">*</span></label>
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Full-Stack Developer" className={inputCls} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>Company <span className="text-destructive">*</span></label>
          <input value={form.company} onChange={e => set('company', e.target.value)} placeholder="Mermaid Sushi Cafe" className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Location</label>
        <input value={form.location ?? ''} onChange={e => set('location', e.target.value || null)} placeholder="Auckland, NZ" className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Start (YYYY-MM)</label>
          <input value={form.startDate ?? ''} onChange={e => set('startDate', e.target.value || null)} placeholder="2023-01" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>End (YYYY-MM)</label>
          <input
            value={form.endDate ?? ''}
            onChange={e => set('endDate', e.target.value || null)}
            placeholder="2024-06"
            disabled={form.current}
            className={cn(inputCls, form.current && 'opacity-50 cursor-not-allowed')}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={form.current} onChange={e => set('current', e.target.checked)} className="rounded" />
        <span className="text-sm text-foreground">I currently work here</span>
      </label>

      <div>
        <label className={labelCls}>Description</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          rows={8}
          placeholder={'One bullet per line, e.g.\n• Built a bilingual website with Next.js, React, TypeScript\n• Reduced load time by 40% via image optimization'}
          className={cn(inputCls, 'resize-none font-mono text-xs leading-relaxed')}
        />
        <p className="text-[11px] text-muted-foreground mt-1">One achievement per line. Keep all the detail — it feeds JD-tailored resume generation.</p>
      </div>
    </FormModal>
  )
}
