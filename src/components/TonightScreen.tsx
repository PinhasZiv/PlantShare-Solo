import { useEffect, useMemo, useState } from 'react'
import { classify } from '../lib/due'
import { useApp } from '../state/AppState'
import { useSnooze } from '../state/useSnooze'
import { useWatering } from '../state/useWatering'
import { PlantCard, wateredByLabel } from './PlantCard'
import { PlantHistory } from './PlantHistory'
import { SnoozeSheet } from './SnoozeSheet'
import { formatDate } from '../lib/format'
import { useI18n, type Language, type Strings } from '../lib/i18n'
import type { Plant } from '../lib/types'

/** How often to re-check whether a snooze has run out while the screen is open. */
const SNOOZE_TICK_MS = 30_000

/** Consumes the one-shot `?snooze=1` a notification's Snooze action opens the app with, so a later reload does not reopen the sheet. */
function consumeSnoozeFlag(): boolean {
  const params = new URLSearchParams(window.location.search)
  if (params.get('snooze') !== '1') return false
  params.delete('snooze')
  const rest = params.toString()
  window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''))
  return true
}

/**
 * המסך שההתראה פותחת: מה צריך מים, מכל המרחבים שהאדם חבר בהם.
 *
 * הוא לא מוגבל למרחב אחד בכוונה. תזכורת הערב סופרת את כל המרחבים יחד, ולכן
 * רשימה שהראתה רק את המרחב הנבחר הייתה סותרת את ההתראה שהובילה לכאן.
 */
export function TonightScreen({ onManagePlants }: { onManagePlants: () => void }) {
  const { plants, spaces, people, today, session, snoozes } = useApp()
  const { t, language } = useI18n()
  const { water, unwater } = useWatering()
  const { snooze, cancelSnooze } = useSnooze()
  const selfId = session?.user.id ?? null

  const [sheetTargets, setSheetTargets] = useState<Plant[] | null>(null)
  const [viewingHistory, setViewingHistory] = useState<Plant | null>(null)

  // A snoozed plant should come back on its own the moment the timer runs
  // out, without waiting for a navigation or a reload to force a re-render.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const interval = window.setInterval(() => setTick((n) => n + 1), SNOOZE_TICK_MS)
    return () => window.clearInterval(interval)
  }, [])

  const groups = useMemo(() => {
    const late: Plant[] = []
    const due: Plant[] = []
    const done: Plant[] = []
    const snoozed: { plant: Plant; until: string }[] = []

    for (const plant of plants) {
      const { status } = classify(plant, today)
      const until = snoozes.get(plant.id)
      const stillSnoozed = (status === 'late' || status === 'due') && until && new Date(until) > new Date()

      if (stillSnoozed) snoozed.push({ plant, until: until as string })
      else if (status === 'late') late.push(plant)
      else if (status === 'due') due.push(plant)
      else if (status === 'watered_today') done.push(plant)
    }

    // בתוך קבוצת האיחור - הגרוע ביותר ראשון; השאר לפי תאריך היעד.
    late.sort((a, b) => classify(b, today).daysLate - classify(a, today).daysLate)
    // הקרוב ביותר לחזור ראשון.
    snoozed.sort((a, b) => a.until.localeCompare(b.until))
    return { late, due, done, snoozed }
  }, [plants, today, snoozes, tick])

  // ה-Snooze action על ההתראה פותח לכאן עם ?snooze=1: אין שם צמח יחיד לכוון
  // אליו (ההתראה יכולה לכסות כמה צמחים), אז זה פותח את הבחירה על כל מה
  // שבאמת ממתין כרגע - לא על מה שהיה ברשימה בזמן שההתראה נשלחה.
  useEffect(() => {
    if (!consumeSnoozeFlag()) return
    const targets = [...groups.late, ...groups.due]
    if (targets.length > 0) setSheetTargets(targets)
    // Deliberately mount-only: groups.late/due are already correct for this
    // render by the time this effect runs, and re-running on every group
    // change would reopen the sheet after the person closes it.
  }, [])

  const spaceNames = useMemo(
    () => new Map(spaces.map((space) => [space.id, space.name])),
    [spaces],
  )
  const showSpaceNames = spaces.length > 1

  const remaining = groups.late.length + groups.due.length

  if (plants.length === 0) {
    return (
      <div className="empty-state">
        <h2>{t.tonight.emptyTitle}</h2>
        <p>{t.tonight.emptyBody}</p>
        <button type="button" className="btn btn-primary" onClick={onManagePlants}>
          {t.tonight.addPlant}
        </button>
      </div>
    )
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h2>{remaining > 0 ? t.tonight.titleActive : t.tonight.titleDone}</h2>
        <p className="screen-subtitle">
          {remaining > 0
            ? t.tonight.needWater(remaining)
            : groups.snoozed.length > 0
              ? t.tonight.someSnoozed(groups.snoozed.length)
              : groups.done.length > 0
                ? t.tonight.allWatered
                : t.tonight.nothingDue}
        </p>
      </header>

      {groups.late.length > 0 && (
        <section className="plant-group">
          <h3 className="group-title group-title-late">{t.tonight.groupLate}</h3>
          {groups.late.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              today={today}
              spaceName={showSpaceNames ? spaceNames.get(plant.space_id) : undefined}
              onWater={() => water(plant)}
              onSnooze={() => setSheetTargets([plant])}
              onOpen={() => setViewingHistory(plant)}
            />
          ))}
        </section>
      )}

      {groups.due.length > 0 && (
        <section className="plant-group">
          <h3 className="group-title">{t.tonight.groupDue}</h3>
          {groups.due.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              today={today}
              spaceName={showSpaceNames ? spaceNames.get(plant.space_id) : undefined}
              onWater={() => water(plant)}
              onSnooze={() => setSheetTargets([plant])}
              onOpen={() => setViewingHistory(plant)}
            />
          ))}
        </section>
      )}

      {groups.snoozed.length > 0 && (
        <section className="plant-group">
          <h3 className="group-title">{t.tonight.groupSnoozed}</h3>
          {groups.snoozed.map(({ plant, until }) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              today={today}
              spaceName={showSpaceNames ? spaceNames.get(plant.space_id) : undefined}
              snoozedUntil={until}
              onWater={() => water(plant)}
              onCancelSnooze={() => cancelSnooze(plant)}
              onOpen={() => setViewingHistory(plant)}
            />
          ))}
        </section>
      )}

      {groups.done.length > 0 && (
        <section className="plant-group">
          {/* נשאר על המסך עד מחר, כדי שאדם שני שנכנס לאפליקציה יראה שהצמח
              טופל, ולא רשימה ריקה בלי הסבר. */}
          <h3 className="group-title">{t.tonight.groupDone}</h3>
          {groups.done.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              today={today}
              spaceName={showSpaceNames ? spaceNames.get(plant.space_id) : undefined}
              wateredBy={wateredByLabel(plant, people, selfId, language)}
              onUnwater={plant.last_watered_by === selfId ? () => unwater(plant) : undefined}
              onOpen={() => setViewingHistory(plant)}
            />
          ))}
        </section>
      )}

      {remaining === 0 && groups.done.length === 0 && groups.snoozed.length === 0 && (
        <div className="quiet-note">
          <p>{t.tonight.nextUp(describeNext(plants, today, language, t))}</p>
        </div>
      )}

      {sheetTargets && (
        <SnoozeSheet
          plants={sheetTargets}
          onClose={() => setSheetTargets(null)}
          onConfirm={async (until) => {
            await snooze(sheetTargets, until)
            setSheetTargets(null)
          }}
        />
      )}

      {viewingHistory && (
        <PlantHistory plant={viewingHistory} onClose={() => setViewingHistory(null)} />
      )}
    </div>
  )
}

function describeNext(
  plants: Plant[],
  today: string,
  language: Language,
  t: Strings,
): string {
  const upcoming = [...plants]
    .filter((plant) => classify(plant, today).status === 'upcoming')
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))
  if (upcoming.length === 0) return t.tonight.nothingScheduled
  const soonest = upcoming[0]
  const sameDay = upcoming.filter((plant) => plant.next_due_date === soonest.next_due_date)
  const names = sameDay.slice(0, 3).map((plant) => plant.name).join(', ')
  const extra = sameDay.length > 3 ? ` +${sameDay.length - 3}` : ''
  const on = language === 'he' ? 'ב-' : 'on '
  return `${names}${extra} ${on}${formatDate(soonest.next_due_date, language)}`
}
