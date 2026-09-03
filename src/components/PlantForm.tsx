import { useEffect, useState } from 'react'
import { addDays } from '../lib/due'
import { formatDate } from '../lib/format'
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

// Common enough to be worth one tap; anything else goes in the number field.
const PRESETS = [
  { days: 1, label: 'Daily' },
  { days: 3, label: '3 days' },
  { days: 7, label: 'Weekly' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: 'Monthly' },
]

export function PlantForm({ today, existing, onCancel, onSave, onDelete }: PlantFormProps) {
  const [name, setName] = useState(existing?.name ?? '')
  const [periodDays, setPeriodDays] = useState(existing?.period_days ?? 7)
  // A new plant defaults to "water it tonight", which is almost always what
  // someone adding a plant in the evening means.
  const [firstDueDate, setFirstDueDate] = useState(existing?.next_due_date ?? today)
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Focus lands on the name field so the keyboard is already up.
    document.getElementById('plant-name')?.focus()
  }, [])

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Give the plant a name.')
      return
    }
    if (!Number.isInteger(periodDays) || periodDays < 1 || periodDays > 365) {
      setError('The watering period must be between 1 and 365 days.')
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
        aria-label={existing ? 'Edit plant' : 'Add plant'}
      >
        <h2>{existing ? 'Edit plant' : 'New plant'}</h2>

        <label className="field">
          <span>Name</span>
          <input
            id="plant-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Basil on the kitchen sill"
            maxLength={80}
            autoComplete="off"
          />
        </label>

        <fieldset className="field">
          <legend>Water every</legend>
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
              aria-label="Days between watering"
            />
            <span>days</span>
          </div>
        </fieldset>

        <label className="field">
          <span>{existing ? 'Next watering' : 'First watering'}</span>
          <input
            type="date"
            value={firstDueDate}
            min={addDays(today, -365)}
            onChange={(event) => setFirstDueDate(event.target.value || today)}
          />
          <small>{formatDate(firstDueDate)}</small>
        </label>

        <label className="field">
          <span>Notes (optional)</span>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Half a cup, no saucer"
            maxLength={200}
          />
        </label>

        {error && <p className="error-text">{error}</p>}

        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving...' : existing ? 'Save' : 'Add plant'}
          </button>
        </div>

        {onDelete && (
          <button
            type="button"
            className="btn btn-danger-text"
            onClick={async () => {
              if (!window.confirm(`Delete ${existing?.name}? This removes it for everyone in the space.`)) return
              setBusy(true)
              try {
                await onDelete()
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : String(cause))
                setBusy(false)
              }
            }}
          >
            Delete this plant
          </button>
        )}
      </form>
    </div>
  )
}
