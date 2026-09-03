import { strings } from './strings'
import { VAPID_PUBLIC_KEY, supabase } from './supabase'

// Getting a browser subscribed to push is a four-step handshake, and each step
// can fail in a way the previous one does not predict. These helpers report
// which step you are on, so Settings can say something more useful than
// "notifications are off".

export type PushState =
  | 'unsupported' // no service worker or Push API (a desktop Safari, an old browser)
  | 'unconfigured' // the build has no VAPID key
  | 'denied' // the person said no; only they can undo this, in browser settings
  | 'prompt' // never asked
  | 'subscribed'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** True when the page is running as an installed app rather than a browser tab. */
export function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari's non-standard flag, harmless to check on Android.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    // BASE_URL keeps the scope correct when served from a GitHub Pages sub-path.
    return await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    })
  } catch (error) {
    console.error('service worker registration failed', error)
    return null
  }
}

export async function currentPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (!VAPID_PUBLIC_KEY) return 'unconfigured'
  if (Notification.permission === 'denied') return 'denied'

  const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
  const existing = await registration?.pushManager.getSubscription()
  // Permission alone is not enough: it can be granted while the subscription
  // was dropped, which is the state that looks fine and delivers nothing.
  return existing ? 'subscribed' : 'prompt'
}

/**
 * Asks for permission, subscribes, and stores the subscription so the server
 * can reach this device. Safe to call again - the endpoint is the primary key,
 * so re-subscribing updates rather than duplicates.
 */
export async function enablePush(userId: string): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (!VAPID_PUBLIC_KEY) return 'unconfigured'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'prompt'

  const registration = (await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL))
    ?? (await registerServiceWorker())
  if (!registration) return 'unsupported'
  await navigator.serviceWorker.ready

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      // Non-visible pushes are not allowed on the web; every push we send shows
      // a notification, so this is simply true.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }))

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      user_agent: navigator.userAgent.slice(0, 300),
      failure_count: 0,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error

  return 'subscribed'
}

export async function disablePush(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return

  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}

/** Asks the server to push one notification to this account's devices now. */
export async function sendTestNotification(): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabase.functions.invoke('send-test', { body: {} })
  if (error) return { ok: false, message: strings.settings.test.noServer }
  if (data?.error === 'no_subscriptions') {
    return { ok: false, message: strings.settings.test.noSubscription }
  }
  if (!data?.ok) return { ok: false, message: strings.settings.test.rejected }
  return { ok: true, message: strings.settings.test.sent(data.delivered, data.devices) }
}
