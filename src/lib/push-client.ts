'use client';

import { removePushSubscription, savePushSubscription } from '@/app/(app)/settings/notifications/actions';

/**
 * Device notifications (0100), used by DeviceSetup on Settings and on the home
 * page: the browser asks the person, gives a subscription, and TechMood keeps
 * it for this device only (push_subscriptions). The daily reminders (0114) and
 * every category the person left on «device» reach them through it.
 *
 * Needs the public VAPID key (platform_settings, read with push_public_key());
 * without it every device reads as 'unsupported'. The private key lives only
 * in Supabase Vault and is used by the push-dispatch Edge Function.
 */

export type PushStatus = 'loading' | 'unsupported' | 'denied' | 'off' | 'on';

function keyBytes(base64url: string) {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function encode(buffer: ArrayBuffer | null) {
  if (!buffer) return '';
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function pushSupported(publicKey: string | null): boolean {
  return Boolean(publicKey)
    && typeof window !== 'undefined'
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function readPushStatus(publicKey: string | null): Promise<PushStatus> {
  if (!pushSupported(publicKey)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const registration = await navigator.serviceWorker.register('/sw.js');
  const existing = await registration.pushManager.getSubscription();
  return existing ? 'on' : 'off';
}

/** Asks, subscribes and saves. Returns the new status, or an error to show. */
export async function turnPushOn(publicKey: string): Promise<{ status: PushStatus; error?: string }> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { status: permission === 'denied' ? 'denied' : 'off' };
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
  const result = await savePushSubscription({
    endpoint: subscription.endpoint,
    p256dh: encode(subscription.getKey('p256dh')),
    auth: encode(subscription.getKey('auth')),
    userAgent: navigator.userAgent,
  });
  return result.error ? { status: 'off', error: result.error } : { status: 'on' };
}

/** Stops notifications on this device: forgets the subscription on both sides. */
export async function turnPushOff(): Promise<PushStatus> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await removePushSubscription(subscription.endpoint);
    await subscription.unsubscribe();
  }
  return 'off';
}
