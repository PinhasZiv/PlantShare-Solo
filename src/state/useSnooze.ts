import * as api from '../lib/api'
import { formatSnoozeUntil } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { useToast } from '../components/Toast'
import { useApp } from './AppState'
import type { Plant } from '../lib/types'

/**
 * Snoozing and cancelling a snooze, shared between the Tonight-screen action
 * on a single plant and the notification-triggered picker on everything
 * currently due, so both paths patch state and roll back failures the same
 * way.
 */
export function useSnooze() {
  const { session, today, snoozes, patchSnooze, reload } = useApp()
  const { t, language } = useI18n()
  const toast = useToast()
  const selfId = session?.user.id ?? null

  /** Snoozes every plant given until the same instant. */
  async function snooze(plants: Plant[], until: string) {
    if (!selfId || plants.length === 0) return
    // אופטימי, בדיוק כמו water(): התגובה צריכה להרגיש מיידית, ו-reload()
    // בסוף מתקן כל אי-דיוק אם משהו נכשל באמצע.
    const previous = plants.map((plant) => ({ id: plant.id, until: snoozes.get(plant.id) ?? null }))
    plants.forEach((plant) => patchSnooze(plant.id, until))

    try {
      await Promise.all(plants.map((plant) => api.snoozePlant(plant.id, selfId, until)))
      toast.show(t.snooze.confirmed(formatSnoozeUntil(until, today, language)))
    } catch (cause) {
      previous.forEach(({ id, until: was }) => patchSnooze(id, was))
      toast.showError(cause)
      void reload()
    }
  }

  async function cancelSnooze(plant: Plant) {
    if (!selfId) return
    const previous = snoozes.get(plant.id) ?? null
    patchSnooze(plant.id, null)

    try {
      await api.cancelSnooze(plant.id, selfId)
      toast.show(t.snooze.cancelled)
    } catch (cause) {
      patchSnooze(plant.id, previous)
      toast.showError(cause)
      void reload()
    }
  }

  return { snooze, cancelSnooze }
}
