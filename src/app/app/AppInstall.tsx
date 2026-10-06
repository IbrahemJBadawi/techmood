'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';

import { useT } from '@/lib/i18n.client';
import { track } from '@/lib/analytics';
import { promptInstall, useInstallState } from '@/lib/install-client';

type Device = 'iphone' | 'android' | 'desktop' | 'unknown';

function readDevice(): Device {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; a touch screen gives it away.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'iphone';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}
const noop = () => () => undefined;

/** Inside Facebook, Instagram, Messenger, TikTok… — browsers that cannot install. */
function readInApp() {
  return /FBAN|FBAV|Instagram|Messenger|TikTok|Snapchat|Line\/|; wv\)/i.test(navigator.userAgent);
}

/**
 * The install card on /app: what to do on *this* device. One tap where the
 * browser offers an install (Chrome, Edge, Samsung Internet), the Safari steps
 * on iPhone, the menu steps elsewhere, and on a computer a QR code to carry it
 * to the phone.
 */
export function AppInstall({ qr }: { qr: string }) {
  const t = useT();
  const install = useInstallState();
  const device = useSyncExternalStore<Device>(noop, readDevice, () => 'unknown');
  const inApp = useSyncExternalStore(noop, readInApp, () => false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function onInstall() {
    setBusy(true);
    try {
      const accepted = await promptInstall();
      track(accepted ? 'app_installed' : 'app_install_dismissed', { device });
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  }

  let body: React.ReactNode;
  if (device === 'unknown') {
    body = <p className="muted">…</p>;
  } else if (install.installed) {
    body = (
      <>
        <p className="app-state"><span className="status-pill status-ok">{t('✓ مثبّت', '✓ Installed')}</span> {t('TechMood مثبّت على هذا الجهاز.', 'TechMood is installed on this device.')}</p>
        <Link className="btn btn-primary" href="/home">{t('افتح TechMood', 'Open TechMood')}</Link>
      </>
    );
  } else if (inApp) {
    body = (
      <>
        <p>{t('أنت تفتح الصفحة داخل تطبيق آخر، وهذا لا يسمح بالتثبيت. افتحها في المتصفح:',
              'You opened this page inside another app, which cannot install. Open it in your browser:')}</p>
        <ol className="app-steps">
          <li>{t('اضغط ⋮ أو ⋯ أعلى الشاشة', 'Tap ⋮ or ⋯ at the top')}</li>
          <li>{device === 'iphone' ? t('اختر «فتح في Safari»', 'Choose “Open in Safari”') : t('اختر «فتح في Chrome» أو «فتح في المتصفح»', 'Choose “Open in Chrome” or “Open in browser”')}</li>
        </ol>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copyLink}>
          {copied ? t('✓ نُسخ الرابط', '✓ Link copied') : t('انسخ الرابط', 'Copy the link')}
        </button>
      </>
    );
  } else if (install.canPrompt) {
    body = (
      <>
        <p>{t('ثبّته بضغطة واحدة — يظهر على الشاشة الرئيسية ويفتح كتطبيق.', 'Install it in one tap — it appears on your home screen and opens as an app.')}</p>
        <button type="button" className="btn btn-primary app-install-btn" onClick={onInstall} disabled={busy}>
          {busy ? t('جارٍ…', 'Working…') : t('⬇ ثبّت التطبيق', '⬇ Install the app')}
        </button>
      </>
    );
  } else if (device === 'iphone') {
    body = (
      <>
        <p>{t('على iPhone وiPad، من Safari:', 'On iPhone and iPad, in Safari:')}</p>
        <ol className="app-steps">
          <li>{t('اضغط زر المشاركة', 'Tap the Share button')} <ShareIcon /> {t('أسفل الشاشة', 'at the bottom')}</li>
          <li>{t('مرّر واختر «إضافة إلى الشاشة الرئيسية»', 'Scroll and choose “Add to Home Screen”')} <span aria-hidden="true">⊞</span></li>
          <li>{t('اضغط «إضافة» — ثم افتح TechMood من أيقونته', 'Tap “Add” — then open TechMood from its icon')}</li>
        </ol>
        <p className="muted app-small">{t('في Chrome على iPhone: زر المشاركة أعلى الشاشة بجانب الرابط.', 'In Chrome on iPhone: the Share button is at the top, next to the address.')}</p>
      </>
    );
  } else if (device === 'android') {
    body = (
      <>
        <p>{t('من Chrome على Android:', 'In Chrome on Android:')}</p>
        <ol className="app-steps">
          <li>{t('اضغط قائمة المتصفح ⋮ أعلى الشاشة', 'Tap the browser menu ⋮ at the top')}</li>
          <li>{t('اختر «تثبيت التطبيق» (أو «إضافة إلى الشاشة الرئيسية» ثم «تثبيت»)', 'Choose “Install app” (or “Add to Home screen”, then “Install”)')}</li>
          <li>{t('افتح TechMood من أيقونته', 'Open TechMood from its icon')}</li>
        </ol>
      </>
    );
  } else {
    body = (
      <>
        <p>{t('على الكمبيوتر: من Chrome أو Edge اضغط أيقونة التثبيت ⊕ في شريط العنوان، أو من القائمة ⋮ «تثبيت TechMood».',
              'On a computer: in Chrome or Edge click the install icon ⊕ in the address bar, or menu ⋮ → “Install TechMood”.')}</p>
      </>
    );
  }

  return (
    <section className="panel section-block app-install">
      <div className="app-install-main">
        <div className="app-install-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" width={56} height={56} className="app-icon" />
          <div>
            <strong className="app-name">TechMood</strong>
            <span className="muted app-small">{t('تعلّم · إرشاد · فرق · معرض', 'Learn · Mentor · Teams · Gallery')}</span>
          </div>
        </div>
        {body}
      </div>
      {device !== 'iphone' && device !== 'android' && (
        <figure className="app-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={t('رمز QR لصفحة التطبيق', 'QR code for the app page')} width={160} height={160} />
          <figcaption className="muted app-small">{t('امسحه بكاميرا جوالك لتثبيته هناك', 'Scan it with your phone camera to install it there')}</figcaption>
        </figure>
      )}
    </section>
  );
}

function ShareIcon() {
  return (
    <svg className="app-share-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share">
      <path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
    </svg>
  );
}
