// One plant's watering rhythm over the last two months, for the line at the
// top of its history: how many waterings came early, on the day or late, and
// how often it actually gets watered - set against how often it is meant to.
//
// Each watering records the due date it settled (prev_next_due_date), so
// whether it was on time needs nothing beyond the history rows themselves.

import { addDays, daysBetween } from './due'

export const HISTORY_WINDOW_DAYS = 60

export interface HistoryRow {
  watered_on: string
  prev_next_due_date?: string | null
}

export interface WateringRhythm {
  early: number
  onTime: number
  late: number
  /** The typical number of days between waterings - null with too few to tell. */
  actualEvery: number | null
}

export function summarizeWatering(rows: HistoryRow[], today: string): WateringRhythm | null {
  const from = addDays(today, -HISTORY_WINDOW_DAYS)
  const recent = rows.filter((row) => row.watered_on >= from && row.watered_on <= today)
  if (!recent.length) return null

  const rhythm: WateringRhythm = { early: 0, onTime: 0, late: 0, actualEvery: null }
  for (const row of recent) {
    const lateBy = row.prev_next_due_date ? daysBetween(row.prev_next_due_date, row.watered_on) : 0
    if (lateBy < 0) rhythm.early++
    else if (lateBy === 0) rhythm.onTime++
    else rhythm.late++
  }

  // Two gaps at least (three waterings), so one odd week does not set it.
  const days = [...new Set(recent.map((row) => row.watered_on))].sort()
  const gaps = days.slice(1).map((day, i) => daysBetween(days[i], day))
  if (gaps.length >= 2) rhythm.actualEvery = Math.max(1, Math.round(median(gaps)))
  return rhythm
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
