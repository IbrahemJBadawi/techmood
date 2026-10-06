'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { useT } from '@/lib/i18n.client';
import { claimOfflinePages } from '@/lib/offline-client';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/** When the service worker served this page from what it kept (sw.js marks it). */
function readSavedAt() {
  return document.querySelector('meta[name="tm-offline-copy"]')?.getAttribute('content') ?? '';
}

/**
 * A thin bar while TechMood shows a saved copy: without a connection, or when
 * the line was too slow and the service worker answered from the device.
 * Reading works; anything that changes something waits for the connection.
 * With the device online again (or online but too slow), one tap tries the
 * fresh page.
 */
export function OfflineStatus() {
  const t = useT();
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  const savedAt = useSyncExternalStore(() => () => undefined, readSavedAt, () => '');
  const [dismissed, setDismissed] = useState(false);

  if (online && (!savedAt || dismissed)) return null;

  const when = savedAt ? new Date(savedAt) : null;
  const stamp = when && !Number.isNaN(when.getTime())
    ? when.toLocaleString(t.locale === 'ar' ? 'ar' : 'en', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className={`offline-bar${online ? ' is-back' : ''}`} role="status">
      <span className="offline-dot" aria-hidden="true" />
      <span className="offline-text">
        {online
          ? t('تشاهد نسخة محفوظة — الاتصال ضعيف أو انقطع', 'You are seeing a saved copy — the connection is weak or dropped')
          : t('لا يوجد اتصال — تشاهد آخر نسخة محفوظة', 'No connection — you are seeing the last saved copy')}
        {stamp && <span className="offline-when"> · {stamp}</span>}
        {!online && <span className="offline-when"> · {t('التعديل يحتاج اتصالاً', 'changes need a connection')}</span>}
      </span>
      {online ? (
        <span className="offline-actions">
          <button type="button" className="btn btn-sm btn-primary" onClick={() => window.location.reload()}>{t('حدّث', 'Refresh')}</button>
          <button type="button" className="offline-close" aria-label={t('إغلاق', 'Close')} onClick={() => setDismissed(true)}>×</button>
        </span>
      ) : null}
    </div>
  );
}

/** In the signed-in app: the pages kept on this device are this member's, or none. */
export function OfflineOwner({ memberId }: { memberId: string }) {
  useEffect(() => { claimOfflinePages(memberId); }, [memberId]);
  return null;
}
