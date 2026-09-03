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
import { strings } from '../lib/strings'
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
        if (next === 'subscribed') toast.show(strings.settings.enabled)
        if (next === 'denied') toast.show(strings.settings.blockedToast, { tone: 'error' })
      } else {
        await disablePush()
        setPushState('prompt')
        toast.show(strings.settings.disabled)
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
        // אזור הזמן נשמר בהתאם למכשיר: מי שעובר מדינה צריך לקבל את התזכורת
        // בשבע בערב במקום שבו הוא נמצא, לא במקום שבו נרשם.
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
        <h2>{strings.settings.title}</h2>
      </header>

      <section className="card">
        <h3>{strings.settings.reminderTime}</h3>
        <p className="muted">{strings.settings.reminderBody}</p>
        <input
          type="time"
          className="time-input"
          value={formatTime(profile.reminder_hour, profile.reminder_minute)}
          onChange={(event) => {
            const [hour, minute] = event.target.value.split(':').map(Number)
            if (Number.isFinite(hour) && Number.isFinite(minute)) void saveTime(hour, minute)
          }}
          aria-label={strings.settings.reminderAria}
        />
        <p className="muted small">
          {savingTime ? strings.common.saving : strings.settings.timezone(profile.timezone)}
        </p>
      </section>

      <section className="card">
        <h3>{strings.settings.notifications}</h3>
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
              {strings.settings.sendTest}
            </button>
            <button
              type="button"
              className="btn btn-danger-text"
              disabled={busy}
              onClick={() => toggleReminders(false)}
            >
              {strings.settings.turnOff}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || pushState === 'unsupported' || pushState === 'unconfigured'}
            onClick={() => toggleReminders(true)}
          >
            {busy ? strings.common.working : strings.settings.turnOn}
          </button>
        )}

        {!isInstalled() && (
          <p className="muted small">{strings.settings.installHint}</p>
        )}
      </section>

      <section className="card">
        <h3>{strings.settings.account}</h3>
        <p className="muted">{profile.email}</p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={async () => {
            await supabase.auth.signOut()
          }}
        >
          {strings.settings.signOut}
        </button>
      </section>
    </div>
  )
}

/** אומר איזו מכל הדרכים שבהן התראות יכולות להיות כבויות היא זו שקורית כאן. */
function PushStatus({ state }: { state: PushState }) {
  const tone = state === 'subscribed' ? 'ok' : state === 'prompt' ? 'neutral' : 'warn'
  return <p className={`status status-${tone}`}>{strings.settings.pushState[state]}</p>
}
