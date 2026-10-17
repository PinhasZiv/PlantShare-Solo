import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { describePeriod, formatDate, personLabel, relativeDay } from '../lib/format'
import { summarizeWatering } from '../lib/history'
import { useI18n } from '../lib/i18n'
import { useApp } from '../state/AppState'
import type { Plant, WateringHistoryEntry } from '../lib/types'
import { useToast } from './Toast'

/** How many of the loaded waterings the list shows - the rest only count
 *  towards the summary line above it. */
const LIST_LENGTH = 20

interface PlantHistoryProps {
  plant: Plant
  onClose: () => void
}

/**
 * מי השקה את הצמח הזה ומתי - כולל השקיות מימים קודמים, שכבר לא נראות בכרטיס
 * עצמו. ביטול השקיה מוחק גם את השורה כאן, בדיוק כמו שהוא משחזר כל דבר אחר
 * לגבי אותה השקיה כאילו לא קרתה.
 */
export function PlantHistory({ plant, onClose }: PlantHistoryProps) {
  const { people, session, today } = useApp()
  const { t, language } = useI18n()
  const toast = useToast()
  const selfId = session?.user.id ?? null
  const [entries, setEntries] = useState<WateringHistoryEntry[] | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .fetchHistory(plant.id)
      .then((rows) => {
        if (!cancelled) setEntries(rows)
      })
      .catch((cause) => {
        toast.showError(cause)
        if (!cancelled) setEntries([])
      })
    return () => {
      cancelled = true
    }
  }, [plant.id, toast])

  // The plant's rhythm over the last sixty days, from the same rows.
  const rhythm = entries ? summarizeWatering(entries, today) : null
  const rhythmLine = rhythm
    ? [
        rhythm.early && t.history.rhythm.early(rhythm.early),
        rhythm.onTime && t.history.rhythm.onTime(rhythm.onTime),
        rhythm.late && t.history.rhythm.late(rhythm.late),
        rhythm.actualEvery !== null && t.history.rhythm.actual(describePeriod(rhythm.actualEvery, language)),
      ].filter(Boolean)
    : []

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <h2>{t.history.title(plant.name)}</h2>

        {/* What the card leaves out to stay short: how often, and exactly when next. */}
        <dl className="plant-details">
          <dt>{t.history.period}</dt>
          <dd>{describePeriod(plant.period_days, language)}</dd>
          <dt>{t.history.next}</dt>
          <dd>
            {formatDate(plant.next_due_date, language)} · {relativeDay(plant.next_due_date, today, language)}
          </dd>
          {plant.notes && (
            <>
              <dt>{t.history.notes}</dt>
              <dd className="plant-details-notes">{plant.notes}</dd>
            </>
          )}
        </dl>

        {entries === null ? (
          <p className="muted">{t.common.loading}</p>
        ) : entries.length === 0 ? (
          <p className="muted">{t.history.empty}</p>
        ) : (
          <>
            {rhythmLine.length > 0 && (
              <p className="muted small history-summary">
                {t.history.rhythm.prefix} {rhythmLine.join(' · ')}
              </p>
            )}
            <ul className="history-list">
              {entries.slice(0, LIST_LENGTH).map((entry) => {
                const who = personLabel(entry.user_id, people, selfId, language)
                const whoText =
                  who?.kind === 'other'
                    ? t.plant.wateredBy(who.name ?? t.plant.someoneElse)
                    : t.plant.wateredByYou
                return (
                  <li key={entry.id} className="history-row">
                    <span className="history-date">{formatDate(entry.watered_on, language)}</span>
                    <span className="history-who">{whoText}</span>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  )
}
