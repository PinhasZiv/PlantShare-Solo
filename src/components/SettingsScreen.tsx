import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { formatTime } from '../lib/format'
import {
  currentPushState,
  disablePush,
  enablePush,
  isInstalled,
  sendTestNotification,
  type PushState,
} from '../lib/push'
import { supabase } from '../lib/supabase'
import { useApp } from '../state/AppState'
import { useToast } from './Toast'

export function SettingsScreen() {
  const { profile, session, setProfile } = useApp()
  const toast = useToast()
  const [pushState, setPushState] = useState<PushState>('prompt')
  const [busy, setBusy] = useState(false)
  const [savingTime, setSavingTime] = useState(false)

  useEffect(() => {
    void currentPushState().then(setPushState)
  }, [])

  if (!profile || !session) return null

  async function toggleReminders(enabled: boolean) {
    setBusy(true)
    try {
      if (enabled) {
        const next = await enablePush(session!.user.id)
        setPushState(next)
        if (next === 'subscribed') toast.show('Reminders on for this device.')
        if (next === 'denied') {
          toast.show(
            'Notifications are blocked for this site. Turn them back on in your browser settings.',
            { tone: 'error' },
          )
        }
      } else {
        await disablePush()
        setPushState('prompt')
        toast.show('Reminders off for this device.')
      }
    } catch (cause) {
      toast.showError(cause)
    } finally {
      setBusy(false)
    }
  }

  async function saveTime(hour: number, minute: number) {
    setSavingTime(true)
    try {
      const updated = await api.updateProfile(session!.user.id, {
        reminder_hour: hour,
        reminder_minute: minute,
        // Keep the timezone in step with the device: someone who moves should
        // get their reminder at 7pm where they are, not where they signed up.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      setProfile(updated)
    } catch (cause) {
      toast.showError(cause)
    } finally {
      setSavingTime(false)
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h2>Settings</h2>
      </header>

      <section className="card">
        <h3>Reminder time</h3>
        <p className="muted">
          Once a day, PlantShare checks your spaces and sends one notification if
          anything needs water. Nothing runs in between.
        </p>
        <input
          type="time"
          className="time-input"
          value={formatTime(profile.reminder_hour, profile.reminder_minute)}
          onChange={(event) => {
            const [hour, minute] = event.target.value.split(':').map(Number)
            if (Number.isFinite(hour) && Number.isFinite(minute)) void saveTime(hour, minute)
          }}
          aria-label="Daily reminder time"
        />
        <p className="muted small">
          {savingTime ? 'Saving...' : `Your time zone: ${profile.timezone}`}
        </p>
      </section>

      <section className="card">
        <h3>Notifications on this device</h3>
        <PushStatus state={pushState} />

        {pushState === 'subscribed' ? (
          <>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={async () => {
                const result = await sendTestNotification()
                toast.show(result.message, { tone: result.ok ? 'info' : 'error' })
              }}
            >
              Send a test notification
            </button>
            <button
              type="button"
              className="btn btn-danger-text"
              disabled={busy}
              onClick={() => toggleReminders(false)}
            >
              Turn off on this device
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || pushState === 'unsupported' || pushState === 'unconfigured'}
            onClick={() => toggleReminders(true)}
          >
            {busy ? 'Working...' : 'Turn on reminders'}
          </button>
        )}

        {!isInstalled() && (
          <p className="muted small">
            Reminders are more reliable once the app is installed: open your
            browser menu and choose "Add to Home screen".
          </p>
        )}
      </section>

      <section className="card">
        <h3>Account</h3>
        <p className="muted">{profile.email}</p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={async () => {
            await supabase.auth.signOut()
          }}
        >
          Sign out
        </button>
      </section>
    </div>
  )
}

/** Says which of the several ways push can be off is the one in play. */
function PushStatus({ state }: { state: PushState }) {
  const messages: Record<PushState, string> = {
    subscribed: 'On. This device will get the evening reminder.',
    prompt: 'Off. Turn them on to get the evening reminder here.',
    denied:
      'Blocked. Your browser is refusing notifications for this site - allow them in the site settings, then come back.',
    unsupported:
      'This browser cannot receive push notifications. On Android, use Chrome, Edge or Firefox.',
    unconfigured:
      'The app was built without a notification key, so reminders cannot be delivered. See SETUP.md.',
  }

  const tone = state === 'subscribed' ? 'ok' : state === 'prompt' ? 'neutral' : 'warn'
  return <p className={`status status-${tone}`}>{messages[state]}</p>
}
