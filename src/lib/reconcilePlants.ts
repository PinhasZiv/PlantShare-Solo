import type { Plant } from './types'

/**
 * Combines a freshly fetched plant list with whatever the realtime channel
 * has patched in since that fetch's own query ran.
 *
 * A cold-start reload can take several seconds end to end - that is what its
 * retries are for - which is long enough for someone else to water a plant
 * and have it arrive over realtime before the reload's own, slower-than-usual
 * response finally lands. Applying that response as-is would silently
 * overwrite the correct, already-on-screen state with a stale one: it was
 * queried a moment before the watering, but delivered a moment after.
 * `touchedIds` is exactly the set of plant ids realtime has since told this
 * device about - for those, `current` (not `fetched`) is the one to trust.
 */
export function reconcileReloadedPlants(current: Plant[], fetched: Plant[], touchedIds: Set<string>): Plant[] {
  if (touchedIds.size === 0) return fetched

  const currentById = new Map(current.map((plant) => [plant.id, plant]))
  const merged = fetched
    // A touched id missing from `current` means realtime says it was
    // deleted - the fetch's own copy of it is exactly the stale part.
    .filter((plant) => currentById.has(plant.id) || !touchedIds.has(plant.id))
    .map((plant) => (touchedIds.has(plant.id) ? currentById.get(plant.id)! : plant))

  // A touched id realtime added that this fetch's own snapshot predates.
  const fetchedIds = new Set(fetched.map((plant) => plant.id))
  for (const id of touchedIds) {
    const stillPresent = currentById.get(id)
    if (stillPresent && !fetchedIds.has(id)) merged.push(stillPresent)
  }
  return merged
}
