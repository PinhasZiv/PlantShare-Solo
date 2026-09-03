import { daysBetween } from './due'

// עיצוב מספרים, תאריכים ושמות בעברית.
//
// לעברית יש צורת זוגי - "יומיים", לא "2 ימים" - ושמות עצם מוטים במספר.
// ההבדל קטן אבל הוא מה שמפריד בין ממשק שנקרא כמו עברית לבין ממשק שנקרא
// כמו תרגום מכונה, ולכן הוא נעשה כאן ולא בכל רכיב בנפרד.

const LOCALE = 'he-IL'

/** "יום" / "יומיים" / "3 ימים" */
export function days(count: number): string {
  const n = Math.abs(count)
  if (n === 1) return 'יום'
  if (n === 2) return 'יומיים'
  return `${n} ימים`
}

/** "צמח אחד" / "2 צמחים" */
export function plants(count: number): string {
  return count === 1 ? 'צמח אחד' : `${count} צמחים`
}

export function initials(name: string | null, email: string | null): string {
  const source = (name || email || '?').trim()
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function firstName(name: string | null, email: string | null): string {
  const source = (name || email || 'מישהו').trim()
  return source.split(/[\s@]/)[0]
}

/** "היום" / "מחר" / "בעוד יומיים" / "לפני 3 ימים" */
export function relativeDay(isoDate: string, today: string): string {
  const delta = daysBetween(today, isoDate)
  if (delta === 0) return 'היום'
  if (delta === 1) return 'מחר'
  if (delta === 2) return 'מחרתיים'
  if (delta === -1) return 'אתמול'
  if (delta > 2) return `בעוד ${days(delta)}`
  return `לפני ${days(delta)}`
}

/** "יום ה׳, 3 בספט׳" */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** "כל יום" / "כל יומיים" / "פעם בשבוע" / "כל 9 ימים" */
export function describePeriod(periodDays: number): string {
  if (periodDays === 1) return 'כל יום'
  if (periodDays === 2) return 'כל יומיים'
  if (periodDays === 7) return 'פעם בשבוע'
  if (periodDays === 14) return 'פעם בשבועיים'
  if (periodDays === 21) return 'פעם בשלושה שבועות'
  if (periodDays === 30) return 'פעם בחודש'
  return `כל ${periodDays} ימים`
}
