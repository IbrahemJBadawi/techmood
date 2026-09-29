'use client';

/**
 * «Add to home screen» — one store for the whole app.
 *
 * Chrome and Edge fire `beforeinstallprompt` once, early, on whatever page the
 * person opened first. If only the component on /home listened, arriving on
 * /home later (a client-side navigation) would find the event already gone and
 * the Install button would never appear. So the event is caught here, at module
 * load, and kept; every Install button reads it through `useInstallState`.
 *
 * `startInstallCapture()` must run once in the app shell (see
 * src/components/DeviceSetup.tsx → ServiceWorker), which also registers the
 * service worker that notifications and installing both need.
 *
 * iPhone never fires the event: Safari installs only from Share → «Add to Home
 * Screen», so there the UI explains the two taps instead of showing a button.
 */

import { useSyncExternalStore } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallEvent | null = null;
let acceptedNow = false;
let started = false;
let listeners: (() => void)[] = [];

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => { listeners = listeners.filter((entry) => entry !== listener); };
}

/** Listens for the browser's install offer and registers the service worker. Safe to call more than once. */
export function startInstallCapture() {
  if (started || typeof window === 'undefined') return;
  started = true;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // keep it for our own button instead of the browser's mini-bar
    deferred = event as InstallEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    acceptedNow = true;
    deferred = null;
    emit();
  });
}

function runningInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export type InstallState = {
  /** Opened from the home screen, or just installed. */
  installed: boolean;
  /** The browser offered an install we can trigger with one tap. */
  canPrompt: boolean;
  /** iPhone/iPad: installing is Share → «Add to Home Screen». */
  apple: boolean;
};

// A stable snapshot per change, as useSyncExternalStore requires.
let snapshot: InstallState | null = null;
let snapshotKey = '';
function readState(): InstallState {
  const next = {
    installed: acceptedNow || runningInstalled(),
    canPrompt: Boolean(deferred),
    apple: /iphone|ipad|ipod/i.test(navigator.userAgent),
  };
  const key = `${next.installed}|${next.canPrompt}|${next.apple}`;
  if (!snapshot || key !== snapshotKey) {
    snapshot = next;
    snapshotKey = key;
  }
  return snapshot;
}

// On the server nothing is known; render as "nothing to offer" so the page
// does not flash a button before the browser has spoken.
const SERVER_STATE: InstallState = { installed: true, canPrompt: false, apple: false };

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, readState, () => SERVER_STATE);
}

/** Opens the browser's install dialog. Returns true when the person accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  await event.prompt();
  const choice = await event.userChoice;
  deferred = null; // a prompt can be shown only once
  if (choice.outcome === 'accepted') acceptedNow = true;
  emit();
  return choice.outcome === 'accepted';
}

// Catch the offer as early as this code loads in the browser, before React
// effects run — the event can fire before hydration finishes.
if (typeof window !== 'undefined') startInstallCapture();
