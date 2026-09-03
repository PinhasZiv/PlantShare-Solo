import { useMemo, useState } from 'react'
import * as api from '../lib/api'
import { classify } from '../lib/due'
import { useApp } from '../state/AppState'
import { PlantCard, wateredByLabel } from './PlantCard'
import { PlantForm, type PlantDraft } from './PlantForm'
import { PlusIcon } from './Icons'
import { useToast } from './Toast'
import { useI18n } from '../lib/i18n'
import type { Plant } from '../lib/types'

/** כל הצמחים במרחב הנבחר, בין אם הם צריכים משהו היום ובין אם לא. */
export function PlantsScreen() {
  const { plants, currentSpace, today, session, people, reload, patchPlant } = useApp()
  const { t, language } = useI18n()
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Plant | null>(null)

  const spacePlants = useMemo(
    () =>
      plants
        .filter((plant) => plant.space_id === currentSpace?.id)
        .sort((a, b) => {
          // כל מה שדורש תשומת לב עולה למעלה; השאר לפי תאריך היעד הבא.
          const aActive = classify(a, today).status !== 'upcoming'
          const bActive = classify(b, today).status !== 'upcoming'
          if (aActive !== bActive) return aActive ? -1 : 1
          return a.next_due_date.localeCompare(b.next_due_date)
        }),
    [plants, currentSpace, today],
  )

  if (!currentSpace) return null

  async function addPlant(draft: PlantDraft) {
    if (!session) return
    await api.createPlant(
      {
        spaceId: currentSpace!.id,
        name: draft.name,
        periodDays: draft.periodDays,
        firstDueDate: draft.firstDueDate,
        notes: draft.notes,
      },
      session.user.id,
    )
    setAdding(false)
    await reload()
    toast.show(t.plants.added(draft.name.trim()))
  }

  async function savePlant(draft: PlantDraft) {
    if (!editing) return
    const updated = await api.updatePlant(editing.id, {
      name: draft.name.trim(),
      period_days: draft.periodDays,
      next_due_date: draft.firstDueDate,
      notes: draft.notes.trim() || null,
    })
    patchPlant(updated)
    setEditing(null)
  }

  async function removePlant() {
    if (!editing) return
    await api.deletePlant(editing.id)
    setEditing(null)
    await reload()
    toast.show(t.plants.deleted)
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h2>{currentSpace.name}</h2>
        <p className="screen-subtitle">
          {spacePlants.length === 0
            ? t.plants.empty
            : t.plants.count(spacePlants.length)}
        </p>
      </header>

      {spacePlants.length === 0 ? (
        <div className="empty-state">
          <p>{t.plants.emptyBody}</p>
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            {t.plants.addFirst}
          </button>
        </div>
      ) : (
        <section className="plant-group">
          {spacePlants.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              today={today}
              wateredBy={wateredByLabel(plant, people, session?.user.id ?? null, language)}
              onOpen={() => setEditing(plant)}
            />
          ))}
        </section>
      )}

      <button
        type="button"
        className="fab"
        onClick={() => setAdding(true)}
        aria-label={t.plants.addAria}
      >
        <PlusIcon size={24} />
      </button>

      {adding && (
        <PlantForm today={today} onCancel={() => setAdding(false)} onSave={addPlant} />
      )}
      {editing && (
        <PlantForm
          today={today}
          existing={editing}
          onCancel={() => setEditing(null)}
          onSave={savePlant}
          onDelete={removePlant}
        />
      )}
    </div>
  )
}
