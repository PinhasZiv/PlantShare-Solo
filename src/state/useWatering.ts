import { addDays } from '../lib/due'
import * as api from '../lib/api'
import { useI18n } from '../lib/i18n'
import { useToast } from '../components/Toast'
import { useApp } from './AppState'
import type { Plant } from '../lib/types'

/**
 * Watering and un-watering, shared between every screen that shows a plant
 * card, so "mark it watered from Tonight" and "mark it watered early from the
 * Plants list" cannot drift into two different implementations.
 */
export function useWatering() {
  const { today, session, patchPlant, reload } = useApp()
  const { t } = useI18n()
  const toast = useToast()
  const selfId = session?.user.id ?? null

  /**
   * Marks a plant watered right now. There is no due-date check - a plant
   * someone notices needs water tonight can be watered even if the schedule
   * says it is not due for days yet, which restarts its period from today.
   */
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
      await api.markWatered(plant.id, today)
      toast.show(t.tonight.watered(plant.name), {
        action: {
          label: t.common.undo,
          // ה-Undo של ה-toast קורא לאותה פעולת ביטול שהכפתור הקבוע קורא לה,
          // רק בלי הודעת אישור משלו - ה-toast עצמו מספיק כדי לדעת שזה נקלט.
          run: () => unwater(plant, { silent: true }),
        },
      })
    } catch (cause) {
      patchPlant(previous)
      toast.showError(cause)
      void reload()
    }
  }

  /**
   * Reverses a plant's most recent watering. The server is the real guard on
   * who may do this - see undo_last_watering() - so this never has a client-
   * held "previous state" to fall back on: it always patches with whatever
   * the server says the plant now looks like, which is what makes it safe to
   * call from a persistent button days after the watering happened, not just
   * from the toast that appears right after marking one.
   */
  async function unwater(plant: Plant, options?: { silent?: boolean }) {
    try {
      const restored = await api.unwaterPlant(plant.id)
      patchPlant(restored)
      if (!options?.silent) toast.show(t.plant.wateringUndone(plant.name))
    } catch (cause) {
      toast.showError(cause)
      void reload()
    }
  }

  return { water, unwater }
}
