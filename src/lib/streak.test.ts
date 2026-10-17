import { describe, expect, it } from 'vitest'
import { brokenDays, houseStreak, type StreakPlant } from './streak'

const TODAY = '2026-10-17'

function plant(id: string, overrides: Partial<StreakPlant> = {}): StreakPlant {
  return { id, next_due_date: TODAY, last_watered_date: null, ...overrides }
}

describe('brokenDays', () => {
  it('a watering on its due date, or before it, breaks nothing', () => {
    const rows = [
      { plant_id: 'p', watered_on: '2026-10-14', prev_next_due_date: '2026-10-14' },
      { plant_id: 'p', watered_on: '2026-10-10', prev_next_due_date: '2026-10-12' },
    ]
    expect(brokenDays([plant('p')], rows, TODAY).size).toBe(0)
  })

  it('a plant watered two days late broke both days it waited', () => {
    const rows = [{ plant_id: 'p', watered_on: '2026-10-16', prev_next_due_date: '2026-10-14' }]
    expect([...brokenDays([plant('p')], rows, TODAY)].sort()).toEqual(['2026-10-14', '2026-10-15'])
  })

  it('a plant still waiting breaks every day it has gone past, but not today', () => {
    expect([...brokenDays([plant('p', { next_due_date: '2026-10-15' })], [], TODAY)].sort()).toEqual(['2026-10-15', '2026-10-16'])
    expect(brokenDays([plant('p', { next_due_date: TODAY })], [], TODAY).size).toBe(0)
  })

  it('a plant watered tonight is not still waiting', () => {
    expect(brokenDays([plant('p', { next_due_date: '2026-10-20', last_watered_date: TODAY })], [], TODAY).size).toBe(0)
  })

  it('ignores waterings of plants that no longer exist', () => {
    const rows = [{ plant_id: 'gone', watered_on: '2026-10-16', prev_next_due_date: '2026-10-10' }]
    expect(brokenDays([], rows, TODAY).size).toBe(0)
  })
})

describe('houseStreak', () => {
  it('counts back from yesterday to the first day there was anything to do', () => {
    expect(houseStreak({ plants: [plant('p')], waterings: [], today: TODAY, since: '2026-10-07', todayClosed: false })).toBe(10)
  })

  it('stops at the most recent day a plant went unwatered', () => {
    const waterings = [{ plant_id: 'p', watered_on: '2026-10-13', prev_next_due_date: '2026-10-12' }]
    expect(houseStreak({ plants: [plant('p')], waterings, today: TODAY, since: '2026-10-01', todayClosed: false })).toBe(4)
  })

  it('adds tonight once tonight is cleared, and never lets today break it', () => {
    const base = { plants: [plant('p')], waterings: [], today: TODAY, since: '2026-10-14' }
    expect(houseStreak({ ...base, todayClosed: false })).toBe(3)
    expect(houseStreak({ ...base, todayClosed: true })).toBe(4)
  })

  it('is zero when yesterday was missed and tonight is still open', () => {
    expect(houseStreak({ plants: [plant('p', { next_due_date: '2026-10-16' })], waterings: [], today: TODAY, since: '2026-10-01', todayClosed: false })).toBe(0)
  })

  it('does not count further back than it is told to', () => {
    expect(houseStreak({ plants: [plant('p')], waterings: [], today: TODAY, since: '2025-01-01', todayClosed: false, maxDays: 30 })).toBe(30)
  })
})
