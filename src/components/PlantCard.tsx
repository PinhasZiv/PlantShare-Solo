import { useState } from 'react'
import { classify } from '../lib/due'
import { describePeriod, firstName, formatDate, relativeDay } from '../lib/format'
import { useI18n, type Language } from '../lib/i18n'
import type { Plant } from '../lib/types'
import { CheckIcon, DropIcon } from './Icons'

/** מי השקה: אני, מישהו אחר בשם, או שאף אחד עוד לא. */
export type WateredBy = { kind: 'you' } | { kind: 'other'; name: string | null } | null

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
  const { t, language } = useI18n()
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
            <span className="badge badge-late">{t.plant.badgeLate(info.daysLate)}</span>
          )}
          {info.status === 'due' && (
            <span className="badge badge-due">{t.plant.badgeDue}</span>
          )}
          {info.status === 'watered_today' && (
            <span className="badge badge-done">
              <CheckIcon size={14} /> {t.plant.badgeDone}
            </span>
          )}
        </div>

        <p className="plant-meta">
          {spaceName && <span className="chip">{spaceName}</span>}
          <span>{describePeriod(plant.period_days, language)}</span>
          {info.status === 'watered_today' ? (
            <>
              <span>
                {!wateredBy || wateredBy.kind === 'you'
                  ? t.plant.wateredByYou
                  : t.plant.wateredBy(wateredBy.name ?? t.plant.someoneElse)}
              </span>
              <span>{t.plant.nextIn(relativeDay(plant.next_due_date, today, language))}</span>
            </>
          ) : info.status === 'upcoming' ? (
            <span>{t.plant.nextOn(formatDate(plant.next_due_date, language))}</span>
          ) : (
            <span>{t.plant.dueOn(formatDate(plant.next_due_date, language))}</span>
          )}
        </p>
      </button>

      {onWater && info.status !== 'watered_today' && (
        <button
          type="button"
          className="water-button"
          onClick={water}
          disabled={busy}
          aria-label={t.plant.waterAria(plant.name)}
        >
          <DropIcon size={22} />
          <span>{busy ? '...' : t.plant.water}</span>
        </button>
      )}
    </article>
  )
}

export function wateredByLabel(
  plant: Plant,
  people: Map<string, { display_name: string | null; email: string | null }>,
  selfId: string | null,
  language: Language,
): WateredBy {
  if (!plant.last_watered_by) return null
  if (plant.last_watered_by === selfId) return { kind: 'you' }
  const person = people.get(plant.last_watered_by)
  // A null name means "we do not know who", which each language words itself.
  return { kind: 'other', name: person ? firstName(person.display_name, person.email, language) : null }
}
