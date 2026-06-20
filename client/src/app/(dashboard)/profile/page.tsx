'use client'

import { useEffect, useState } from 'react'
import { User, Mail, Phone, MapPin, Briefcase, GraduationCap, Award, Zap, Loader2, Sparkles, Check, X, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { getProfile, buildProfile, syncResume, dismissResumeSuggestions } from '@/lib/api/profile'
import type { UserProfile, ProfileSuggestion } from '@/types'

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(date: string | null, isCurrent: boolean) {
  if (isCurrent) return 'Present'
  if (!date) return ''
  const [year, month] = date.split('-')
  const d = new Date(Number(year), Number(month) - 1)
  return d.toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' })
}

// ─── Suggestion Banner ────────────────────────────────────────────────────────

function SuggestionBanner({
  suggestion,
  onAccept,
  onDismiss,
}: {
  suggestion: ProfileSuggestion
  onAccept: (s: ProfileSuggestion, selected: { skills: string[]; experience: typeof s.newExperience; education: typeof s.newEducation; certifications: typeof s.newCertifications }) => Promise<void>
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
        experience: suggestion.newExperience.filter((_, i) => selectedExp.has(i)),
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
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Certifications</p>
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

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBuilding, setIsBuilding] = useState(false)

  async function handleBuild() {
    setIsBuilding(true)
    try {
      const updated = await buildProfile()
      setProfile(updated)
      toast.success('Profile built from your resumes')
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

  async function handleAccept(suggestion: ProfileSuggestion, selected: Parameters<React.ComponentProps<typeof SuggestionBanner>['onAccept']>[1]) {
    try {
      const updated = await syncResume(suggestion.resumeId, selected)
      setProfile(updated as UserProfile & { suggestions: ProfileSuggestion[] })
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile')
    }
  }

  async function handleDismiss(resumeId: string) {
    try {
      await dismissResumeSuggestions(resumeId)
      setProfile(prev => prev ? { ...prev, suggestions: prev.suggestions.filter(s => s.resumeId !== resumeId) } : null)
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
      {profile.suggestions.map(s => (
        <SuggestionBanner key={s.resumeId} suggestion={s} onAccept={handleAccept} onDismiss={handleDismiss} />
      ))}

      {isEmpty && !profile.suggestions.length ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <User size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">No profile yet</h3>
          <p className="text-sm text-muted-foreground mb-5">Click &quot;Build from resumes&quot; above to extract your profile from uploaded resumes.</p>
          <button
            onClick={handleBuild}
            disabled={isBuilding}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-[--radius] transition-colors disabled:opacity-50"
          >
            {isBuilding ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {isBuilding ? 'Building profile…' : 'Build my profile'}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Hero card */}
          {(profile.name || profile.email || profile.phone || profile.location || profile.summary) && (
            <div className="bg-card border border-border rounded-[--radius-lg] p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-lg font-bold text-primary">
                  {initials(profile.name)}
                </div>
                <div className="flex-1 min-w-0">
                  {profile.name && <h2 className="text-xl font-bold text-foreground">{profile.name}</h2>}
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
              </div>
            </div>
          )}

          {/* Skills */}
          {profile.skills.length > 0 && (
            <div className="bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={15} className="text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Skills</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map(skill => (
                  <span key={skill} className="px-2.5 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Experience */}
          {profile.experience.length > 0 && (
            <div className="bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Briefcase size={15} className="text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Experience</h3>
              </div>
              <div className="space-y-5">
                {profile.experience.map((exp, i) => (
                  <div key={i} className="relative pl-4 border-l-2 border-border last:border-transparent">
                    <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-primary" />
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{exp.title}</p>
                        <p className="text-sm text-muted-foreground">{exp.company}{exp.location ? ` · ${exp.location}` : ''}</p>
                      </div>
                      <p className="text-xs text-muted-foreground shrink-0">
                        {formatDate(exp.startDate, false)}{exp.startDate || exp.endDate || exp.current ? ' – ' : ''}{formatDate(exp.endDate, exp.current)}
                      </p>
                    </div>
                    {exp.description && (
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{exp.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {profile.education.length > 0 && (
            <div className="bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap size={15} className="text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Education</h3>
              </div>
              <div className="space-y-4">
                {profile.education.map((edu, i) => (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{edu.institution}</p>
                      <p className="text-sm text-muted-foreground">{edu.degree}{edu.field ? ` · ${edu.field}` : ''}</p>
                    </div>
                    {(edu.startYear || edu.endYear) && (
                      <p className="text-xs text-muted-foreground shrink-0">{edu.startYear}{edu.endYear ? ` – ${edu.endYear}` : ''}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications */}
          {profile.certifications.length > 0 && (
            <div className="bg-card border border-border rounded-[--radius-lg] p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Award size={15} className="text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Certifications</h3>
              </div>
              <div className="space-y-2">
                {profile.certifications.map((cert, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{cert.name}</p>
                      {cert.issuer && <p className="text-xs text-muted-foreground">{cert.issuer}</p>}
                    </div>
                    {cert.year && <p className="text-xs text-muted-foreground shrink-0">{cert.year}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
