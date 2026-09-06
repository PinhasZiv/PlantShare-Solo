// Deciding which expired snoozes deserve a fresh push - kept separate from
// send-reminders/index.ts (which does the actual database reads/writes, and
// is Deno-only) so this can be unit tested without a database or the Deno
// runtime, the same way due.ts and messages.ts already are.

import { classify, type DuePlant } from './due.ts'
import { composeReminder, type Language } from './messages.ts'

export interface ExpiredSnooze {
  plantId: string
  userId: string
}

export interface SnoozePlant extends DuePlant {
  id: string
  name: string
  space_id: string
}

export type SnoozeOutcome =
  | {
      kind: 'resend'
      plantId: string
      userId: string
      language: Language
      daysLate: number
      title: string
      body: string
    }
  // The plant was watered, deleted, or is past the late-warning cutoff since
  // it was snoozed - nothing to send, the snooze row is just stale.
  | { kind: 'stale'; plantId: string; userId: string }

/**
 * Decides, for each expired snooze, whether it should still produce a push.
 *
 * classify() is the single source of truth for "is this plant still due" -
 * same function the daily reminder uses - so a plant that was watered (or
 * whose period changed) while snoozed is never nagged about again just
 * because the snooze timer ran out.
 */
export function planSnoozeOutcomes(
  expired: ExpiredSnooze[],
  plantsById: Map<string, SnoozePlant>,
  localDateForUser: (userId: string) => string | null,
  languageForUser: (userId: string) => Language,
): SnoozeOutcome[] {
  return expired.map((snooze) => {
    const plant = plantsById.get(snooze.plantId)
    const localDate = plant ? localDateForUser(snooze.userId) : null
    const info = plant && localDate ? classify(plant, localDate) : null

    if (!plant || !localDate || !info?.notifiable) {
      return { kind: 'stale', plantId: snooze.plantId, userId: snooze.userId }
    }

    const language = languageForUser(snooze.userId)
    const { title, body } = composeReminder([{ name: plant.name, daysLate: info.daysLate }], language)
    return {
      kind: 'resend',
      plantId: snooze.plantId,
      userId: snooze.userId,
      language,
      daysLate: info.daysLate,
      title,
      body,
    }
  })
}
