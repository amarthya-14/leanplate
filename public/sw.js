// Minimal service worker: lets the app show notifications and be installed.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => 'focus' in c)
      if (open) {
        open.navigate('/#today')
        return open.focus()
      }
      return self.clients.openWindow('/#today')
    }),
  )
})

// Network passthrough (keeps the SW installable without caching stale builds)
self.addEventListener('fetch', () => {})
