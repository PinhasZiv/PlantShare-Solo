// The watering rules, in one place.
//
// This file is the single source of truth for "is this plant due, and how
// late is it". It is imported by the React app (to render the list) and by the
// reminder Edge Function (to decide who gets a push), so the badge on screen
// and the text in the notification can never disagree.
//
// Everything here is a pure function over `YYYY-MM-DD` strings. No Date
// arithmetic across timezones, no clock reads - the caller decides what "today"
// is and passes it in.

export const MAX_LATE_WARNINGS = 3

export type DueStatus =
  | 'watered_today' // done this evening; stays visible until tomorrow
  | 'late' // should have been watered on an earlier day
  | 'due' // due today
  | 'upcoming' // not yet

export interface DuePlant {
  next_due_date: string
  last_watered_date: string | null
  period_days: number
}

export interface DueInfo {
  status: DueStatus
  /** 0 when due today, 1+ when overdue, negative for upcoming. */
  daysLate: number
  /** Whether this plant should still produce a notification tonight. */
  notifiable: boolean
}

const MS_PER_DAY = 86_400_000

/** Parses `YYYY-MM-DD` as a UTC midnight instant, purely for day arithmetic. */
function toUtcMillis(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Whole days from `from` to `to`. Both are `YYYY-MM-DD`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMillis(to) - toUtcMillis(from)) / MS_PER_DAY)
}

export function addDays(isoDate: string, days: number): string {
  return formatDate(new Date(toUtcMillis(isoDate) + days * MS_PER_DAY))
}

/** `YYYY-MM-DD` from a Date's UTC fields. */
function formatDate(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Today's date in the given IANA timezone, as `YYYY-MM-DD`. */
export function todayIn(timezone: string, now: Date = new Date()): string {
  try {
    // en-CA formats as YYYY-MM-DD, which is exactly the shape we store.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now)
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now)
  }
}

/** Minutes since local midnight in the given timezone. */
export function minutesOfDayIn(timezone: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  // Some locales render midnight as 24; normalise it back to 0.
  return (hour % 24) * 60 + minute
}

export function classify(plant: DuePlant, today: string): DueInfo {
  // A plant watered today stays on screen for the rest of the evening, marked
  // done, so a second person opening the app sees that it was handled rather
  // than an unexplained empty list.
  if (plant.last_watered_date === today) {
    return { status: 'watered_today', daysLate: 0, notifiable: false }
  }

  const late = daysBetween(plant.next_due_date, today)

  if (late > 0) {
    // Past the third warning the plant stays in the list but stops nagging.
    return { status: 'late', daysLate: late, notifiable: late <= MAX_LATE_WARNINGS }
  }
  if (late === 0) {
    return { status: 'due', daysLate: 0, notifiable: true }
  }
  return { status: 'upcoming', daysLate: late, notifiable: false }
}

/** Rank for list ordering: overdue plants first, already-done ones last. */
const STATUS_ORDER: Record<DueStatus, number> = {
  late: 0,
  due: 1,
  watered_today: 2,
  upcoming: 3,
}

/** Plants that belong on tonight's list, worst-overdue first. */
export function actionable<T extends DuePlant>(plants: T[], today: string): T[] {
  return plants
    .map((plant) => ({ plant, info: classify(plant, today) }))
    .filter(({ info }) => info.status !== 'upcoming')
    .sort((a, b) => {
      const byStatus = STATUS_ORDER[a.info.status] - STATUS_ORDER[b.info.status]
      return byStatus !== 0 ? byStatus : b.info.daysLate - a.info.daysLate
    })
    .map(({ plant }) => plant)
}

/** Plants that should trigger a notification tonight. */
export function notifiable<T extends DuePlant>(plants: T[], today: string): T[] {
  return plants.filter((p) => classify(p, today).notifiable)
}

/** The next due date after watering on `today`. */
export function nextDueAfterWatering(periodDays: number, today: string): string {
  return addDays(today, periodDays)
}
