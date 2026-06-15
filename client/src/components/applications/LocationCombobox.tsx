'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

// Common NZ locations for the target market. The field stays free-text:
// the user can type any value, these are just searchable suggestions.
const LOCATION_OPTIONS = [
  'Auckland, NZ',
  'Wellington, NZ',
  'Christchurch, NZ',
  'Hamilton, NZ',
  'Tauranga, NZ',
  'Dunedin, NZ',
  'Palmerston North, NZ',
  'Napier, NZ',
  'Hastings, NZ',
  'Nelson, NZ',
  'Rotorua, NZ',
  'New Plymouth, NZ',
  'Whangārei, NZ',
  'Invercargill, NZ',
  'Queenstown, NZ',
  'Gisborne, NZ',
  'Blenheim, NZ',
  'Timaru, NZ',
  'Whanganui, NZ',
  'Remote (NZ)',
  'Remote (Australia)',
  'Sydney, AU',
  'Melbourne, AU',
  'Brisbane, AU',
]

interface LocationComboboxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

const inputCls =
  'w-full bg-input border border-border rounded-[--radius] pl-9 pr-9 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/20 transition-colors'

export function LocationCombobox({ value, onChange, placeholder = 'Search a location…', className }: LocationComboboxProps) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  const query = value.trim().toLowerCase()
  const filtered = query
    ? LOCATION_OPTIONS.filter(o => o.toLowerCase().includes(query))
    : LOCATION_OPTIONS

  // Close on click outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function select(option: string) {
    onChange(option)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && filtered[highlight]) {
        e.preventDefault()
        select(filtered[highlight])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <MapPin size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={e => {
          onChange(e.target.value)
          setOpen(true)
          setHighlight(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        className={inputCls}
      />
      <ChevronDown
        size={14}
        onClick={() => setOpen(o => !o)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground cursor-pointer"
      />

      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-[--radius] border border-border bg-card py-1 shadow-lg"
        >
          {filtered.map((option, i) => (
            <li
              key={option}
              role="option"
              aria-selected={value === option}
              onMouseDown={e => {
                e.preventDefault()
                select(option)
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                'flex items-center justify-between px-3 py-2 text-sm cursor-pointer text-foreground',
                i === highlight ? 'bg-accent' : 'hover:bg-accent/60',
              )}
            >
              <span>{option}</span>
              {value === option && <Check size={14} className="text-primary" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
