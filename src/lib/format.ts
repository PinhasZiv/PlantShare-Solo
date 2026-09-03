import { daysBetween } from './due'

export function initials(name: string | null, email: string | null): string {
  const source = (name || email || '?').trim()
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function firstName(name: string | null, email: string | null): string {
  const source = (name || email || 'Someone').trim()
  return source.split(/[\s@]/)[0]
}

/** "in 3 days" / "today" / "2 days ago", relative to the caller's today. */
export function relativeDay(isoDate: string, today: string): string {
  const delta = daysBetween(today, isoDate)
  if (delta === 0) return 'today'
  if (delta === 1) return 'tomorrow'
  if (delta === -1) return 'yesterday'
  if (delta > 1) return `in ${delta} days`
  return `${-delta} days ago`
}

export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function describePeriod(days: number): string {
  if (days === 1) return 'every day'
  if (days === 7) return 'weekly'
  if (days === 14) return 'every 2 weeks'
  if (days === 30) return 'monthly'
  return `every ${days} days`
}
