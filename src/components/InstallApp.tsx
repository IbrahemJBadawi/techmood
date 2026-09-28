'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { useT } from '@/lib/i18n.client';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = 'tm-install-dismissed';
const QUIET_DAYS = 14;

function standalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function iOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// The browser's facts are read, not copied into state; the server renders as
// if the banner were dismissed, so nothing flashes before hydration.
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

/**
 * Registers the service worker, and offers to put TechMood on the home screen.
 *
 * `banner` is the quiet suggestion in the app shell: shown once, and after a
 * dismissal not again for two weeks. `inline` is the button in Settings, always
 * there. On iPhone, where browsers cannot prompt, both explain the two taps.
 */
export function InstallApp({ variant = 'banner' }: { variant?: 'banner' | 'inline' }) {
  const t = useT();
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [accepted, setAccepted] = useState(false);
  const runningInstalled = useSyncExternalStore(noSubscribe, standalone, () => false);
  const apple = useSyncExternalStore(noSubscribe, iOS, () => false);
  const hidden = useSyncExternalStore(subscribeQuiet, readQuiet, () => true);
  const installed = runningInstalled || accepted;

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallEvent);
    };
    const onInstalled = () => setAccepted(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    quietListeners.forEach((listener) => listener());
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') setAccepted(true);
    setDeferred(null);
  }

  if (installed) {
    return variant === 'inline'
      ? <p className="notice notice-ok">{t('TechMood مثبّت على جهازك.', 'TechMood is installed on this device.')}</p>
      : null;
  }

  const canPrompt = Boolean(deferred);
  if (variant === 'banner' && (hidden || (!canPrompt && !apple))) return null;

  return (
    <div className={variant === 'banner' ? 'install-banner no-print' : 'panel'}>
      <span style={{ flex: 1 }}>
        {canPrompt
          ? t('أضف TechMood إلى الشاشة الرئيسية ليفتح كتطبيق.', 'Add TechMood to your home screen to open it like an app.')
          : apple
            ? t('على iPhone: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».', 'On iPhone: tap Share, then “Add to Home Screen”.')
            : t('افتح TechMood من Chrome أو Edge على هاتفك لتثبيته كتطبيق.', 'Open TechMood in Chrome or Edge on your phone to install it as an app.')}
      </span>
      {canPrompt && (
        <button className="btn btn-primary btn-sm" type="button" onClick={install}>{t('تثبيت', 'Install')}</button>
      )}
      {variant === 'banner' && (
        <button className="btn btn-ghost btn-sm" type="button" onClick={dismiss} aria-label={t('إخفاء', 'Dismiss')}>
          {t('لاحقاً', 'Later')}
        </button>
      )}
    </div>
  );
}
