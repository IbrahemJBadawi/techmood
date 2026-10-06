'use client';

/**
 * The pages the service worker keeps for opening TechMood without a
 * connection (public/sw.js) belong to whoever is signed in on this device.
 * They are forgotten on sign-out, and when a different member signs in here
 * (an expired session never says goodbye), so nobody opens someone else's
 * saved pages.
 */
const PAGES = 'techmood-pages-v1';
const OWNER = 'tm-offline-owner';

export function forgetOfflinePages() {
  try {
    navigator.serviceWorker?.controller?.postMessage('tm-forget-pages');
    void caches?.delete(PAGES);
    localStorage.removeItem(OWNER);
  } catch {
    // no storage here: nothing was kept either
  }
}

/** Called in the signed-in app: the saved pages are this member's, or none. */
export function claimOfflinePages(memberId: string) {
  try {
    const owner = localStorage.getItem(OWNER);
    if (owner && owner !== memberId) forgetOfflinePages();
    localStorage.setItem(OWNER, memberId);
  } catch {
    // private window: the service worker keeps nothing worth guarding
  }
}
