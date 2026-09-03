import { useMemo } from 'react'
import { addDays, classify } from '../lib/due'
import * as api from '../lib/api'
import { useApp } from '../state/AppState'
import { useToast } from './Toast'
import { PlantCard, wateredByLabel } from './PlantCard'
import { formatDate } from '../lib/format'
import { strings } from '../lib/strings'
import type { Plant } from '../lib/types'

/**
 * המסך שההתראה פותחת: מה צריך מים, מכל המרחבים שהאדם חבר בהם.
 *
 * הוא לא מוגבל למרחב אחד בכוונה. תזכורת הערב סופרת את כל המרחבים יחד, ולכן
 * רשימה שהראתה רק את המרחב הנבחר הייתה סותרת את ההתראה שהובילה לכאן.
 */
export function TonightScreen({ onManagePlants }: { onManagePlants: () => void }) {
  const { plants, spaces, people, today, session, patchPlant, reload } = useApp()
  const toast = useToast()
  const selfId = session?.user.id ?? null

  const groups = useMemo(() => {
    const late: Plant[] = []
    const due: Plant[] = []
    const done: Plant[] = []

    for (const plant of plants) {
      const { status } = classify(plant, today)
      if (status === 'late') late.push(plant)
      else if (status === 'due') due.push(plant)
      else if (status === 'watered_today') done.push(plant)
    }

    // בתוך קבוצת האיחור - הגרוע ביותר ראשון; השאר לפי תאריך היעד.
    late.sort((a, b) => classify(b, today).daysLate - classify(a, today).daysLate)
    return { late, due, done }
  }, [plants, today])

  const spaceNames = useMemo(
    () => new Map(spaces.map((space) => [space.id, space.name])),
    [spaces],
  )
  const showSpaceNames = spaces.length > 1

  const remaining = groups.late.length + groups.due.length

  async function water(plant: Plant) {
    // אופטימי: הלחיצה צריכה להרגיש מיידית גם בחיבור איטי. אם הכתיבה נכשלת
    // אנחנו טוענים מחדש, וזה מחזיר את המצב האמיתי.
    const previous = { ...plant }
    patchPlant({
      ...plant,
      last_watered_date: today,
      last_watered_by: selfId,
      next_due_date: addDays(today, plant.period_days),
    })

    try {
      const event = await api.markWatered(plant.id, today)
      toast.show(strings.tonight.watered(plant.name), {
        action: {
          label: strings.common.undo,
          run: async () => {
            try {
              await api.undoWatering(event.id)
              patchPlant(previous)
            } catch (cause) {
              toast.showError(cause)
              void reload()
            }
          },
        },
      })
    } catch (cause) {
      patchPlant(previous)
      toast.showError(cause)
      void reload()
    }
  }

  if (plants.length === 0) {
    return (
      <div className="empty-state">
        <h2>{strings.tonight.emptyTitle}</h2>
        <p>{strings.tonight.emptyBody}</p>
        <button type="button" className="btn btn-primary" onClick={onManagePlants}>
          {strings.tonight.addPlant}
        </button>
      </div>
    )
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h2>{remaining > 0 ? strings.tonight.titleActive : strings.tonight.titleDone}</h2>
        <p className="screen-subtitle">
          {remaining > 0
            ? strings.tonight.needWater(remaining)
            : groups.done.length > 0
              ? strings.tonight.allWatered
              : strings.tonight.nothingDue}
        </p>
      </header>

      {groups.late.length > 0 && (
        <section className="plant-group">
          <h3 className="group-title group-title-late">{strings.tonight.groupLate}</h3>
          {groups.late.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              today={today}
              spaceName={showSpaceNames ? spaceNames.get(plant.space_id) : undefined}
              onWater={() => water(plant)}
            />
          ))}
        </section>
      )}

      {groups.due.length > 0 && (
        <section className="plant-group">
          <h3 className="group-title">{strings.tonight.groupDue}</h3>
          {groups.due.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              today={today}
              spaceName={showSpaceNames ? spaceNames.get(plant.space_id) : undefined}
              onWater={() => water(plant)}
            />
          ))}
        </section>
      )}

      {groups.done.length > 0 && (
        <section className="plant-group">
          {/* נשאר על המסך עד מחר, כדי שאדם שני שנכנס לאפליקציה יראה שהצמח
              טופל, ולא רשימה ריקה בלי הסבר. */}
          <h3 className="group-title">{strings.tonight.groupDone}</h3>
          {groups.done.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              today={today}
              spaceName={showSpaceNames ? spaceNames.get(plant.space_id) : undefined}
              wateredBy={wateredByLabel(plant, people, selfId)}
            />
          ))}
        </section>
      )}

      {remaining === 0 && groups.done.length === 0 && (
        <div className="quiet-note">
          <p>{strings.tonight.nextUp(describeNext(plants, today))}</p>
        </div>
      )}
    </div>
  )
}

function describeNext(plants: Plant[], today: string): string {
  const upcoming = [...plants]
    .filter((plant) => classify(plant, today).status === 'upcoming')
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))
  if (upcoming.length === 0) return strings.tonight.nothingScheduled
  const soonest = upcoming[0]
  const sameDay = upcoming.filter((plant) => plant.next_due_date === soonest.next_due_date)
  const names = sameDay.slice(0, 3).map((plant) => plant.name).join(', ')
  const extra = sameDay.length > 3 ? ` +${sameDay.length - 3}` : ''
  return `${names}${extra} ב-${formatDate(soonest.next_due_date)}`
}
