'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { LogoMark } from '@/components/Logo';
import { promptInstall, useInstallState } from '@/lib/install-client';
import { useT } from '@/lib/i18n.client';

const DISMISS_KEY = 'tm-install-float-dismissed';
const DISMISS_DAYS = 7;

/**
 * «ثبّت TechMood كتطبيق» — a small floating card on every public page.
 *
 * It is not shown when the site already runs installed, on the /app page that
 * explains installing at length, or for a week after the visitor closes it.
 * Where the browser offers an install (Chrome, Edge, Android) one tap opens
 * it; on an iPhone it says the two taps Safari needs; anywhere else it leads
 * to /app.
 */
export function InstallFloat() {
  const t = useT();
  const pathname = usePathname();
  const { installed, canPrompt, apple } = useInstallState();
  const [shown, setShown] = useState(false);
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    // after the page has settled, so it does not jump in with the first paint;
    // and not for a week after the visitor closed it
    const timer = window.setTimeout(() => {
      let dismissedAt = 0;
      try { dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0); } catch { /* storage may be blocked */ }
      setShown(Date.now() - dismissedAt >= DISMISS_DAYS * 864e5);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  if (installed || !shown || pathname === '/app') return null;

  function close() {
    try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setShown(false);
  }

  async function install() {
    if (canPrompt) {
      if (await promptInstall()) setShown(false);
      return;
    }
    if (apple) setSteps(true);
  }

  return (
    <aside className="install-float" role="complementary" aria-label={t('تثبيت التطبيق', 'Install the app')}>
      <button type="button" className="install-float-close" onClick={close} aria-label={t('إغلاق', 'Close')}>×</button>
      <span className="install-float-logo" aria-hidden="true"><LogoMark size={30} /></span>
      <div className="install-float-text">
        <strong>{t('ثبّت TechMood كتطبيق', 'Install TechMood as an app')}</strong>
        {steps ? (
          <span>{t('في Safari: اضغط زر المشاركة ⬆︎ ثم «إضافة إلى الشاشة الرئيسية».', 'In Safari: tap Share ⬆︎, then «Add to Home Screen».')}</span>
        ) : (
          <span>{t('مجاني وخفيف، يفتح من شاشتك الرئيسية ويصلك بالإشعارات.', 'Free and light — opens from your home screen, with notifications.')}</span>
        )}
      </div>
      {canPrompt || apple ? (
        !steps && <button type="button" className="install-float-btn" onClick={install}>{t('ثبّت', 'Install')}</button>
      ) : (
        <Link className="install-float-btn" href="/app">{t('ثبّت', 'Install')}</Link>
      )}
    </aside>
  );
}
