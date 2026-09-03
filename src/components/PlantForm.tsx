import { useEffect, useState } from 'react'
import { addDays } from '../lib/due'
import { formatDate } from '../lib/format'
import { strings } from '../lib/strings'
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

// נפוץ מספיק כדי להצדיק לחיצה אחת; כל השאר נכנס בשדה המספרי.
const PRESETS = [
  { days: 1, label: strings.plantForm.presets.daily },
  { days: 3, label: strings.plantForm.presets.threeDays },
  { days: 7, label: strings.plantForm.presets.weekly },
  { days: 14, label: strings.plantForm.presets.twoWeeks },
  { days: 30, label: strings.plantForm.presets.monthly },
]

export function PlantForm({ today, existing, onCancel, onSave, onDelete }: PlantFormProps) {
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
      setError(strings.plantForm.errorNoName)
      return
    }
    if (!Number.isInteger(periodDays) || periodDays < 1 || periodDays > 365) {
      setError(strings.plantForm.errorPeriod)
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
        aria-label={existing ? strings.plantForm.titleEdit : strings.plantForm.titleNew}
      >
        <h2>{existing ? strings.plantForm.titleEdit : strings.plantForm.titleNew}</h2>

        <label className="field">
          <span>{strings.plantForm.name}</span>
          <input
            id="plant-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={strings.plantForm.namePlaceholder}
            maxLength={80}
            autoComplete="off"
          />
        </label>

        <fieldset className="field">
          <legend>{strings.plantForm.waterEvery}</legend>
          <div className="preset-row">
            {PRESETS.map((preset) => (
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
              aria-label={strings.plantForm.daysAria}
            />
            <span>{strings.plantForm.daysUnit}</span>
          </div>
        </fieldset>

        <label className="field">
          <span>
            {existing ? strings.plantForm.nextWatering : strings.plantForm.firstWatering}
          </span>
          <input
            type="date"
            value={firstDueDate}
            min={addDays(today, -365)}
            onChange={(event) => setFirstDueDate(event.target.value || today)}
          />
          <small>{formatDate(firstDueDate)}</small>
        </label>

        <label className="field">
          <span>{strings.plantForm.notes}</span>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={strings.plantForm.notesPlaceholder}
            maxLength={200}
          />
        </label>

        {error && <p className="error-text">{error}</p>}

        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {strings.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy
              ? strings.common.saving
              : existing
                ? strings.common.save
                : strings.plantForm.add}
          </button>
        </div>

        {onDelete && (
          <button
            type="button"
            className="btn btn-danger-text"
            onClick={async () => {
              if (!window.confirm(strings.plantForm.confirmDelete(existing?.name ?? ''))) return
              setBusy(true)
              try {
                await onDelete()
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : String(cause))
                setBusy(false)
              }
            }}
          >
            {strings.plantForm.delete}
          </button>
        )}
      </form>
    </div>
  )
}
