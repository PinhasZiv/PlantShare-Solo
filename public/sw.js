/* PlantShare service worker.
 *
 * Two jobs:
 *   1. Receive push messages while the app is closed and show the notification.
 *   2. Open (or focus) the app on the Tonight list when that notification is
 *      tapped - the "notification redirects to the app" part of the brief.
 *
 * Caching is deliberately modest. The app is useless without the network
 * anyway, so the cache exists to make a warm start instant, not to fake an
 * offline mode that would show stale watering state.
 */

const CACHE = 'plantshare-v1'
const SCOPE_PATH = new URL(self.registration.scope).pathname

// The notification body/title come from the server already worded in the
// person's own language (see supabase/functions/_shared/messages.ts), but the
// action button titles are drawn locally - they never went through that path,
// so they need their own tiny lookup by the same `lang` field.
const ACTION_LABELS = {
  he: { open: 'פתיחת הרשימה', snooze: 'השהיה' },
  en: { open: 'Open list', snooze: 'Snooze' },
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(SCOPE_PATH)).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // never cache Supabase calls

  // Navigations: try the network so a deploy is picked up immediately, and fall
  // back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(SCOPE_PATH, copy)).catch(() => {})
          return response
        })
        .catch(() => caches.match(SCOPE_PATH).then((hit) => hit || Response.error())),
    )
    return
  }

  // Built assets carry a content hash in the filename, so a cache hit is always
  // the right answer for them.
  if (/\.(js|css|png|svg|webmanifest|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
            return response
          }),
      ),
    )
  }
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'PlantShare', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'הגיע הזמן להשקות'
  const labels = ACTION_LABELS[payload.lang] || ACTION_LABELS.he
  const options = {
    body: payload.body || '',
    // The interface is Hebrew, so the notification is laid out right to left
    // too - otherwise the tray renders the punctuation on the wrong side.
    lang: payload.lang || 'he',
    dir: payload.dir || 'rtl',
    // A stable tag replaces yesterday's notification instead of stacking.
    tag: payload.tag || 'plantshare',
    renotify: true,
    icon: `${SCOPE_PATH}icons/icon-192.png`,
    badge: `${SCOPE_PATH}icons/badge-96.png`,
    // A watering reminder should survive a glance at the phone; it stays until
    // it is dealt with.
    requireInteraction: !payload.test,
    vibrate: [120, 60, 120],
    data: {
      spaceId: payload.spaceId || null,
      url: payload.spaceId ? `${SCOPE_PATH}?space=${payload.spaceId}` : SCOPE_PATH,
    },
    // A test notification has no real due plants behind it, so the Snooze
    // action - which opens the app straight to a duration picker for
    // whatever is currently due - would just land on an empty picker.
    actions: payload.test
      ? [{ action: 'open', title: labels.open }]
      : [
          { action: 'open', title: labels.open },
          { action: 'snooze', title: labels.snooze },
        ],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const base = (event.notification.data && event.notification.data.url) || SCOPE_PATH
  // The Snooze action opens straight into the in-app duration picker for
  // whatever is due right now - there is no single plant to target from a
  // notification that can cover several at once, so the app decides which
  // plants to offer once it is actually open, not this service worker.
  const target = event.action === 'snooze' ? base + (base.includes('?') ? '&' : '?') + 'snooze=1' : base

  event.waitUntil(openApp(new URL(target, self.location.origin).href))
})

// How long a window gets to answer focus() before the tap opens a fresh one.
const FOCUS_TIMEOUT_MS = 1500

function isPhone() {
  const data = self.navigator.userAgentData
  if (data && typeof data.mobile === 'boolean') return data.mobile
  return /Android|iPhone|iPad|iPod|Mobile/i.test(self.navigator.userAgent || '')
}

/**
 * Brings the app up at `url` after a notification tap.
 *
 * Chrome grants the tap a single "window interaction", and focus() and
 * openWindow() each spend it - so whichever is called first is the only one
 * that can bring a window up. On a phone, focus() on an app sitting in the
 * background (or frozen there by Android) can fail or never answer, leaving
 * the tap with no result at all. openWindow() is how the phone launches the
 * installed app at a URL, running or not, so that is the one used there.
 * focus() is kept for an app already on screen, and for desktops, where it
 * brings the existing window forward instead of opening another.
 */
async function openApp(url) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const app = windows.find((client) => new URL(client.url).pathname.startsWith(SCOPE_PATH))
  if (!app || (isPhone() && app.visibilityState !== 'visible')) return self.clients.openWindow(url)

  const focused = await Promise.race([
    app.focus().catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), FOCUS_TIMEOUT_MS)),
  ])
  // Chrome has spent the tap by now, but other browsers may still allow this.
  if (!focused) return self.clients.openWindow(url).catch(() => null)

  try {
    return await focused.navigate(url)
  } catch {
    // navigate() only works on a page this worker controls - one opened
    // before the worker took over is asked to go there itself (see main.tsx).
    focused.postMessage({ type: 'open-url', url })
    return focused
  }
}
