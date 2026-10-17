// The household's streak: how many days in a row every plant that needed
// water got it that same day. One plant left for later breaks that day for
// everyone; that is what makes it the household's streak rather than
// anyone's personal score.
//
// Built from the waterings already stored - each one records the due date
// it settled (prev_next_due_date) - so a day the streak counts as broken is
// a day a plant showed up as late.

import { addDays } from './due'

export interface StreakPlant {
  id: string
  next_due_date: string
  last_watered_date: string | null
}

/** A watering: the day it happened, and the due date it settled. */
export interface WateringRow {
  plant_id: string
  watered_on: string
  prev_next_due_date: string | null
}

/**
 * Every day on which a plant was due, or already late, and went unwatered:
 * the days a watering came after, and the days a plant still waiting has
 * gone past. A late plant stays due every day until it is watered, so each
 * of those days counts - not only the first.
 */
export function brokenDays(plants: StreakPlant[], waterings: WateringRow[], today: string): Set<string> {
  const broken = new Set<string>()
  const known = new Set(plants.map((plant) => plant.id))
  const lapse = (dueDate: string, wateredOn: string) => {
    for (let day = dueDate; day < wateredOn; day = addDays(day, 1)) broken.add(day)
  }
  for (const row of waterings) {
    if (!known.has(row.plant_id) || !row.prev_next_due_date) continue
    lapse(row.prev_next_due_date, row.watered_on)
  }
  for (const plant of plants) {
    if (plant.last_watered_date === today) continue
    lapse(plant.next_due_date, today)
  }
  return broken
}

/**
 * Days in a row, counting back from yesterday, with nothing left unwatered -
 * plus tonight once tonight's list is cleared. Today itself never breaks it:
 * there is still time. `since` is the first day there is anything to count
 * (the oldest plant, or the oldest row the history reaches back to).
 */
export function houseStreak(options: {
  plants: StreakPlant[]
  waterings: WateringRow[]
  today: string
  since: string
  todayClosed: boolean
  maxDays?: number
}): number {
  const { plants, waterings, today, since, todayClosed, maxDays = 365 } = options
  const broken = brokenDays(plants, waterings, today)
  let count = 0
  for (let day = addDays(today, -1); day >= since && !broken.has(day) && count < maxDays; day = addDays(day, -1)) {
    count += 1
  }
  return count + (todayClosed ? 1 : 0)
}
