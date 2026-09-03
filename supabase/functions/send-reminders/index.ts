// The daily wake-up.
//
// A PWA cannot schedule itself: a service worker only runs when a push arrives.
// So the "wake up once a day" part of the app lives here instead of on the
// phone. pg_cron calls this every 15 minutes; it works out whose reminder time
// has just passed, and pushes only to them.
//
// Running server-side has a side benefit over the on-device approach: the
// reminder still fires for someone who has not opened the app in weeks, and is
// not at the mercy of Android's battery optimiser.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { classify, minutesOfDayIn, todayIn } from '../_shared/due.ts'
import { sendPush, type VapidKeys } from '../_shared/webpush.ts'

interface Profile {
  id: string
  display_name: string | null
  reminder_hour: number
  reminder_minute: number
  timezone: string
}

interface Plant {
  id: string
  space_id: string
  name: string
  period_days: number
  next_due_date: string
  last_watered_date: string | null
}

interface Subscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  failure_count: number
}

// How long after someone's chosen time we will still deliver. Wide enough to
// absorb cron jitter and a cold start; the once-per-day log stops it repeating.
const WINDOW_MINUTES = Number(Deno.env.get('REMINDER_WINDOW_MINUTES') ?? '60')
const MAX_NAMES_IN_BODY = 4

const vapid: VapidKeys = {
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
  subject: Deno.env.get('VAPID_SUBJECT') ?? 'mailto:plantshare@example.com',
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
)

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many
}

/** Turns a person's overdue list into the two lines of a notification. */
function composeMessage(
  duePlants: { plant: Plant; daysLate: number }[],
  spaceNames: Map<string, string>,
  showSpaceNames: boolean,
): { title: string; body: string } {
  const worstLate = Math.max(...duePlants.map((entry) => entry.daysLate))
  const count = duePlants.length

  const title =
    worstLate > 0
      ? `Late by ${worstLate} ${plural(worstLate, 'day', 'days')} - ${count} ${plural(count, 'plant', 'plants')}`
      : `Watering time - ${count} ${plural(count, 'plant', 'plants')}`

  const described = duePlants.slice(0, MAX_NAMES_IN_BODY).map(({ plant, daysLate }) => {
    const where = showSpaceNames ? `${spaceNames.get(plant.space_id) ?? '?'}: ` : ''
    const lateness = daysLate > 0 ? ` (${daysLate}d late)` : ''
    return `${where}${plant.name}${lateness}`
  })

  const remaining = count - described.length
  const body = remaining > 0 ? `${described.join(', ')} +${remaining} more` : described.join(', ')

  return { title, body }
}

Deno.serve(async (request) => {
  // Deployed with --no-verify-jwt (pg_cron has no user session), so the shared
  // secret is what keeps this endpoint from being a free push cannon.
  const expectedSecret = Deno.env.get('CRON_SECRET')
  if (!expectedSecret || request.headers.get('x-cron-secret') !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!vapid.publicKey || !vapid.privateKey) {
    return new Response(JSON.stringify({ error: 'VAPID keys are not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(request.url)
  // `?dry=1` runs the whole selection and reports who *would* be notified,
  // without sending or writing the log. Handy when checking the setup.
  const dryRun = url.searchParams.get('dry') === '1'
  const now = new Date()

  const [profiles, subscriptions, memberships, plants, spaces] = await Promise.all([
    admin.from('profiles').select('id, display_name, reminder_hour, reminder_minute, timezone'),
    admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth, failure_count'),
    admin.from('space_members').select('space_id, user_id'),
    admin
      .from('plants')
      .select('id, space_id, name, period_days, next_due_date, last_watered_date'),
    admin.from('spaces').select('id, name'),
  ])

  const failed = [profiles, subscriptions, memberships, plants, spaces].find((r) => r.error)
  if (failed?.error) {
    console.error('load failed', failed.error)
    return new Response(JSON.stringify({ error: failed.error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const subsByUser = new Map<string, Subscription[]>()
  for (const sub of (subscriptions.data ?? []) as Subscription[]) {
    const list = subsByUser.get(sub.user_id) ?? []
    list.push(sub)
    subsByUser.set(sub.user_id, list)
  }

  const spacesByUser = new Map<string, string[]>()
  for (const row of memberships.data ?? []) {
    const list = spacesByUser.get(row.user_id) ?? []
    list.push(row.space_id)
    spacesByUser.set(row.user_id, list)
  }

  const plantsBySpace = new Map<string, Plant[]>()
  for (const plant of (plants.data ?? []) as Plant[]) {
    const list = plantsBySpace.get(plant.space_id) ?? []
    list.push(plant)
    plantsBySpace.set(plant.space_id, list)
  }

  const spaceNames = new Map<string, string>(
    (spaces.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]),
  )

  const report: Record<string, unknown>[] = []
  let sentCount = 0

  for (const profile of (profiles.data ?? []) as Profile[]) {
    const subs = subsByUser.get(profile.id)
    if (!subs?.length) continue // nothing to push to

    const localDate = todayIn(profile.timezone, now)
    const nowMinutes = minutesOfDayIn(profile.timezone, now)
    const dueMinutes = profile.reminder_hour * 60 + profile.reminder_minute
    const sinceDue = nowMinutes - dueMinutes
    if (sinceDue < 0 || sinceDue >= WINDOW_MINUTES) continue // not their moment yet

    const userSpaces = spacesByUser.get(profile.id) ?? []
    const duePlants = userSpaces
      .flatMap((spaceId) => plantsBySpace.get(spaceId) ?? [])
      .map((plant) => ({ plant, info: classify(plant, localDate) }))
      .filter(({ info }) => info.notifiable)
      .map(({ plant, info }) => ({ plant, daysLate: info.daysLate }))
      .sort((a, b) => b.daysLate - a.daysLate)

    if (dryRun) {
      report.push({
        user: profile.display_name ?? profile.id,
        localDate,
        localMinutes: nowMinutes,
        wouldNotify: duePlants.length,
        plants: duePlants.map((entry) => entry.plant.name),
      })
      continue
    }

    // Claim the day for this user. The primary key on (user_id, local_date)
    // makes this the whole duplicate-suppression mechanism: two overlapping
    // cron runs race here, and exactly one of them wins the insert.
    const claim = await admin
      .from('notification_log')
      .insert({
        user_id: profile.id,
        local_date: localDate,
        kind: duePlants.length ? 'due' : 'none',
        plant_count: duePlants.length,
      })
      .select('user_id')
    if (claim.error || !claim.data?.length) continue // already handled today

    if (!duePlants.length) continue // nothing due; the log entry stops a re-check

    const { title, body } = composeMessage(duePlants, spaceNames, userSpaces.length > 1)
    const payload = {
      title,
      body,
      // One tag per day means a re-delivery replaces the old notification in
      // the tray rather than stacking a second copy.
      tag: `plantshare-${localDate}`,
      spaceId: duePlants[0].plant.space_id,
      plantCount: duePlants.length,
    }

    for (const sub of subs) {
      const result = await sendPush(sub, payload, vapid)
      if (result.ok) {
        sentCount++
        await admin
          .from('push_subscriptions')
          .update({ last_sent_at: new Date().toISOString(), failure_count: 0 })
          .eq('id', sub.id)
      } else if (result.gone) {
        // The browser has forgotten this subscription; stop writing to it.
        await admin.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        console.error('push failed', sub.endpoint.slice(0, 60), result.status, result.detail)
        await admin
          .from('push_subscriptions')
          .update({ failure_count: sub.failure_count + 1 })
          .eq('id', sub.id)
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, dryRun, sent: sentCount, checked: profiles.data?.length ?? 0, report }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
