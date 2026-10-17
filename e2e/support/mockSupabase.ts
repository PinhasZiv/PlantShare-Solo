import type { Page, Route } from '@playwright/test'

// A small stand-in for the pieces of the Supabase REST API the app actually
// calls on the screens these tests exercise. It is not a general PostgREST
// clone - just enough query/filter/upsert support for profiles, spaces,
// plants, plant_snoozes and watering_events, which is what fetchProfile/
// fetchSpaces/fetchAllPlants/fetchPeople/fetchSnoozes/snoozePlant/
// cancelSnooze/fetchHistory issue.

export const FAKE_USER_ID = '11111111-1111-4111-8111-111111111111'
export const FAKE_SPACE_ID = '22222222-2222-4222-8222-222222222222'

export interface FakePlant {
  id: string
  space_id: string
  name: string
  period_days: number
  next_due_date: string
  last_watered_date: string | null
  last_watered_by: string | null
  notes: string | null
  created_by: string
  created_at: string
}

export interface FakeDb {
  profile: {
    id: string
    email: string | null
    display_name: string | null
    avatar_url: string | null
    reminder_hour: number
    reminder_minute: number
    timezone: string
    language: 'he' | 'en' | null
  }
  spaces: { id: string; name: string; invite_code: string; created_by: string; created_at: string }[]
  plants: FakePlant[]
  snoozes: Map<string, string> // plant_id -> snoozed_until, this user only
  /** prev_next_due_date - the due date the watering settled - defaults to
   *  watered_on itself (on time) when a test does not care about lateness. */
  wateringEvents: { id: string; plant_id: string; user_id: string; watered_on: string; created_at: string; prev_next_due_date?: string }[]
  /** Other space members fetchPeople() should resolve names for - the signed-in user's own profile is always included automatically. */
  otherPeople: { id: string; display_name: string | null; avatar_url: string | null; email: string | null }[]
}

export function makeFakeDb(overrides?: Partial<FakeDb>): FakeDb {
  return {
    profile: {
      id: FAKE_USER_ID,
      email: 'test@example.com',
      display_name: 'Test Person',
      avatar_url: null,
      reminder_hour: 19,
      reminder_minute: 0,
      timezone: 'Asia/Jerusalem',
      language: 'he',
    },
    spaces: [
      {
        id: FAKE_SPACE_ID,
        name: 'הבית',
        invite_code: 'ABC123',
        created_by: FAKE_USER_ID,
        created_at: new Date().toISOString(),
      },
    ],
    plants: [],
    snoozes: new Map(),
    wateringEvents: [],
    otherPeople: [],
    ...overrides,
  }
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

function eqValue(url: URL, column: string): string | null {
  const raw = url.searchParams.get(column)
  return raw?.startsWith('eq.') ? raw.slice(3) : null
}

export async function installSupabaseMock(page: Page, db: FakeDb): Promise<void> {
  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const table = url.pathname.split('/').pop() ?? ''
    const method = request.method()
    const wantsSingle = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object')

    if (table === 'mark_watered' && method === 'POST') {
      // mark_watered() - see 0001_init.sql: records the watering with the due
      // date it settled, then moves the plant on from the day it got water.
      const body = request.postDataJSON() as { p_plant: string; p_today: string }
      const target = db.plants.find((p) => p.id === body.p_plant)
      if (!target) return json(route, { message: 'no_such_plant' }, 404)
      const event = {
        id: `w-${db.wateringEvents.length + 1}-${Date.now()}`,
        plant_id: target.id,
        space_id: target.space_id,
        user_id: db.profile.id,
        watered_on: body.p_today,
        prev_next_due_date: target.next_due_date,
        prev_last_watered_date: target.last_watered_date,
        prev_last_watered_by: target.last_watered_by,
        created_at: new Date().toISOString(),
      }
      db.wateringEvents.push(event)
      const [y, m, d] = body.p_today.split('-').map(Number)
      target.next_due_date = new Date(Date.UTC(y, m - 1, d + target.period_days)).toISOString().slice(0, 10)
      target.last_watered_date = body.p_today
      target.last_watered_by = db.profile.id
      return json(route, wantsSingle ? event : [event])
    }

    if (table === 'profiles' && method === 'GET') {
      const idFilter = eqValue(url, 'id')
      const select = url.searchParams.get('select') ?? ''
      if (idFilter && idFilter !== db.profile.id) return json(route, null, 406)
      if (select === '*' || idFilter) return json(route, wantsSingle ? db.profile : [db.profile])
      // fetchPeople: a narrower column set, always an array.
      const { id, display_name, avatar_url, email } = db.profile
      return json(route, [{ id, display_name, avatar_url, email }, ...db.otherPeople])
    }

    if (table === 'spaces' && method === 'GET') return json(route, db.spaces)

    if (table === 'plants' && method === 'GET') return json(route, db.plants)

    if (table === 'plant_snoozes') {
      if (method === 'GET') {
        const rows = [...db.snoozes.entries()].map(([plant_id, snoozed_until]) => ({
          plant_id,
          snoozed_until,
        }))
        return json(route, rows)
      }
      if (method === 'POST') {
        // upsert() sends back whatever shape it was called with - a single
        // object for a single row, or an array for several.
        const body = request.postDataJSON() as
          | { plant_id: string; snoozed_until: string }
          | { plant_id: string; snoozed_until: string }[]
        const rows = Array.isArray(body) ? body : [body]
        for (const row of rows) db.snoozes.set(row.plant_id, row.snoozed_until)
        return json(route, [], 201)
      }
      if (method === 'DELETE') {
        const plantId = eqValue(url, 'plant_id')
        if (plantId) db.snoozes.delete(plantId)
        return json(route, [])
      }
    }

    if (table === 'watering_events' && method === 'GET' && eqValue(url, 'space_id')) {
      // fetchSpaceWaterings(): every watering of the space's plants.
      const spaceId = eqValue(url, 'space_id')
      const rows = db.wateringEvents
        .filter((row) => db.plants.find((p) => p.id === row.plant_id)?.space_id === spaceId)
        .map((row) => ({ plant_id: row.plant_id, watered_on: row.watered_on, prev_next_due_date: row.prev_next_due_date ?? row.watered_on }))
        .sort((a, b) => b.watered_on.localeCompare(a.watered_on))
      return json(route, rows)
    }

    if (table === 'watering_events' && method === 'GET') {
      const plantId = eqValue(url, 'plant_id')
      const rows = db.wateringEvents
        .filter((row) => row.plant_id === plantId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
      return json(route, rows)
    }

    if (table === 'push_subscriptions') return json(route, [])

    if (table === 'space_members' && method === 'GET') {
      // fetchMembers(): the signed-in person (who made the space) and
      // everyone in otherPeople, each with their profile embedded.
      const self = { id: db.profile.id, display_name: db.profile.display_name, avatar_url: db.profile.avatar_url, email: db.profile.email }
      const members = [
        { user_id: self.id, role: 'owner', profile: self },
        ...db.otherPeople.map((person) => ({ user_id: person.id, role: 'member', profile: person })),
      ]
      return json(
        route,
        members.map((member, i) => ({ space_id: db.spaces[0]?.id, joined_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(), ...member })),
      )
    }

    return json(route, { message: `unmocked request: ${method} ${url.pathname}${url.search}` }, 404)
  })

  // Realtime is best-effort in the app (a plant list that just does not
  // live-update if the socket cannot connect), and the fake host this suite
  // points at cannot resolve at all - do not let that surface as a console
  // error that makes a failing assertion harder to read.
  await page.routeWebSocket('**/realtime/v1/**', () => {})
}

function base64Url(value: object): string {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** A JWT-shaped (never verified anywhere in this mock) access token. */
function fakeAccessToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000)
  const header = base64Url({ alg: 'HS256', typ: 'JWT' })
  const payload = base64Url({ sub: userId, role: 'authenticated', exp: now + 3600 })
  return `${header}.${payload}.fake-signature`
}

/**
 * Seeds the localStorage key supabase-js reads on `getSession()`, so the app
 * starts already signed in - no OAuth flow to fake.
 */
export async function seedSession(page: Page, userId: string = FAKE_USER_ID): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  const session = {
    access_token: fakeAccessToken(userId),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'fake-refresh-token',
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'test@example.com',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  }
  // The default storage key is `sb-${hostname.split('.')[0]}-auth-token`,
  // matching the fake project host this suite configures Vite to use.
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: 'sb-fake-project-auth-token', value: JSON.stringify(session) },
  )
}
