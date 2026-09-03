import { useState } from 'react'
import { classify } from '../lib/due'
import { describePeriod, firstName, formatDate, relativeDay } from '../lib/format'
import type { Plant } from '../lib/types'
import { CheckIcon, DropIcon } from './Icons'

interface PlantCardProps {
  plant: Plant
  today: string
  spaceName?: string
  wateredByName?: string | null
  onWater?: () => Promise<void>
  onOpen?: () => void
}

/**
 * One plant, in whichever of its four states it is in. The visual weight is
 * deliberately lopsided: an overdue plant should be impossible to miss, and one
 * already watered tonight should read as settled rather than as another task.
 */
export function PlantCard({
  plant,
  today,
  spaceName,
  wateredByName,
  onWater,
  onOpen,
}: PlantCardProps) {
  const [busy, setBusy] = useState(false)
  const info = classify(plant, today)

  async function water() {
    if (!onWater || busy) return
    setBusy(true)
    try {
      await onWater()
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className={`plant-card plant-${info.status}`}>
      <button type="button" className="plant-main" onClick={onOpen} disabled={!onOpen}>
        <div className="plant-headline">
          <h3>{plant.name}</h3>
          {info.status === 'late' && (
            <span className="badge badge-late">
              {info.daysLate} {info.daysLate === 1 ? 'day' : 'days'} late
            </span>
          )}
          {info.status === 'due' && <span className="badge badge-due">tonight</span>}
          {info.status === 'watered_today' && (
            <span className="badge badge-done">
              <CheckIcon size={14} /> done
            </span>
          )}
        </div>

        <p className="plant-meta">
          {spaceName && <span className="chip">{spaceName}</span>}
          <span>{describePeriod(plant.period_days)}</span>
          {info.status === 'watered_today' ? (
            <span>
              {wateredByName ? `watered by ${wateredByName}` : 'watered'} - next{' '}
              {relativeDay(plant.next_due_date, today)}
            </span>
          ) : info.status === 'upcoming' ? (
            <span>next {formatDate(plant.next_due_date)}</span>
          ) : (
            <span>due {formatDate(plant.next_due_date)}</span>
          )}
        </p>
      </button>

      {onWater && info.status !== 'watered_today' && (
        <button
          type="button"
          className="water-button"
          onClick={water}
          disabled={busy}
          aria-label={`Mark ${plant.name} as watered`}
        >
          <DropIcon size={22} />
          <span>{busy ? '...' : 'Water'}</span>
        </button>
      )}
    </article>
  )
}

export function wateredByLabel(
  plant: Plant,
  people: Map<string, { display_name: string | null; email: string | null }>,
  selfId: string | null,
): string | null {
  if (!plant.last_watered_by) return null
  if (plant.last_watered_by === selfId) return 'you'
  const person = people.get(plant.last_watered_by)
  return person ? firstName(person.display_name, person.email) : 'someone else'
}
