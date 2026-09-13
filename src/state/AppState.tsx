import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { errorMessage, isNetworkError } from '../lib/errors'
import { getLanguage, isLanguage, setLanguage, t } from '../lib/i18n'
import { restorePushIfGranted } from '../lib/push'
import { supabase } from '../lib/supabase'
import { todayIn } from '../lib/due'
import * as api from '../lib/api'
import type { Plant, Profile, Space } from '../lib/types'

type Person = Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'email'>

interface AppContextValue {
  session: Session | null
  profile: Profile | null
  spaces: Space[]
  plants: Plant[]
  /** Display names for everyone the user shares a space with, by user id. */
  people: Map<string, Person>
  /** Today's date in the signed-in person's timezone, as `YYYY-MM-DD`. */
  today: string
  currentSpaceId: string | null
  setCurrentSpaceId: (id: string) => void
  currentSpace: Space | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  setProfile: (profile: Profile) => void
  /** Applies a plant change locally so the UI does not wait for a round trip. */
  patchPlant: (plant: Plant) => void
  /**
   * This person's own snoozes, by plant id, mapping to `snoozed_until`. A
   * plant with no entry here is not snoozed - never a stale timestamp to
   * ignore, just absent.
   */
  snoozes: Map<string, string>
  /** Applies a snooze (or its cancellation, with `until: null`) locally. */
  patchSnooze: (plantId: string, until: string | null) => void
}

const AppContext = createContext<AppContextValue | null>(null)

const SPACE_KEY = 'plantshare.currentSpace'

function readStoredSpace(): string | null {
  // A notification carries the space it is about; honour that over whatever was
  // last open, so tapping a reminder lands on the right list.
  const fromUrl = new URLSearchParams(window.location.search).get('space')
  if (fromUrl) return fromUrl
  try {
    return localStorage.getItem(SPACE_KEY)
  } catch {
    return null
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [spaces, setSpaces] = useState<Space[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [people, setPeople] = useState<Map<string, Person>>(new Map())
  const [snoozes, setSnoozes] = useState<Map<string, string>>(new Map())
  const [currentSpaceId, setCurrentSpaceIdState] = useState<string | null>(readStoredSpace)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [today, setToday] = useState(() => todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone))

  const timezone = profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const userId = session?.user.id ?? null

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setAuthReady(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const adoptLanguage = useCallback((loaded: Profile) => {
    if (isLanguage(loaded.language)) {
      setLanguage(loaded.language)
      return
    }
    const local = getLanguage()
    void supabase
      .from('profiles')
      .update({ language: local })
      .eq('id', loaded.id)
      .then(({ error: cause }) => {
        if (cause) console.error('could not record the language preference', cause)
      })
  }, [])

  const reload = useCallback(async () => {
    if (!userId) return
    setError(null)
    const fetchEverything = () =>
      Promise.all([
        api.fetchProfile(userId),
        api.fetchSpaces(),
        api.fetchAllPlants(),
        api.fetchPeople(),
        api.fetchSnoozes(userId),
      ])
    try {
      let result
      try {
        result = await fetchEverything()
      } catch {
        // A cold start (opening the PWA after it sat backgrounded, or from
        // fully closed) can race the very first request against a session
        // token that is still being refreshed, or a network interface that
        // has not woken up yet. That clears up within a second - which is
        // all "press try again" ever did - so one silent retry here means
        // the user does not have to do it by hand.
        await new Promise((resolve) => setTimeout(resolve, 1200))
        result = await fetchEverything()
      }
      const [nextProfile, nextSpaces, nextPlants, nextPeople, nextSnoozes] = result
      setProfile(nextProfile)
      adoptLanguage(nextProfile)
      setSpaces(nextSpaces)
      setPlants(nextPlants)
      setPeople(new Map(nextPeople.map((person) => [person.id, person])))
      setSnoozes(new Map(nextSnoozes.map((row) => [row.plant_id, row.snoozed_until])))
      setCurrentSpaceIdState((current) => {
        const stillValid = current && nextSpaces.some((space) => space.id === current)
        return stillValid ? current : (nextSpaces[0]?.id ?? null)
      })
    } catch (cause) {
      // A bare fetch failure (no network yet, mid cold-start) throws a raw
      // TypeError whose engine-specific wording ("Failed to fetch", "Load
      // failed"...) means nothing to someone reading it in Hebrew - it reads
      // as the app being broken rather than the phone's connection not being
      // up yet. A real Supabase rejection (expired session, RLS, a bad
      // query) is never a TypeError, so it still gets its own readable
      // message here.
      setError(isNetworkError(cause) ? t().common.offline : errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [userId, adoptLanguage])

  // The date has to be re-derived rather than captured once: the app is meant to
  // be left open on a windowsill, and a list that still says "tonight" at 2am
  // the next day would be lying.
  useEffect(() => {
    const tick = () => setToday(todayIn(timezone))
    tick()
    const interval = window.setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [timezone])


  useEffect(() => {
    if (!authReady) return
    if (!userId) {
      setLoading(false)
      setProfile(null)
      setSpaces([])
      setPlants([])
      setPeople(new Map())
      setSnoozes(new Map())
      return
    }
    setLoading(true)
    void reload()
  }, [authReady, userId, reload])

  // Live updates: the point of a shared space is that when someone else waters
  // the basil, it greys out on your screen without you doing anything.
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('plants-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plants' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setPlants((current) => current.filter((plant) => plant.id !== (payload.old as Plant).id))
        } else {
          const incoming = payload.new as Plant
          setPlants((current) => {
            const without = current.filter((plant) => plant.id !== incoming.id)
            return [...without, incoming]
          })
        }
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])

  // Membership changes are rarer and not worth a second realtime channel, but a
  // refresh on returning to the app catches "someone added me to a space".
  const lastRefresh = useRef(Date.now())
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !userId) return
      if (Date.now() - lastRefresh.current < 30_000) return
      lastRefresh.current = Date.now()
      void reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId, reload])

  // A device can wipe the push subscription along with the sign-in session
  // (which is what "the app logged me out" turned out to also be doing to
  // notifications) while leaving the OS notification permission granted. If
  // so, this silently re-subscribes - no prompt, since permission is already
  // decided - the moment a session comes back, instead of leaving reminders
  // off until someone notices and re-enables them by hand.
  useEffect(() => {
    if (!userId) return
    void restorePushIfGranted(userId)
  }, [userId])

  /**
   * Reconciles the language on the profile with the one this device is using.
   *
   * A profile that already names a language wins, so signing in on a new phone
   * brings your choice with you. A profile that names none gets whatever this
   * device worked out, which is how the first sign-in records a preference -
   * and it has to be recorded, because the evening notification is written on
   * the server, long after the app was last open.
   */

  const setCurrentSpaceId = useCallback((id: string) => {
    setCurrentSpaceIdState(id)
    try {
      localStorage.setItem(SPACE_KEY, id)
    } catch {
      // Private browsing with storage blocked; the choice just will not persist.
    }
  }, [])

  const patchPlant = useCallback((plant: Plant) => {
    setPlants((current) => current.map((item) => (item.id === plant.id ? plant : item)))
  }, [])

  const patchSnooze = useCallback((plantId: string, until: string | null) => {
    setSnoozes((current) => {
      const next = new Map(current)
      if (until) next.set(plantId, until)
      else next.delete(plantId)
      return next
    })
  }, [])

  const value = useMemo<AppContextValue>(
    () => ({
      session,
      profile,
      spaces,
      plants,
      people,
      today,
      currentSpaceId,
      setCurrentSpaceId,
      currentSpace: spaces.find((space) => space.id === currentSpaceId) ?? null,
      loading: loading || !authReady,
      error,
      reload,
      setProfile,
      patchPlant,
      snoozes,
      patchSnooze,
    }),
    [
      session, profile, spaces, plants, people, today, currentSpaceId,
      setCurrentSpaceId, loading, authReady, error, reload, patchPlant,
      snoozes, patchSnooze,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside AppProvider')
  return value
}
