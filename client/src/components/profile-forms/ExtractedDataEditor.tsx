'use client'

import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import type { ExtractedData, ProfileExperience, ProfileEducation, ProfileCertification } from '@/types'
import { ExperienceForm } from './ExperienceForm'
import { EducationForm } from './EducationForm'
import { CertificationForm } from './CertificationForm'
import { HeroFieldsForm, type HeroFields } from './HeroFieldsForm'
import { SkillsEditor } from './SkillsEditor'
import { descriptionToLines, formatMonthYear } from '@/lib/resume-format'

type EditTarget = { index: number | null } | null

const addBtnCls = 'flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-[--radius] transition-colors'
const iconBtnCls = 'p-1 text-muted-foreground hover:text-foreground transition-colors'

const formatDate = (date: string | null, isCurrent: boolean) => formatMonthYear(date, isCurrent)

// Self-contained editor for a resume's structured (AI-extracted) data.
// Holds its own edit-modal state; emits the full updated object via onChange.
export function ExtractedDataEditor({ data, onChange }: { data: ExtractedData; onChange: (next: ExtractedData) => void }) {
  const [editingHero, setEditingHero] = useState(false)
  const [editingExp, setEditingExp] = useState<EditTarget>(null)
  const [editingEdu, setEditingEdu] = useState<EditTarget>(null)
  const [editingCert, setEditingCert] = useState<EditTarget>(null)

  async function saveHero(fields: HeroFields) {
    onChange({ ...data, ...fields })
  }

  async function saveExperience(exp: ProfileExperience, index: number | null) {
    const arr = [...data.experience]
    if (index === null) arr.push(exp); else arr[index] = exp
    onChange({ ...data, experience: arr })
  }

  async function saveEducation(edu: ProfileEducation, index: number | null) {
    const arr = [...data.education]
    if (index === null) arr.push(edu); else arr[index] = edu
    onChange({ ...data, education: arr })
  }

  async function saveCertification(cert: ProfileCertification, index: number | null) {
    const arr = [...data.certifications]
    if (index === null) arr.push(cert); else arr[index] = cert
    onChange({ ...data, certifications: arr })
  }

  function deleteExp(i: number) { if (confirm('Delete this experience?')) onChange({ ...data, experience: data.experience.filter((_, j) => j !== i) }) }
  function deleteEdu(i: number) { if (confirm('Delete this education?')) onChange({ ...data, education: data.education.filter((_, j) => j !== i) }) }
  function deleteCert(i: number) { if (confirm('Delete this certification?')) onChange({ ...data, certifications: data.certifications.filter((_, j) => j !== i) }) }

  return (
    <div className="space-y-5 pr-1">
      {/* Identity */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {data.name
            ? <p className="text-base font-bold text-foreground">{data.name}</p>
            : <p className="text-base font-bold text-muted-foreground/60">Add your details</p>}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {data.email && <p className="text-xs text-muted-foreground">{data.email}</p>}
            {data.phone && <p className="text-xs text-muted-foreground">{data.phone}</p>}
            {data.location && <p className="text-xs text-muted-foreground">{data.location}</p>}
          </div>
          {data.summary && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{data.summary}</p>}
        </div>
        <button onClick={() => setEditingHero(true)} className={iconBtnCls} title="Edit details"><Pencil size={14} /></button>
      </div>

      {/* Skills */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Skills</p>
        <SkillsEditor skills={data.skills} onChange={skills => onChange({ ...data, skills })} />
      </div>

      {/* Experience */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Experience</p>
          <button onClick={() => setEditingExp({ index: null })} className={addBtnCls}><Plus size={12} /> Add</button>
        </div>
        {data.experience.length === 0
          ? <p className="text-xs text-muted-foreground">None.</p>
          : (
            <div className="space-y-3">
              {data.experience.map((exp, i) => (
                <div key={i} className="border-l-2 border-border pl-3 group">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{exp.title || exp.company}</p>
                      {(() => {
                        const sub = [exp.company && exp.company !== exp.title ? exp.company : null, exp.location].filter(Boolean).join(' · ')
                        return sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null
                      })()}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {formatDate(exp.startDate, false)}{(exp.startDate || exp.endDate || exp.current) ? ' – ' : ''}{formatDate(exp.endDate, exp.current)}
                      </p>
                      <button onClick={() => setEditingExp({ index: i })} className={`${iconBtnCls} opacity-0 group-hover:opacity-100`} title="Edit"><Pencil size={12} /></button>
                      <button onClick={() => deleteExp(i)} className={`${iconBtnCls} hover:text-destructive opacity-0 group-hover:opacity-100`} title="Delete"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  {descriptionToLines(exp.description).length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {descriptionToLines(exp.description).map((line, j) => (
                        <li key={j} className="text-xs text-muted-foreground leading-relaxed">{line.startsWith('•') ? line : `• ${line}`}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Education */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Education</p>
          <button onClick={() => setEditingEdu({ index: null })} className={addBtnCls}><Plus size={12} /> Add</button>
        </div>
        {data.education.length === 0
          ? <p className="text-xs text-muted-foreground">None.</p>
          : (
            <div className="space-y-2">
              {data.education.map((edu, i) => (
                <div key={i} className="flex items-start justify-between gap-2 group">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{edu.institution}</p>
                    <p className="text-xs text-muted-foreground">{edu.degree}{edu.field ? ` · ${edu.field}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(edu.startYear || edu.endYear) && <p className="text-xs text-muted-foreground">{edu.startYear}{edu.endYear ? `–${edu.endYear}` : ''}</p>}
                    <button onClick={() => setEditingEdu({ index: i })} className={`${iconBtnCls} opacity-0 group-hover:opacity-100`} title="Edit"><Pencil size={12} /></button>
                    <button onClick={() => deleteEdu(i)} className={`${iconBtnCls} hover:text-destructive opacity-0 group-hover:opacity-100`} title="Delete"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Certifications */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Certifications &amp; Awards</p>
          <button onClick={() => setEditingCert({ index: null })} className={addBtnCls}><Plus size={12} /> Add</button>
        </div>
        {data.certifications.length === 0
          ? <p className="text-xs text-muted-foreground">None.</p>
          : (
            <div className="space-y-1.5">
              {data.certifications.map((c, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <p className="text-sm text-foreground">{c.name}{c.issuer ? ` — ${c.issuer}` : ''}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    {c.year && <p className="text-xs text-muted-foreground">{c.year}</p>}
                    <button onClick={() => setEditingCert({ index: i })} className={`${iconBtnCls} opacity-0 group-hover:opacity-100`} title="Edit"><Pencil size={12} /></button>
                    <button onClick={() => deleteCert(i)} className={`${iconBtnCls} hover:text-destructive opacity-0 group-hover:opacity-100`} title="Delete"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Edit modals */}
      {editingHero && (
        <HeroFieldsForm
          initial={{ name: data.name, email: data.email, phone: data.phone, location: data.location, summary: data.summary }}
          onSubmit={saveHero}
          onClose={() => setEditingHero(false)}
        />
      )}
      {editingExp && (
        <ExperienceForm
          initial={editingExp.index !== null ? data.experience[editingExp.index] : undefined}
          onSubmit={exp => saveExperience(exp, editingExp.index)}
          onClose={() => setEditingExp(null)}
        />
      )}
      {editingEdu && (
        <EducationForm
          initial={editingEdu.index !== null ? data.education[editingEdu.index] : undefined}
          onSubmit={edu => saveEducation(edu, editingEdu.index)}
          onClose={() => setEditingEdu(null)}
        />
      )}
      {editingCert && (
        <CertificationForm
          initial={editingCert.index !== null ? data.certifications[editingCert.index] : undefined}
          onSubmit={cert => saveCertification(cert, editingCert.index)}
          onClose={() => setEditingCert(null)}
        />
      )}
    </div>
  )
}
