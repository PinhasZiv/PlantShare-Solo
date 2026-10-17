import { describe, expect, it } from 'vitest'
import { summarizeWatering } from './history'

const TODAY = '2026-10-17'

describe('summarizeWatering', () => {
  it('counts each watering against the day it was due', () => {
    const rhythm = summarizeWatering(
      [
        { watered_on: '2026-10-16', prev_next_due_date: '2026-10-16' },
        { watered_on: '2026-10-12', prev_next_due_date: '2026-10-10' },
        { watered_on: '2026-10-06', prev_next_due_date: '2026-10-07' },
        { watered_on: '2026-10-03', prev_next_due_date: '2026-10-03' },
      ],
      TODAY,
    )
    expect(rhythm).toEqual({ early: 1, onTime: 2, late: 1, actualEvery: 4 })
  })

  it('leaves out waterings older than sixty days, and has nothing to say without any', () => {
    expect(summarizeWatering([{ watered_on: '2026-08-01', prev_next_due_date: '2026-08-01' }], TODAY)).toBeNull()
    expect(summarizeWatering([], TODAY)).toBeNull()
  })

  it('needs three waterings before it names how often, and counts one day once', () => {
    const two = summarizeWatering(
      [
        { watered_on: '2026-10-16', prev_next_due_date: '2026-10-16' },
        { watered_on: '2026-10-09', prev_next_due_date: '2026-10-09' },
      ],
      TODAY,
    )
    expect(two?.actualEvery).toBeNull()

    // Watered twice on the 9th (once by each person): still a weekly rhythm.
    const sameDay = summarizeWatering(
      [
        { watered_on: '2026-10-16', prev_next_due_date: '2026-10-16' },
        { watered_on: '2026-10-09', prev_next_due_date: '2026-10-09' },
        { watered_on: '2026-10-09', prev_next_due_date: '2026-10-16' },
        { watered_on: '2026-10-02', prev_next_due_date: '2026-10-02' },
      ],
      TODAY,
    )
    expect(sameDay).toEqual({ early: 1, onTime: 3, late: 0, actualEvery: 7 })
  })

  it('treats a watering with no due date on record as on time', () => {
    expect(summarizeWatering([{ watered_on: '2026-10-16' }], TODAY)).toEqual({ early: 0, onTime: 1, late: 0, actualEvery: null })
  })
})
