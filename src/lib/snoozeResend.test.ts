import { describe, expect, it } from 'vitest'
import {
  planSnoozeOutcomes,
  type ExpiredSnooze,
  type SnoozePlant,
} from '../../supabase/functions/_shared/snoozeResend.ts'

const BASIL: SnoozePlant = {
  id: 'plant-1',
  space_id: 'space-1',
  name: 'Basil',
  period_days: 7,
  next_due_date: '2026-01-10',
  last_watered_date: null,
}

function plantsById(...plants: SnoozePlant[]): Map<string, SnoozePlant> {
  return new Map(plants.map((p) => [p.id, p]))
}

const alwaysToday = () => '2026-01-10'
const alwaysHebrew = () => 'he' as const

describe('planSnoozeOutcomes', () => {
  it('resends for a plant that is still due', () => {
    const expired: ExpiredSnooze[] = [{ plantId: 'plant-1', userId: 'user-1' }]
    const [outcome] = planSnoozeOutcomes(expired, plantsById(BASIL), alwaysToday, alwaysHebrew)

    expect(outcome.kind).toBe('resend')
    if (outcome.kind !== 'resend') throw new Error('unreachable')
    expect(outcome.plantId).toBe('plant-1')
    expect(outcome.userId).toBe('user-1')
    expect(outcome.daysLate).toBe(0)
    expect(outcome.title).toContain('צמח אחד')
    expect(outcome.body).toContain('Basil')
  })

  it('is stale once the plant was watered in the meantime', () => {
    const watered: SnoozePlant = { ...BASIL, last_watered_date: '2026-01-10' }
    const expired: ExpiredSnooze[] = [{ plantId: 'plant-1', userId: 'user-1' }]
    const [outcome] = planSnoozeOutcomes(expired, plantsById(watered), alwaysToday, alwaysHebrew)

    expect(outcome).toEqual({ kind: 'stale', plantId: 'plant-1', userId: 'user-1' })
  })

  it('is stale once the plant is past the late-warning cutoff', () => {
    const veryLate: SnoozePlant = { ...BASIL, next_due_date: '2025-01-01' }
    const expired: ExpiredSnooze[] = [{ plantId: 'plant-1', userId: 'user-1' }]
    const [outcome] = planSnoozeOutcomes(expired, plantsById(veryLate), alwaysToday, alwaysHebrew)

    expect(outcome.kind).toBe('stale')
  })

  it('is stale once the plant has been deleted', () => {
    const expired: ExpiredSnooze[] = [{ plantId: 'gone', userId: 'user-1' }]
    const [outcome] = planSnoozeOutcomes(expired, plantsById(BASIL), alwaysToday, alwaysHebrew)

    expect(outcome).toEqual({ kind: 'stale', plantId: 'gone', userId: 'user-1' })
  })

  it('is stale when the user has no profile to read a local date from', () => {
    const expired: ExpiredSnooze[] = [{ plantId: 'plant-1', userId: 'ghost' }]
    const [outcome] = planSnoozeOutcomes(expired, plantsById(BASIL), () => null, alwaysHebrew)

    expect(outcome.kind).toBe('stale')
  })

  it('composes each resend in the resending user\'s own language', () => {
    const expired: ExpiredSnooze[] = [{ plantId: 'plant-1', userId: 'user-1' }]
    const [outcome] = planSnoozeOutcomes(expired, plantsById(BASIL), alwaysToday, () => 'en')

    expect(outcome.kind).toBe('resend')
    if (outcome.kind !== 'resend') throw new Error('unreachable')
    expect(outcome.language).toBe('en')
    expect(outcome.title).toContain('1 plant')
  })

  it('decides every snooze independently, in the same order given', () => {
    const mint: SnoozePlant = { ...BASIL, id: 'plant-2', name: 'Mint', last_watered_date: '2026-01-10' }
    const expired: ExpiredSnooze[] = [
      { plantId: 'plant-1', userId: 'user-1' },
      { plantId: 'plant-2', userId: 'user-2' },
    ]
    const outcomes = planSnoozeOutcomes(expired, plantsById(BASIL, mint), alwaysToday, alwaysHebrew)

    expect(outcomes).toHaveLength(2)
    expect(outcomes[0]).toMatchObject({ kind: 'resend', plantId: 'plant-1' })
    expect(outcomes[1]).toMatchObject({ kind: 'stale', plantId: 'plant-2' })
  })

  it('returns nothing for an empty list', () => {
    expect(planSnoozeOutcomes([], plantsById(BASIL), alwaysToday, alwaysHebrew)).toEqual([])
  })
})
