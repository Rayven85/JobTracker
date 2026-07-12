// Defensive formatting for AI-extracted resume/profile data. That data is stored as JSON and
// does not always match our TS types — older records or the AI occasionally return a number
// where a date string is expected, or an array where a description string is expected. These
// helpers tolerate non-string inputs instead of throwing (e.g. `x.split` on a non-string) at
// render time, which previously crashed the whole page.

export function descriptionToLines(description: unknown): string[] {
  if (Array.isArray(description)) return description.map(l => String(l)).filter(l => l.trim().length > 0)
  if (typeof description === 'string') return description.split('\n').map(l => l.trim()).filter(Boolean)
  return []
}

export function formatMonthYear(date: unknown, isCurrent = false): string {
  if (isCurrent) return 'Present'
  if (date === null || date === undefined || date === '') return ''
  const s = String(date)
  const [year, month] = s.split('-')
  const y = Number(year)
  if (!y) return s
  if (!month) return String(y)
  const d = new Date(y, Number(month) - 1)
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' })
}
