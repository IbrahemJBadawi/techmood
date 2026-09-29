'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { useT } from '@/lib/i18n.client';
import { readPushStatus, turnPushOn, type PushStatus } from '@/lib/push-client';

const DISMISS_KEY = 'tm-push-dismissed';
const QUIET_DAYS = 7;

let quietListeners: (() => void)[] = [];
const noSubscribe = () => () => undefined;
function subscribeQuiet(listener: () => void) {
  quietListeners.push(listener);
  return () => { quietListeners = quietListeners.filter((entry) => entry !== listener); };
}
function readQuiet() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return at > 0 && Date.now() - at < QUIET_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}
function iPhoneInBrowser() {
  const apple = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installed = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return apple && !installed;
}

/**
 * The companion of «add to home screen»: a quiet suggestion in the app shell
 * to turn on notifications on this device, for the daily reminders — the
 * streak, the day's sessions, the week's league — and everything else a
 * person already chose to hear about. Shown only where it can work, only
 * while it is off, and after «later» not again for a week. On iPhone, where
 * Safari gives notifications only to an installed app, it waits for that.
 */
export function EnablePush({ publicKey }: { publicKey: string | null }) {
  const t = useT();
  const [status, setStatus] = useState<PushStatus>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hidden = useSyncExternalStore(subscribeQuiet, readQuiet, () => true);
  const waitForInstall = useSyncExternalStore(noSubscribe, iPhoneInBrowser, () => true);

  useEffect(() => {
    let cancelled = false;
    readPushStatus(publicKey)
      .then((next) => { if (!cancelled) setStatus(next); })
      .catch(() => { if (!cancelled) setStatus('unsupported'); });
    return () => { cancelled = true; };
  }, [publicKey]);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    quietListeners.forEach((listener) => listener());
  }

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    setError('');
    try {
      const result = await turnPushOn(publicKey);
      setStatus(result.status);
      if (result.error) setError(result.error);
    } catch {
      setError(t('تعذّر تفعيل الإشعارات على هذا الجهاز.', 'Notifications could not be turned on here.'));
    } finally {
      setBusy(false);
    }
  }

  if (status !== 'off' || hidden || waitForInstall) return null;

  return (
    <div className="install-banner push-banner no-print" role="region" aria-label={t('تفعيل الإشعارات', 'Turn on notifications')}>
      <span aria-hidden="true" className="push-banner-icon">🔔</span>
      <span style={{ flex: 1 }}>
        {t('فعّل الإشعارات على هذا الجهاز: تذكير يومي بحماستك وجلسات يومك وترتيبك في دوري الأسبوع.',
           'Turn on notifications on this device: a daily reminder of your streak, the day’s sessions and your place in the week’s league.')}
        {error && <span className="push-banner-error">{error}</span>}
      </span>
      <button className="btn btn-primary btn-sm" type="button" onClick={enable} disabled={busy}>
        {busy ? t('جارٍ…', 'Working…') : t('فعّل', 'Turn on')}
      </button>
      <button className="btn btn-ghost btn-sm" type="button" onClick={dismiss}>
        {t('لاحقاً', 'Later')}
      </button>
    </div>
  );
}
