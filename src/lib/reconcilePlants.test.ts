import { describe, expect, it } from 'vitest'
import { reconcileReloadedPlants } from './reconcilePlants'
import type { Plant } from './types'

function plant(overrides: Partial<Plant> & { id: string }): Plant {
  return {
    space_id: 'space-1',
    name: 'plant',
    period_days: 7,
    next_due_date: '2026-09-17',
    last_watered_date: null,
    last_watered_by: null,
    notes: null,
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('reconcileReloadedPlants', () => {
  it('returns the fetched list untouched when realtime has not patched anything', () => {
    const fetched = [plant({ id: 'a' }), plant({ id: 'b' })]
    expect(reconcileReloadedPlants([plant({ id: 'a' })], fetched, new Set())).toBe(fetched)
  })

  it('keeps the realtime-patched version of a plant the fetch reports as stale', () => {
    // The fetch's own query ran before someone else's watering committed,
    // but its response is the one landing last - exactly the race that made
    // a watered plant silently revert to due until a manual reload.
    const staleFromFetch = plant({ id: 'a', last_watered_date: null, last_watered_by: null })
    const freshFromRealtime = plant({
      id: 'a',
      last_watered_date: '2026-09-17',
      last_watered_by: 'other-user',
    })
    const merged = reconcileReloadedPlants([freshFromRealtime], [staleFromFetch], new Set(['a']))
    expect(merged).toEqual([freshFromRealtime])
  })

  it('drops a plant the fetch still has but realtime says was deleted', () => {
    const staleFromFetch = plant({ id: 'a' })
    const merged = reconcileReloadedPlants([], [staleFromFetch], new Set(['a']))
    expect(merged).toEqual([])
  })

  it('keeps a plant realtime inserted that the fetch predates', () => {
    const insertedViaRealtime = plant({ id: 'new' })
    const merged = reconcileReloadedPlants([insertedViaRealtime], [], new Set(['new']))
    expect(merged).toEqual([insertedViaRealtime])
  })

  it('leaves untouched plants exactly as the fetch reported them', () => {
    const fetchedA = plant({ id: 'a', name: 'from fetch' })
    const staleLocalA = plant({ id: 'a', name: 'stale local copy' })
    const merged = reconcileReloadedPlants([staleLocalA], [fetchedA], new Set(['b']))
    expect(merged).toEqual([fetchedA])
  })
})
