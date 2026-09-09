import { useState } from 'react'
import { classify } from '../lib/due'
import {
  describePeriod,
  formatDate,
  formatSnoozeUntil,
  personLabel,
  relativeDay,
  type PersonLabel,
} from '../lib/format'
import { useI18n, type Language } from '../lib/i18n'
import type { Plant } from '../lib/types'
import { CheckIcon, ClockIcon, DropIcon, PencilIcon, UndoIcon } from './Icons'

/** מי השקה: אני, מישהו אחר בשם, או שאף אחד עוד לא. */
export type WateredBy = PersonLabel

interface PlantCardProps {
  plant: Plant
  today: string
  spaceName?: string
  wateredBy?: WateredBy
  onWater?: () => Promise<void>
  /**
   * מי שקורא לכרטיס מחליט אם להעביר את זה - בהתאם לכך שהצמח באמת הושקה על
   * ידי מי שצופה עכשיו במסך. השרת אוכף את אותה בדיקה שוב בכל מקרה, אז כאן
   * זו רק שאלה של מתי להציע את הפעולה, לא מי מורשה לבצע אותה.
   */
  onUnwater?: () => Promise<void>
  /** לחיצה על גוף הכרטיס - פותחת את היסטוריית ההשקיה שלו. */
  onOpen?: () => void
  /** כפתור עריכה נפרד וקטן - קיים רק ברשימת "צמחים", לא ב"הערב". */
  onEdit?: () => void
  /** ISO instant this person's own snooze on this plant runs out. */
  snoozedUntil?: string
  /** Opens the duration picker for this one plant - only offered when it is not already snoozed. */
  onSnooze?: () => void
  onCancelSnooze?: () => Promise<void>
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
  onUnwater,
  onOpen,
  onEdit,
  snoozedUntil,
  onSnooze,
  onCancelSnooze,
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

  async function unwater() {
    if (!onUnwater || busy) return
    setBusy(true)
    try {
      await onUnwater()
    } finally {
      setBusy(false)
    }
  }

  async function cancelSnooze() {
    if (!onCancelSnooze || busy) return
    setBusy(true)
    try {
      await onCancelSnooze()
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
          {snoozedUntil ? (
            <span>{t.plant.snoozedUntil(formatSnoozeUntil(snoozedUntil, today, language))}</span>
          ) : info.status === 'watered_today' ? (
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

      {onUnwater && info.status === 'watered_today' && (
        <button
          type="button"
          className="water-button water-button-muted"
          onClick={unwater}
          disabled={busy}
          aria-label={t.plant.unwaterAria(plant.name)}
        >
          <UndoIcon size={20} />
          <span>{busy ? '...' : t.plant.undoWatering}</span>
        </button>
      )}

      {onSnooze && (
        <button
          type="button"
          className="water-button water-button-muted"
          onClick={onSnooze}
          disabled={busy}
          aria-label={t.plant.snoozeAria(plant.name)}
        >
          <ClockIcon size={20} />
          <span>{t.plant.snooze}</span>
        </button>
      )}

      {onCancelSnooze && (
        <button
          type="button"
          className="water-button water-button-muted"
          onClick={cancelSnooze}
          disabled={busy}
          aria-label={t.plant.cancelSnoozeAria(plant.name)}
        >
          <UndoIcon size={20} />
          <span>{busy ? '...' : t.plant.cancelSnooze}</span>
        </button>
      )}

      {onEdit && (
        <button
          type="button"
          className="icon-button"
          onClick={onEdit}
          aria-label={t.plant.editAria(plant.name)}
        >
          <PencilIcon size={17} />
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
  return personLabel(plant.last_watered_by, people, selfId, language)
}
