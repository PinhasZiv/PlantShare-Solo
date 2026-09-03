import { useMemo } from 'react'
import { addDays, classify } from '../lib/due'
import * as api from '../lib/api'
import { useApp } from '../state/AppState'
import { useToast } from './Toast'
import { PlantCard, wateredByLabel } from './PlantCard'
import { formatDate } from '../lib/format'
import type { Plant } from '../lib/types'

/**
 * The screen a notification opens onto: what needs water, across every space
 * the person belongs to.
 *
 * It is deliberately not scoped to one space. The evening reminder counts every
 * space at once, so a list that showed only the currently-selected one would
 * contradict the notification that led here.
 */
export function TonightScreen({ onManagePlants }: { onManagePlants: () => void }) {
  const { plants, spaces, people, today, session, patchPlant, reload } = useApp()
  const toast = useToast()
  const selfId = session?.user.id ?? null

  const groups = useMemo(() => {
    const late: Plant[] = []
    const due: Plant[] = []
    const done: Plant[] = []

    for (const plant of plants) {
      const { status } = classify(plant, today)
      if (status === 'late') late.push(plant)
      else if (status === 'due') due.push(plant)
      else if (status === 'watered_today') done.push(plant)
    }

    // Worst first inside the late group; everything else keeps due-date order.
    late.sort((a, b) => classify(b, today).daysLate - classify(a, today).daysLate)
    return { late, due, done }
  }, [plants, today])

  const spaceNames = useMemo(
    () => new Map(spaces.map((space) => [space.id, space.name])),
    [spaces],
  )
  const showSpaceNames = spaces.length > 1

  const remaining = groups.late.length + groups.due.length

  async function water(plant: Plant) {
    // Optimistic: the tap should feel instant even on a slow connection. If the
    // write fails we reload, which puts the real state back.
    const previous = { ...plant }
    patchPlant({
      ...plant,
      last_watered_date: today,
      last_watered_by: selfId,
      next_due_date: addDays(today, plant.period_days),
    })

    try {
      const event = await api.markWatered(plant.id, today)
      toast.show(`${plant.name} watered.`, {
        action: {
          label: 'Undo',
          run: async () => {
            try {
              await api.undoWatering(event.id)
              patchPlant(previous)
            } catch (cause) {
              toast.showError(cause)
              void reload()
            }
          },
        },
      })
    } catch (cause) {
      patchPlant(previous)
      toast.showError(cause)
      void reload()
    }
  }

  if (plants.length === 0) {
    return (
      <div className="empty-state">
        <h2>No plants yet</h2>
        <p>Add the first one and PlantShare will start reminding everyone in the space.</p>
        <button type="button" className="btn btn-primary" onClick={onManagePlants}>
          Add a plant
        </button>
      </div>
    )
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h2>{remaining > 0 ? 'Tonight' : 'All done'}</h2>
        <p className="screen-subtitle">
          {remaining > 0
            ? `${remaining} ${remaining === 1 ? 'plant needs' : 'plants need'} water`
            : groups.done.length > 0
              ? 'Everything due today has been watered.'
              : 'Nothing is due today.'}
        </p>
      </header>

      {groups.late.length > 0 && (
        <section className="plant-group">
          <h3 className="group-title group-title-late">Overdue</h3>
          {groups.late.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              today={today}
              spaceName={showSpaceNames ? spaceNames.get(plant.space_id) : undefined}
              onWater={() => water(plant)}
            />
          ))}
        </section>
      )}

      {groups.due.length > 0 && (
        <section className="plant-group">
          <h3 className="group-title">Due today</h3>
          {groups.due.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              today={today}
              spaceName={showSpaceNames ? spaceNames.get(plant.space_id) : undefined}
              onWater={() => water(plant)}
            />
          ))}
        </section>
      )}

      {groups.done.length > 0 && (
        <section className="plant-group">
          {/* Kept on screen until tomorrow so a second person opening the app
              sees that it was handled, rather than an unexplained empty list. */}
          <h3 className="group-title">Watered this evening</h3>
          {groups.done.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              today={today}
              spaceName={showSpaceNames ? spaceNames.get(plant.space_id) : undefined}
              wateredByName={wateredByLabel(plant, people, selfId)}
            />
          ))}
        </section>
      )}

      {remaining === 0 && groups.done.length === 0 && (
        <div className="quiet-note">
          <p>Next up: {describeNext(plants, today)}</p>
        </div>
      )}
    </div>
  )
}

function describeNext(plants: Plant[], today: string): string {
  const upcoming = [...plants]
    .filter((plant) => classify(plant, today).status === 'upcoming')
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))
  if (upcoming.length === 0) return 'nothing scheduled'
  const soonest = upcoming[0]
  const sameDay = upcoming.filter((plant) => plant.next_due_date === soonest.next_due_date)
  const names = sameDay.slice(0, 3).map((plant) => plant.name).join(', ')
  const extra = sameDay.length > 3 ? ` +${sameDay.length - 3}` : ''
  return `${names}${extra} on ${formatDate(soonest.next_due_date)}`
}
