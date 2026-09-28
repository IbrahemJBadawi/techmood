/*
 * TechMood service worker.
 *
 * Deliberately small: TechMood's pages are personal and change constantly, so
 * nothing a person sees is served from a cache. The worker does three things:
 * shows an offline page when a navigation fails, receives device notifications
 * (push), and opens the right page when one is tapped.
 */
const OFFLINE = '/offline.html';
const CACHE = 'techmood-shell-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE, '/logo-mark.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || 'TechMood';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/logo-mark.png',
    badge: '/logo-mark.png',
    dir: 'rtl',
    lang: 'ar',
    tag: data.tag || undefined,
    data: { url: data.url || '/notifications' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) { client.navigate(url); return client.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});
