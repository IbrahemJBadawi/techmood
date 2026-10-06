/*
 * TechMood service worker.
 *
 * Pages always come from the network first, so what a person sees online is
 * never stale. Every page they open is also kept on this device, so without
 * a connection (or on a line too slow to answer) TechMood opens on the last
 * copy of that page instead of an error — with a bar saying it is a saved
 * copy (OfflineStatus reads the <meta name="tm-offline-copy"> added here).
 *
 *   * pages         — network first; the saved copy when the network fails or
 *                     is slower than NAV_TIMEOUT. Only this person's own: the
 *                     app forgets them on sign-out and when another member
 *                     signs in on the device (src/lib/offline-client.ts).
 *   * /_next/static — the app's code, fonts and styles. Their names change
 *                     with every build, so a saved copy is always right.
 *   * icons and screenshots — cache first.
 *
 * It also receives device notifications (push) and opens the right page when
 * one is tapped.
 */
const OFFLINE = '/offline.html';
const SHELL = 'techmood-shell-v3';
const PAGES = 'techmood-pages-v1';
const STATIC = 'techmood-static-v1';
const MAX_PAGES = 60;
const MAX_STATIC = 400;
const NAV_TIMEOUT = 6000;

// Never kept: signing in and out, the auth round trip, analytics.
const NO_KEEP = /^\/(login|signup|auth|ingest|api|onboarding)(\/|$)/;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll([OFFLINE, '/logo-mark.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keep = [SHELL, PAGES, STATIC];
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** Keeps a cache to its newest `max` entries (keys come back oldest first). */
async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((key) => cache.delete(key)));
}

/** The page's address: ?tab=… pages are kept apart, the router's _rsc is not. */
function pageKey(url) {
  const u = new URL(url);
  u.searchParams.delete('_rsc');
  u.hash = '';
  return u.toString();
}

/** A saved page, marked so the app can say it is a saved copy, and from when. */
async function savedCopy(request) {
  const cache = await caches.open(PAGES);
  const hit = await cache.match(pageKey(request.url));
  if (!hit) return null;
  const saved = (hit.headers.get('x-tm-saved') || '').replace(/[^0-9TZ:.-]/g, '');
  const html = (await hit.text()).replace('<head>', `<head><meta name="tm-offline-copy" content="${saved}">`);
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function keepPage(request, response) {
  // A redirect (to sign-in, to /home…) is not this page; an error is not worth keeping.
  if (!response.ok || response.redirected || response.type !== 'basic') return;
  if (!(response.headers.get('content-type') || '').includes('text/html')) return;
  const body = await response.blob();
  const cache = await caches.open(PAGES);
  await cache.put(pageKey(request.url), new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'x-tm-saved': new Date().toISOString() },
  }));
  await trim(PAGES, MAX_PAGES);
}

async function navigate(event) {
  const { request } = event;
  const network = fetch(request);
  if (NO_KEEP.test(new URL(request.url).pathname)) return network.catch(() => caches.match(OFFLINE));

  // Whatever the network answers, even late, refreshes the saved copy.
  event.waitUntil(network.then((response) => keepPage(request, response.clone())).catch(() => undefined));

  const slow = new Promise((resolve) => setTimeout(() => resolve('slow'), NAV_TIMEOUT));
  const first = await Promise.race([network.catch(() => 'down'), slow]);
  if (first !== 'down' && first !== 'slow') return first;

  const saved = await savedCopy(request);
  if (saved) return saved;
  // Nothing saved: on a slow line keep waiting for the network rather than give up.
  if (first === 'slow') return network.catch(() => caches.match(OFFLINE));
  return caches.match(OFFLINE);
}

async function cacheFirst(request) {
  const hit = await caches.match(request); // the shell's logo included
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(STATIC);
    await cache.put(request, response.clone());
    trim(STATIC, MAX_STATIC);
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigate(event));
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || /^\/(screenshots\/|logo|icon|apple-icon)/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

// The app asks to forget this person's saved pages (sign-out, another member).
self.addEventListener('message', (event) => {
  if (event.data === 'tm-forget-pages') event.waitUntil(caches.delete(PAGES));
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
