'use client'

import { useEffect, useState } from 'react'
import { User, Mail, Phone, MapPin, Briefcase, GraduationCap, Award, Zap, Loader2, Sparkles, Check, X, ChevronDown, ChevronUp, RefreshCw, Pencil, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { getProfile, buildProfile, syncResume, dismissResumeSuggestions, updateProfile, getSyncPlan } from '@/lib/api/profile'
import type { UserProfile, ProfileSuggestion, ProfileExperience, ProfileEducation, ProfileCertification, SyncPlan } from '@/types'
import { ExperienceForm } from '@/components/profile-forms/ExperienceForm'
import { EducationForm } from '@/components/profile-forms/EducationForm'
import { CertificationForm } from '@/components/profile-forms/CertificationForm'
import { HeroFieldsForm, type HeroFields } from '@/components/profile-forms/HeroFieldsForm'
import { SkillsEditor } from '@/components/profile-forms/SkillsEditor'
import { descriptionToLines, formatMonthYear } from '@/lib/resume-format'
import { MergeReview, type MergeReviewResult } from '@/components/profile-forms/MergeReview'

const addBtnCls = 'flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-[--radius] transition-colors'
const iconBtnCls = 'p-1 text-muted-foreground hover:text-foreground transition-colors'

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const formatDate = (date: string | null, isCurrent: boolean) => formatMonthYear(date, isCurrent)

// ─── Suggestion Banner ────────────────────────────────────────────────────────

function SuggestionBanner({
  suggestion,
  onAccept,
  onDismiss,
}: {
  suggestion: ProfileSuggestion
  onAccept: (s: ProfileSuggestion, selected: { skills: string[]; expIndices: number[]; education: typeof s.newEducation; certifications: typeof s.newCertifications }) => Promise<void>
  onDismiss: (resumeId: string) => Promise<void>
}) {
  const [open, setOpen] = useState(true)
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set(suggestion.newSkills))
  const [selectedExp, setSelectedExp] = useState<Set<number>>(new Set(suggestion.newExperience.map((_, i) => i)))
  const [selectedEdu, setSelectedEdu] = useState<Set<number>>(new Set(suggestion.newEducation.map((_, i) => i)))
  const [selectedCerts, setSelectedCerts] = useState<Set<number>>(new Set(suggestion.newCertifications.map((_, i) => i)))
  const [isSaving, setIsSaving] = useState(false)

  const totalSelected = selectedSkills.size + selectedExp.size + selectedEdu.size + selectedCerts.size

  async function handleAccept() {
    setIsSaving(true)
    try {
      await onAccept(suggestion, {
        skills: [...selectedSkills],
        expIndices: [...selectedExp],
        education: suggestion.newEducation.filter((_, i) => selectedEdu.has(i)),
        certifications: suggestion.newCertifications.filter((_, i) => selectedCerts.has(i)),
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mb-6 border border-primary/30 bg-primary/5 rounded-[--radius-lg] overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-primary/10 transition-colors"
      >
        <Sparkles size={16} className="text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            New information found in &quot;{suggestion.resumeName}&quot;
          </p>
          <p className="text-xs text-muted-foreground">
            {suggestion.newSkills.length + suggestion.newExperience.length + suggestion.newEducation.length + suggestion.newCertifications.length} items to review
          </p>
        </div>
        {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-4 border-t border-primary/20">
          {suggestion.newSkills.length > 0 && (
            <div className="pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Skills</p>
              <div className="flex flex-wrap gap-2">
                {suggestion.newSkills.map(skill => (
                  <button
                    key={skill}
                    onClick={() => setSelectedSkills(prev => {
                      const next = new Set(prev)
                      next.has(skill) ? next.delete(skill) : next.add(skill)
                      return next
                    })}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selectedSkills.has(skill) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border'}`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>
          )}

          {suggestion.newExperience.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Experience</p>
              <div className="space-y-2">
                {suggestion.newExperience.map((exp, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedExp.has(i)}
                      onChange={() => setSelectedExp(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next })}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{exp.title} <span className="text-muted-foreground font-normal">at {exp.company}</span></p>
                      <p className="text-xs text-muted-foreground">{formatDate(exp.startDate, false)} – {formatDate(exp.endDate, exp.current)}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {suggestion.newEducation.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Education</p>
              <div className="space-y-2">
                {suggestion.newEducation.map((edu, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEdu.has(i)}
                      onChange={() => setSelectedEdu(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next })}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p>
                      <p className="text-xs text-muted-foreground">{edu.institution} · {edu.startYear}–{edu.endYear ?? 'Present'}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {suggestion.newCertifications.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Certifications &amp; Awards</p>
              <div className="space-y-2">
                {suggestion.newCertifications.map((cert, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCerts.has(i)}
                      onChange={() => setSelectedCerts(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next })}
                      className="mt-0.5 accent-primary"
                    />
                    <p className="text-sm text-foreground">{cert.name}{cert.issuer ? ` — ${cert.issuer}` : ''}{cert.year ? ` (${cert.year})` : ''}</p>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-primary/20">
            <button
              onClick={() => onDismiss(suggestion.resumeId)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={13} /> Dismiss all
            </button>
            <button
              onClick={handleAccept}
              disabled={totalSelected === 0 || isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-[--radius] transition-colors disabled:opacity-40"
            >
              {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Add {totalSelected} item{totalSelected !== 1 ? 's' : ''} to profile
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type EditTarget = { index: number | null } | null
type AcceptSelected = Parameters<React.ComponentProps<typeof SuggestionBanner>['onAccept']>[1]

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBuilding, setIsBuilding] = useState(false)
  const [editingHero, setEditingHero] = useState(false)
  const [editingExp, setEditingExp] = useState<EditTarget>(null)
  const [editingEdu, setEditingEdu] = useState<EditTarget>(null)
  const [editingCert, setEditingCert] = useState<EditTarget>(null)
  // Phase 2 smart-merge: context captured when an Accept surfaces AI merge matches.
  const [mergeCtx, setMergeCtx] = useState<{ plan: SyncPlan; suggestion: ProfileSuggestion; selected: AcceptSelected } | null>(null)
  const [isSyncingMerge, setIsSyncingMerge] = useState(false)

  // Single funnel for manual edits. updateProfile's response omits `suggestions`,
  // so preserve the ones already loaded or the banners vanish after an edit.
  async function persist(patch: Parameters<typeof updateProfile>[0]) {
    const updated = await updateProfile(patch)
    setProfile(prev => (prev ? { ...updated, suggestions: prev.suggestions } : updated))
  }

  async function saveHero(fields: HeroFields) {
    await persist(fields)
    toast.success('Profile updated')
  }

  async function saveExperience(exp: ProfileExperience, index: number | null) {
    const arr = [...(profile?.experience ?? [])]
    if (index === null) arr.push(exp)
    else arr[index] = exp
    await persist({ experience: arr })
    toast.success('Experience saved')
  }

  async function saveEducation(edu: ProfileEducation, index: number | null) {
    const arr = [...(profile?.education ?? [])]
    if (index === null) arr.push(edu)
    else arr[index] = edu
    await persist({ education: arr })
    toast.success('Education saved')
  }

  async function saveCertification(cert: ProfileCertification, index: number | null) {
    const arr = [...(profile?.certifications ?? [])]
    if (index === null) arr.push(cert)
    else arr[index] = cert
    await persist({ certifications: arr })
    toast.success('Certification saved')
  }

  async function deleteItem(section: 'experience' | 'education' | 'certifications', index: number, label: string) {
    if (!confirm(`Delete this ${label}?`)) return
    try {
      const arr = (profile?.[section] ?? []).filter((_, i) => i !== index)
      await persist({ [section]: arr } as Parameters<typeof updateProfile>[0])
      toast.success(`${label[0].toUpperCase()}${label.slice(1)} deleted`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  async function saveSkills(next: string[]) {
    try {
      await persist({ skills: next })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update skills')
    }
  }

  async function handleBuild() {
    setIsBuilding(true)
    try {
      const updated = await buildProfile()
      setProfile(updated)
      const count = (updated.suggestions ?? []).length
      toast.success(count > 0 ? 'Review the suggestions below to add them to your profile' : 'Profile is up to date — nothing new in your resumes')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to build profile')
    } finally {
      setIsBuilding(false)
    }
  }

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setIsLoading(false))
  }, [])

  // Apply a sync: append selected new items (minus any merged-away experiences) and
  // overwrite existing entries with smart-merged versions. Removes the now-synced
  // resume's suggestion from the list while preserving the others.
  async function doSync(suggestion: ProfileSuggestion, selected: AcceptSelected, result: MergeReviewResult) {
    const experience = selected.expIndices
      .filter(i => !result.mergedIncomingIndexes.includes(i))
      .map(i => suggestion.newExperience[i])
    const updated = await syncResume(suggestion.resumeId, {
      skills: selected.skills,
      education: selected.education,
      certifications: selected.certifications,
      experience,
      experienceMerges: result.experienceMerges,
    })
    setProfile(prev => ({ ...updated, suggestions: (prev?.suggestions ?? []).filter(s => s.resumeId !== suggestion.resumeId) }))
    setMergeCtx(null)
    toast.success('Profile updated')
  }

  async function handleAccept(suggestion: ProfileSuggestion, selected: AcceptSelected) {
    try {
      const plan = await getSyncPlan(suggestion.resumeId)
      const relevant = plan.merges.filter(m => selected.expIndices.includes(m.incomingIndex))
      if (plan.suggestion && relevant.length > 0) {
        // Pause and let the user review the proposed merges.
        setMergeCtx({ plan: { ...plan, merges: relevant }, suggestion, selected })
        return
      }
      await doSync(suggestion, selected, { experienceMerges: [], mergedIncomingIndexes: [] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile')
    }
  }

  async function handleMergeConfirm(result: MergeReviewResult) {
    if (!mergeCtx) return
    setIsSyncingMerge(true)
    try {
      await doSync(mergeCtx.suggestion, mergeCtx.selected, result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setIsSyncingMerge(false)
    }
  }

  async function handleDismiss(resumeId: string) {
    try {
      await dismissResumeSuggestions(resumeId)
      setProfile(prev => prev ? { ...prev, suggestions: (prev.suggestions ?? []).filter(s => s.resumeId !== resumeId) } : null)
      toast.success('Suggestions dismissed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to dismiss')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile) return null

  const isEmpty = !profile.name && !profile.summary && !profile.skills.length && !profile.experience.length && !profile.education.length

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profile</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your aggregated career profile — built from your uploaded resumes</p>
        </div>
        <button
          onClick={handleBuild}
          disabled={isBuilding}
          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-[--radius] transition-colors disabled:opacity-50"
          title="Re-extract profile data from all resumes"
        >
          {isBuilding ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {isBuilding ? 'Building…' : 'Build from resumes'}
        </button>
      </div>

      {/* Suggestion banners */}
      {(profile.suggestions ?? []).map(s => (
        <SuggestionBanner key={s.resumeId} suggestion={s} onAccept={handleAccept} onDismiss={handleDismiss} />
      ))}

      {isEmpty && !(profile.suggestions ?? []).length && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-[--radius-lg] border border-dashed border-border bg-muted/40">
          <Sparkles size={16} className="text-primary shrink-0" />
          <p className="text-xs text-muted-foreground flex-1">
            Your profile is empty. Click <span className="font-medium text-foreground">Build from resumes</span> above, or add entries manually below.
          </p>
        </div>
      )}

      <div className="space-y-5">
        {/* Hero card */}
        <div className="bg-card border border-border rounded-[--radius-lg] p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-lg font-bold text-primary">
              {initials(profile.name)}
            </div>
            <div className="flex-1 min-w-0">
              {profile.name
                ? <h2 className="text-xl font-bold text-foreground">{profile.name}</h2>
                : <h2 className="text-xl font-bold text-muted-foreground/60">Add your details</h2>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                {profile.email && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail size={12} /> {profile.email}
                  </span>
                )}
                {profile.phone && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone size={12} /> {profile.phone}
                  </span>
                )}
                {profile.location && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin size={12} /> {profile.location}
                  </span>
                )}
              </div>
              {profile.summary && (
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{profile.summary}</p>
              )}
            </div>
            <button onClick={() => setEditingHero(true)} className={iconBtnCls} title="Edit details">
              <Pencil size={15} />
            </button>
          </div>
        </div>

        {/* Skills */}
        <div className="bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={15} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Skills</h3>
          </div>
          <SkillsEditor skills={profile.skills} onChange={saveSkills} />
        </div>

        {/* Experience */}
        <div className="bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Briefcase size={15} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Experience</h3>
            </div>
            <button onClick={() => setEditingExp({ index: null })} className={addBtnCls}><Plus size={13} /> Add</button>
          </div>
          {profile.experience.length === 0
            ? <p className="text-xs text-muted-foreground">No experience yet.</p>
            : (
              <div className="space-y-5">
                {profile.experience.map((exp, i) => (
                  <div key={i} className="relative pl-4 border-l-2 border-border last:border-transparent group">
                    <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-primary" />
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{exp.title || exp.company}</p>
                        {(() => {
                          const sub = [exp.company && exp.company !== exp.title ? exp.company : null, exp.location].filter(Boolean).join(' · ')
                          return sub ? <p className="text-sm text-muted-foreground">{sub}</p> : null
                        })()}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {formatDate(exp.startDate, false)}{exp.startDate || exp.endDate || exp.current ? ' – ' : ''}{formatDate(exp.endDate, exp.current)}
                        </p>
                        <button onClick={() => setEditingExp({ index: i })} className={`${iconBtnCls} opacity-0 group-hover:opacity-100`} title="Edit"><Pencil size={13} /></button>
                        <button onClick={() => deleteItem('experience', i, 'experience')} className={`${iconBtnCls} hover:text-destructive opacity-0 group-hover:opacity-100`} title="Delete"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    {descriptionToLines(exp.description).length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {descriptionToLines(exp.description).map((line, j) => (
                          <li key={j} className="text-xs text-muted-foreground leading-relaxed">
                            {line.startsWith('•') ? line : `• ${line}`}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Education */}
        <div className="bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <GraduationCap size={15} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Education</h3>
            </div>
            <button onClick={() => setEditingEdu({ index: null })} className={addBtnCls}><Plus size={13} /> Add</button>
          </div>
          {profile.education.length === 0
            ? <p className="text-xs text-muted-foreground">No education yet.</p>
            : (
              <div className="space-y-4">
                {profile.education.map((edu, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 group">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{edu.institution}</p>
                      <p className="text-sm text-muted-foreground">{edu.degree}{edu.field ? ` · ${edu.field}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {(edu.startYear || edu.endYear) && (
                        <p className="text-xs text-muted-foreground">{edu.startYear}{edu.endYear ? ` – ${edu.endYear}` : ''}</p>
                      )}
                      <button onClick={() => setEditingEdu({ index: i })} className={`${iconBtnCls} opacity-0 group-hover:opacity-100`} title="Edit"><Pencil size={13} /></button>
                      <button onClick={() => deleteItem('education', i, 'education')} className={`${iconBtnCls} hover:text-destructive opacity-0 group-hover:opacity-100`} title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Certifications */}
        <div className="bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award size={15} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Certifications &amp; Awards</h3>
            </div>
            <button onClick={() => setEditingCert({ index: null })} className={addBtnCls}><Plus size={13} /> Add</button>
          </div>
          {profile.certifications.length === 0
            ? <p className="text-xs text-muted-foreground">No certifications or awards yet.</p>
            : (
              <div className="space-y-2">
                {profile.certifications.map((cert, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div>
                      <p className="text-sm font-medium text-foreground">{cert.name}</p>
                      {cert.issuer && <p className="text-xs text-muted-foreground">{cert.issuer}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {cert.year && <p className="text-xs text-muted-foreground">{cert.year}</p>}
                      <button onClick={() => setEditingCert({ index: i })} className={`${iconBtnCls} opacity-0 group-hover:opacity-100`} title="Edit"><Pencil size={13} /></button>
                      <button onClick={() => deleteItem('certifications', i, 'certification')} className={`${iconBtnCls} hover:text-destructive opacity-0 group-hover:opacity-100`} title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* Edit modals */}
      {editingHero && (
        <HeroFieldsForm
          initial={{ name: profile.name, email: profile.email, phone: profile.phone, location: profile.location, summary: profile.summary }}
          onSubmit={saveHero}
          onClose={() => setEditingHero(false)}
        />
      )}
      {editingExp && (
        <ExperienceForm
          initial={editingExp.index !== null ? profile.experience[editingExp.index] : undefined}
          onSubmit={exp => saveExperience(exp, editingExp.index)}
          onClose={() => setEditingExp(null)}
        />
      )}
      {editingEdu && (
        <EducationForm
          initial={editingEdu.index !== null ? profile.education[editingEdu.index] : undefined}
          onSubmit={edu => saveEducation(edu, editingEdu.index)}
          onClose={() => setEditingEdu(null)}
        />
      )}
      {editingCert && (
        <CertificationForm
          initial={editingCert.index !== null ? profile.certifications[editingCert.index] : undefined}
          onSubmit={cert => saveCertification(cert, editingCert.index)}
          onClose={() => setEditingCert(null)}
        />
      )}

      {/* Phase 2: smart-merge review */}
      {mergeCtx && (
        <MergeReview
          matches={mergeCtx.plan.merges}
          existing={mergeCtx.plan.existingExperience}
          incoming={mergeCtx.suggestion.newExperience}
          busy={isSyncingMerge}
          onConfirm={handleMergeConfirm}
          onCancel={() => setMergeCtx(null)}
        />
      )}
    </div>
  )
}
