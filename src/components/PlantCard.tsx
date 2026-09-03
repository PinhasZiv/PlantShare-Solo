import { useState } from 'react'
import { classify } from '../lib/due'
import { describePeriod, firstName, formatDate, relativeDay } from '../lib/format'
import { strings } from '../lib/strings'
import type { Plant } from '../lib/types'
import { CheckIcon, DropIcon } from './Icons'

/** מי השקה: אני, מישהו אחר בשם, או שאף אחד עוד לא. */
export type WateredBy = { kind: 'you' } | { kind: 'other'; name: string } | null

interface PlantCardProps {
  plant: Plant
  today: string
  spaceName?: string
  wateredBy?: WateredBy
  onWater?: () => Promise<void>
  onOpen?: () => void
}

/**
 * צמח אחד, באיזה מארבעת המצבים שהוא נמצא. המשקל הוויזואלי לא שווה בכוונה:
 * צמח באיחור צריך להיות בלתי אפשרי לפספס, וצמח שכבר הושקה הערב צריך להיראות
 * סגור ולא כמו עוד משימה.
 */
export function PlantCard({
  plant,
  today,
  spaceName,
  wateredBy,
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
          {/* שם הצמח יכול להיות בעברית או באנגלית; plaintext נותן לכל שם
              להיקרא בכיוון הטבעי שלו בתוך ממשק ימין-לשמאל. */}
          <h3 className="plant-name">{plant.name}</h3>
          {info.status === 'late' && (
            <span className="badge badge-late">{strings.plant.badgeLate(info.daysLate)}</span>
          )}
          {info.status === 'due' && (
            <span className="badge badge-due">{strings.plant.badgeDue}</span>
          )}
          {info.status === 'watered_today' && (
            <span className="badge badge-done">
              <CheckIcon size={14} /> {strings.plant.badgeDone}
            </span>
          )}
        </div>

        <p className="plant-meta">
          {spaceName && <span className="chip">{spaceName}</span>}
          <span>{describePeriod(plant.period_days)}</span>
          {info.status === 'watered_today' ? (
            <>
              <span>
                {!wateredBy || wateredBy.kind === 'you'
                  ? strings.plant.wateredByYou
                  : strings.plant.wateredBy(wateredBy.name)}
              </span>
              <span>{strings.plant.nextIn(relativeDay(plant.next_due_date, today))}</span>
            </>
          ) : info.status === 'upcoming' ? (
            <span>{strings.plant.nextOn(formatDate(plant.next_due_date))}</span>
          ) : (
            <span>{strings.plant.dueOn(formatDate(plant.next_due_date))}</span>
          )}
        </p>
      </button>

      {onWater && info.status !== 'watered_today' && (
        <button
          type="button"
          className="water-button"
          onClick={water}
          disabled={busy}
          aria-label={strings.plant.waterAria(plant.name)}
        >
          <DropIcon size={22} />
          <span>{busy ? '...' : strings.plant.water}</span>
        </button>
      )}
    </article>
  )
}

export function wateredByLabel(
  plant: Plant,
  people: Map<string, { display_name: string | null; email: string | null }>,
  selfId: string | null,
): WateredBy {
  if (!plant.last_watered_by) return null
  if (plant.last_watered_by === selfId) return { kind: 'you' }
  const person = people.get(plant.last_watered_by)
  return {
    kind: 'other',
    name: person
      ? firstName(person.display_name, person.email)
      : strings.plant.someoneElse,
  }
}
