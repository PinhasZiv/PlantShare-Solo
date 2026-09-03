import { describe, expect, it } from 'vitest'
import {
  MAX_LATE_WARNINGS,
  actionable,
  addDays,
  classify,
  daysBetween,
  minutesOfDayIn,
  nextDueAfterWatering,
  notifiable,
  todayIn,
} from './due'

const plant = (next: string, lastWatered: string | null = null, period = 7) => ({
  next_due_date: next,
  last_watered_date: lastWatered,
  period_days: period,
})

describe('date arithmetic', () => {
  it('counts whole days between dates', () => {
    expect(daysBetween('2026-03-01', '2026-03-08')).toBe(7)
    expect(daysBetween('2026-03-08', '2026-03-01')).toBe(-7)
    expect(daysBetween('2026-03-01', '2026-03-01')).toBe(0)
  })

  it('crosses month and year boundaries', () => {
    expect(daysBetween('2026-12-28', '2027-01-04')).toBe(7)
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04')
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('handles leap days', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
  })

  // The whole point of storing dates rather than timestamps: a DST shift must
  // not silently turn one day into two, or none.
  it('is immune to daylight-saving shifts', () => {
    expect(daysBetween('2026-03-27', '2026-03-30')).toBe(3)
    expect(daysBetween('2026-10-24', '2026-10-27')).toBe(3)
  })
})

describe('classify', () => {
  it('marks a plant due on its due date', () => {
    const info = classify(plant('2026-05-10'), '2026-05-10')
    expect(info.status).toBe('due')
    expect(info.daysLate).toBe(0)
    expect(info.notifiable).toBe(true)
  })

  it('marks a plant upcoming before its due date', () => {
    const info = classify(plant('2026-05-10'), '2026-05-08')
    expect(info.status).toBe('upcoming')
    expect(info.notifiable).toBe(false)
  })

  it('counts lateness in days', () => {
    expect(classify(plant('2026-05-10'), '2026-05-11').daysLate).toBe(1)
    expect(classify(plant('2026-05-10'), '2026-05-13').daysLate).toBe(3)
    expect(classify(plant('2026-05-10'), '2026-05-11').status).toBe('late')
  })

  it('stops warning after the third late day but keeps the plant listed', () => {
    for (let late = 1; late <= MAX_LATE_WARNINGS; late++) {
      expect(classify(plant('2026-05-10'), addDays('2026-05-10', late)).notifiable).toBe(true)
    }
    const tooLate = classify(plant('2026-05-10'), addDays('2026-05-10', MAX_LATE_WARNINGS + 1))
    expect(tooLate.notifiable).toBe(false)
    expect(tooLate.status).toBe('late')
  })
})

describe('the same-evening rule', () => {
  // The behaviour the app is built around: two people, one plant, one evening.
  it('keeps a plant visible and marked done on the evening it was watered', () => {
    const watered = plant('2026-05-17', '2026-05-10')
    const info = classify(watered, '2026-05-10')
    expect(info.status).toBe('watered_today')
    expect(info.notifiable).toBe(false)
    expect(actionable([watered], '2026-05-10')).toHaveLength(1)
  })

  it('drops it from the list the next day', () => {
    const watered = plant('2026-05-17', '2026-05-10')
    expect(classify(watered, '2026-05-11').status).toBe('upcoming')
    expect(actionable([watered], '2026-05-11')).toHaveLength(0)
  })

  it('never notifies twice about a plant someone else already watered', () => {
    const watered = plant('2026-05-17', '2026-05-10')
    expect(notifiable([watered], '2026-05-10')).toHaveLength(0)
  })
})

describe('watering restarts the countdown from the day it happened', () => {
  it('schedules from today, not from the missed due date', () => {
    // Due the 10th, actually watered the 13th: the next one is the 20th, not
    // the 17th, so a plant you were late on does not stay behind forever.
    expect(nextDueAfterWatering(7, '2026-05-13')).toBe('2026-05-20')
  })

  it('supports a daily plant', () => {
    expect(nextDueAfterWatering(1, '2026-05-13')).toBe('2026-05-14')
  })
})

describe('list ordering', () => {
  it('puts the most overdue first and the finished ones last', () => {
    const today = '2026-05-10'
    const list = [
      plant('2026-05-10'), // due today
      plant('2026-05-17', today), // done tonight
      plant('2026-05-07'), // 3 days late
      plant('2026-05-09'), // 1 day late
      plant('2026-06-01'), // upcoming, excluded
    ]
    const ordered = actionable(list, today)
    expect(ordered.map((p) => p.next_due_date)).toEqual([
      '2026-05-07',
      '2026-05-09',
      '2026-05-10',
      '2026-05-17',
    ])
  })
})

describe('timezone helpers', () => {
  it('reads the local date in a named timezone', () => {
    // 22:30 UTC is already the next day in Jerusalem (UTC+3 in June).
    const instant = new Date('2026-06-01T22:30:00Z')
    expect(todayIn('Asia/Jerusalem', instant)).toBe('2026-06-02')
    expect(todayIn('UTC', instant)).toBe('2026-06-01')
  })

  it('reads minutes since local midnight', () => {
    const instant = new Date('2026-06-01T16:05:00Z')
    expect(minutesOfDayIn('UTC', instant)).toBe(16 * 60 + 5)
    expect(minutesOfDayIn('Asia/Jerusalem', instant)).toBe(19 * 60 + 5)
  })

  it('reports midnight as zero rather than 1440', () => {
    expect(minutesOfDayIn('UTC', new Date('2026-06-01T00:10:00Z'))).toBe(10)
  })
})
