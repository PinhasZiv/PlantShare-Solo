import { useEffect, useState } from 'react'
import { addDays } from '../lib/due'
import { formatDate } from '../lib/format'
import { useI18n } from '../lib/i18n'
import type { Plant } from '../lib/types'

export interface PlantDraft {
  name: string
  periodDays: number
  firstDueDate: string
  notes: string
}

interface PlantFormProps {
  today: string
  existing?: Plant
  onCancel: () => void
  onSave: (draft: PlantDraft) => Promise<void>
  onDelete?: () => Promise<void>
}

export function PlantForm({ today, existing, onCancel, onSave, onDelete }: PlantFormProps) {
  const { t, language } = useI18n()

  // נפוץ מספיק כדי להצדיק לחיצה אחת; כל השאר נכנס בשדה המספרי. התוויות
  // תלויות בשפה, ולכן זה נבנה בכל רינדור ולא כקבוע ברמת המודול.
  const presets = [
    { days: 1, label: t.plantForm.presets.daily },
    { days: 3, label: t.plantForm.presets.threeDays },
    { days: 7, label: t.plantForm.presets.weekly },
    { days: 14, label: t.plantForm.presets.twoWeeks },
    { days: 30, label: t.plantForm.presets.monthly },
  ]

  const [name, setName] = useState(existing?.name ?? '')
  const [periodDays, setPeriodDays] = useState(existing?.period_days ?? 7)
  // ברירת המחדל לצמח חדש היא "להשקות הערב", וזה כמעט תמיד מה שמתכוונים אליו
  // כשמוסיפים צמח בערב.
  const [firstDueDate, setFirstDueDate] = useState(existing?.next_due_date ?? today)
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // הפוקוס נוחת על שדה השם כדי שהמקלדת תהיה כבר פתוחה.
    document.getElementById('plant-name')?.focus()
  }, [])

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError(t.plantForm.errorNoName)
      return
    }
    if (!Number.isInteger(periodDays) || periodDays < 1 || periodDays > 365) {
      setError(t.plantForm.errorPeriod)
      return
    }

    setBusy(true)
    setError(null)
    try {
      await onSave({ name, periodDays, firstDueDate, notes })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onCancel} role="presentation">
      <form
        className="sheet"
        onClick={(event) => event.stopPropagation()}
        onSubmit={save}
        aria-label={existing ? t.plantForm.titleEdit : t.plantForm.titleNew}
      >
        <h2>{existing ? t.plantForm.titleEdit : t.plantForm.titleNew}</h2>

        <label className="field">
          <span>{t.plantForm.name}</span>
          <input
            id="plant-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t.plantForm.namePlaceholder}
            maxLength={80}
            autoComplete="off"
          />
        </label>

        <fieldset className="field">
          <legend>{t.plantForm.waterEvery}</legend>
          <div className="preset-row">
            {presets.map((preset) => (
              <button
                key={preset.days}
                type="button"
                className={`preset ${periodDays === preset.days ? 'preset-active' : ''}`}
                onClick={() => setPeriodDays(preset.days)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="inline-field">
            <input
              type="number"
              min={1}
              max={365}
              value={periodDays}
              onChange={(event) => setPeriodDays(Number(event.target.value))}
              aria-label={t.plantForm.daysAria}
            />
            <span>{t.plantForm.daysUnit}</span>
          </div>
        </fieldset>

        <label className="field">
          <span>
            {existing ? t.plantForm.nextWatering : t.plantForm.firstWatering}
          </span>
          <input
            type="date"
            value={firstDueDate}
            min={addDays(today, -365)}
            onChange={(event) => setFirstDueDate(event.target.value || today)}
          />
          <small>{formatDate(firstDueDate, language)}</small>
        </label>

        <label className="field">
          <span>{t.plantForm.notes}</span>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t.plantForm.notesPlaceholder}
            maxLength={200}
          />
        </label>

        {error && <p className="error-text">{error}</p>}

        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy
              ? t.common.saving
              : existing
                ? t.common.save
                : t.plantForm.add}
          </button>
        </div>

        {onDelete && (
          <button
            type="button"
            className="btn btn-danger-text"
            onClick={async () => {
              if (!window.confirm(t.plantForm.confirmDelete(existing?.name ?? ''))) return
              setBusy(true)
              try {
                await onDelete()
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : String(cause))
                setBusy(false)
              }
            }}
          >
            {t.plantForm.delete}
          </button>
        )}
      </form>
    </div>
  )
}
