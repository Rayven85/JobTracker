'use client'

import { useState } from 'react'
import { Loader2, GitMerge, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExperienceMergeMatch, ProfileExperience } from '@/types'
import { inputCls, primaryBtn, secondaryBtn } from './styles'
import { descriptionToLines } from '@/lib/resume-format'

export interface MergeReviewResult {
  experienceMerges: { existingIndex: number; merged: ProfileExperience }[]
  mergedIncomingIndexes: number[]
}

interface MergeReviewProps {
  matches: ExperienceMergeMatch[]
  existing: ProfileExperience[]
  incoming: ProfileExperience[]
  busy?: boolean
  onConfirm: (result: MergeReviewResult) => void
  onCancel: () => void
}

function Bullets({ description }: { description: string }) {
  const lines = descriptionToLines(description)
  if (lines.length === 0) return <p className="text-xs text-muted-foreground italic">No description</p>
  return (
    <ul className="space-y-0.5">
      {lines.map((line, i) => (
        <li key={i} className="text-xs text-muted-foreground leading-relaxed">{line.startsWith('•') ? line : `• ${line}`}</li>
      ))}
    </ul>
  )
}

// Phase 2: lets the user review AI-proposed merges (same role/project under different
// titles across resumes), edit the merged description, and accept or keep them separate.
export function MergeReview({ matches, existing, incoming, busy, onConfirm, onCancel }: MergeReviewProps) {
  // Per-match local state keyed by array position.
  const [accepted, setAccepted] = useState<boolean[]>(() => matches.map(() => true))
  const [descriptions, setDescriptions] = useState<string[]>(() => matches.map(m => m.merged.description))

  function confirm() {
    const experienceMerges: MergeReviewResult['experienceMerges'] = []
    const mergedIncomingIndexes: number[] = []
    matches.forEach((m, i) => {
      if (!accepted[i]) return
      experienceMerges.push({ existingIndex: m.existingIndex, merged: { ...m.merged, description: descriptions[i] } })
      mergedIncomingIndexes.push(m.incomingIndex)
    })
    onConfirm({ experienceMerges, mergedIncomingIndexes })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={e => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="bg-card border border-border rounded-[--radius-lg] shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border shrink-0">
          <GitMerge size={16} className="text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Possible duplicate experiences</h2>
            <p className="text-xs text-muted-foreground mt-0.5">These look like the same role/project under different names. Merge them, or keep separate.</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {matches.map((m, i) => {
            const ex = existing[m.existingIndex]
            const inc = incoming[m.incomingIndex]
            const isMerge = accepted[i]
            return (
              <div key={i} className="border border-border rounded-[--radius] p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-medium text-muted-foreground">Match confidence: {Math.round(m.confidence * 100)}%</span>
                  <div className="flex items-center gap-1 bg-muted rounded-[--radius] p-0.5">
                    <button
                      onClick={() => setAccepted(prev => prev.map((v, j) => j === i ? true : v))}
                      className={cn('px-2.5 py-1 text-xs font-medium rounded-[calc(var(--radius)-2px)] transition-colors', isMerge ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
                    >
                      Merge
                    </button>
                    <button
                      onClick={() => setAccepted(prev => prev.map((v, j) => j === i ? false : v))}
                      className={cn('px-2.5 py-1 text-xs font-medium rounded-[calc(var(--radius)-2px)] transition-colors', !isMerge ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
                    >
                      Keep separate
                    </button>
                  </div>
                </div>

                {/* Existing vs incoming */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start mb-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">In your profile</p>
                    <p className="text-xs font-semibold text-foreground">{ex?.title || ex?.company}</p>
                    {ex?.company && ex.company !== ex.title && <p className="text-[11px] text-muted-foreground">{ex.company}</p>}
                  </div>
                  <ArrowRight size={14} className="text-muted-foreground mt-4" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">From this resume</p>
                    <p className="text-xs font-semibold text-foreground">{inc?.title || inc?.company}</p>
                    {inc?.company && inc.company !== inc.title && <p className="text-[11px] text-muted-foreground">{inc.company}</p>}
                  </div>
                </div>

                {isMerge ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Merged result — {m.merged.title}{m.merged.company && m.merged.company !== m.merged.title ? ` · ${m.merged.company}` : ''}</p>
                    <textarea
                      value={descriptions[i]}
                      onChange={e => setDescriptions(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                      rows={6}
                      className={cn(inputCls, 'resize-none font-mono text-xs leading-relaxed')}
                    />
                    {m.reason && <p className="text-[11px] text-muted-foreground mt-1">Why: {m.reason}</p>}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Both will be kept as separate entries.</p>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-border shrink-0">
          <button onClick={onCancel} disabled={busy} className={secondaryBtn}>Cancel</button>
          <button onClick={confirm} disabled={busy} className={primaryBtn}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
            Apply &amp; sync
          </button>
        </div>
      </div>
    </div>
  )
}
