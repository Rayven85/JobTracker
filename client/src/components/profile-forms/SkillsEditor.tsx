'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { inputCls } from './styles'

interface SkillsEditorProps {
  skills: string[]
  onChange: (next: string[]) => void
}

// Inline chip editor. Case-insensitive dedupe to match server syncResume Set behavior.
export function SkillsEditor({ skills, onChange }: SkillsEditorProps) {
  const [input, setInput] = useState('')

  function add() {
    const value = input.trim()
    if (!value) return
    const exists = skills.some(s => s.toLowerCase() === value.toLowerCase())
    if (!exists) onChange([...skills, value])
    setInput('')
  }

  function remove(skill: string) {
    onChange(skills.filter(s => s.toLowerCase() !== skill.toLowerCase()))
  }

  // De-duplicate for display (AI extraction can yield repeats like "SQL" / "sql")
  // so React keys stay unique and chips aren't shown twice.
  const seen = new Set<string>()
  const uniqueSkills = skills.filter(s => {
    const k = s.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {uniqueSkills.map(skill => (
          <span key={skill} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs text-foreground">
            {skill}
            <button onClick={() => remove(skill)} className="text-muted-foreground hover:text-destructive transition-colors" aria-label={`Remove ${skill}`}>
              <X size={12} />
            </button>
          </span>
        ))}
        {skills.length === 0 && <p className="text-xs text-muted-foreground">No skills yet.</p>}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Add a skill and press Enter"
          className={inputCls}
        />
        <button
          onClick={add}
          className="flex items-center gap-1 px-3 py-2 bg-muted hover:bg-accent border border-border text-foreground rounded-[--radius] text-sm font-medium transition-colors shrink-0"
        >
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  )
}
