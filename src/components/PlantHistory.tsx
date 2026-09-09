import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { formatDate, personLabel } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { useApp } from '../state/AppState'
import type { Plant, WateringHistoryEntry } from '../lib/types'
import { useToast } from './Toast'

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
  const { people, session } = useApp()
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

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <h2>{t.history.title(plant.name)}</h2>

        {entries === null ? (
          <p className="muted">{t.common.loading}</p>
        ) : entries.length === 0 ? (
          <p className="muted">{t.history.empty}</p>
        ) : (
          <ul className="history-list">
            {entries.map((entry) => {
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
