import { daysBetween } from './due'
import type { Language } from './i18n/types'

// Numbers, dates and names, in whichever language is showing.
//
// Hebrew has a dual form - "יומיים", not "2 ימים" - and inflects nouns by
// number. English does neither. The difference is small but it is what
// separates an interface that reads like Hebrew from one that reads like a
// machine translation, so it lives here rather than in each dictionary.

const LOCALES: Record<Language, string> = { he: 'he-IL', en: 'en-GB' }

/** "יום" / "יומיים" / "3 ימים", or "1 day" / "3 days". */
export function days(count: number, language: Language): string {
  const n = Math.abs(count)
  if (language === 'en') return n === 1 ? '1 day' : `${n} days`
  if (n === 1) return 'יום'
  if (n === 2) return 'יומיים'
  return `${n} ימים`
}

/** "צמח אחד" / "2 צמחים", or "1 plant" / "2 plants". */
export function plants(count: number, language: Language): string {
  if (language === 'en') return count === 1 ? '1 plant' : `${count} plants`
  return count === 1 ? 'צמח אחד' : `${count} צמחים`
}

export function initials(name: string | null, email: string | null): string {
  const source = (name || email || '?').trim()
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function firstName(
  name: string | null,
  email: string | null,
  language: Language,
): string {
  const fallback = language === 'he' ? 'מישהו' : 'someone'
  const source = (name || email || fallback).trim()
  return source.split(/[\s@]/)[0]
}

/** "היום" / "בעוד יומיים", or "today" / "in 2 days". */
export function relativeDay(isoDate: string, today: string, language: Language): string {
  const delta = daysBetween(today, isoDate)

  if (language === 'en') {
    if (delta === 0) return 'today'
    if (delta === 1) return 'tomorrow'
    if (delta === -1) return 'yesterday'
    return delta > 0 ? `in ${days(delta, 'en')}` : `${days(delta, 'en')} ago`
  }

  if (delta === 0) return 'היום'
  if (delta === 1) return 'מחר'
  if (delta === 2) return 'מחרתיים'
  if (delta === -1) return 'אתמול'
  return delta > 0 ? `בעוד ${days(delta, 'he')}` : `לפני ${days(delta, 'he')}`
}

/** "יום ה׳, 3 בספט׳" / "Thu, 3 Sep" */
export function formatDate(isoDate: string, language: Language): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(LOCALES[language], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** "פעם בשבוע" / "weekly" */
export function describePeriod(periodDays: number, language: Language): string {
  if (language === 'en') {
    if (periodDays === 1) return 'every day'
    if (periodDays === 7) return 'weekly'
    if (periodDays === 14) return 'every 2 weeks'
    if (periodDays === 21) return 'every 3 weeks'
    if (periodDays === 30) return 'monthly'
    return `every ${periodDays} days`
  }

  if (periodDays === 1) return 'כל יום'
  if (periodDays === 2) return 'כל יומיים'
  if (periodDays === 7) return 'פעם בשבוע'
  if (periodDays === 14) return 'פעם בשבועיים'
  if (periodDays === 21) return 'פעם בשלושה שבועות'
  if (periodDays === 30) return 'פעם בחודש'
  return `כל ${periodDays} ימים`
}
