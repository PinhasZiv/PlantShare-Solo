import { useEffect, useRef, useState } from 'react'
import * as api from '../lib/api'
import { todayIn } from '../lib/due'
import { houseStreak, type WateringRow } from '../lib/streak'
import { useApp } from './AppState'

/** What fetchSpaceWaterings() returns at most - a full page means older
 *  history was cut off, and the streak cannot see past it. */
const HISTORY_LIMIT = 1000

/**
 * The household's streak up to yesterday (see lib/streak.ts), across every
 * space on the Tonight screen - or null until it has loaded, or if it could
 * not. Tonight is the caller's to add once tonight's list is cleared.
 *
 * Recomputed only when fresh history arrives, not on every change to the
 * plants: a late plant watered just now stops counting as waiting before
 * the row recording it has loaded, and computing in between would briefly
 * show a streak that day had already broken.
 */
export function useHouseStreak(): number | null {
  const { plants, spaces, today, profile } = useApp()
  const timezone = profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const [streak, setStreak] = useState<number | null>(null)

  const latest = useRef({ plants, today, timezone })
  latest.current = { plants, today, timezone }

  const spaceKey = spaces
    .map((space) => space.id)
    .sort()
    .join(',')
  // Anything that adds or settles history: a watering, an undo, a new due date.
  const historyKey = plants
    .map((plant) => `${plant.id}:${plant.next_due_date}:${plant.last_watered_date}`)
    .sort()
    .join('|')

  useEffect(() => {
    if (!spaceKey) return
    let cancelled = false
    Promise.all(spaceKey.split(',').map((id) => api.fetchSpaceWaterings(id)))
      .then((perSpace) => {
        if (cancelled) return
        const { plants, today, timezone } = latest.current
        const waterings: WateringRow[] = perSpace.flat()
        let floor = ''
        for (const rows of perSpace) {
          // Newest first - a full page's last row is as far back as it reaches.
          if (rows.length >= HISTORY_LIMIT) floor = maxDate(floor, rows[rows.length - 1].watered_on)
        }
        const firstPlant = plants.map((plant) => todayIn(timezone, new Date(plant.created_at))).sort()[0]
        if (!firstPlant) {
          setStreak(0)
          return
        }
        setStreak(houseStreak({ plants, waterings, today, since: maxDate(floor, firstPlant), todayClosed: false }))
      })
      .catch(() => {
        if (!cancelled) setStreak(null)
      })
    return () => {
      cancelled = true
    }
  }, [spaceKey, historyKey, today])

  return streak
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b
}
