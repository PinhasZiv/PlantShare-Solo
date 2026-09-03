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

  const title = payload.title || 'Time to water'
  const options = {
    body: payload.body || '',
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
    actions: [{ action: 'open', title: 'Open list' }],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || SCOPE_PATH

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Prefer an already-open copy: focusing it keeps the person's place, and
      // navigating it applies the space from the notification.
      for (const client of clients) {
        if (new URL(client.url).pathname.startsWith(SCOPE_PATH)) {
          return client.focus().then((focused) => {
            if ('navigate' in focused) return focused.navigate(target).catch(() => focused)
            return focused
          })
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
