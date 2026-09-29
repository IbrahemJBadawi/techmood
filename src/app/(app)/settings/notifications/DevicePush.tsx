'use client';

import { useEffect, useState } from 'react';

import { useT } from '@/lib/i18n.client';

import { readPushStatus, turnPushOn, type PushStatus } from '@/lib/push-client';

import { removePushSubscription } from './actions';

type Status = PushStatus;

/**
 * Device notifications on this phone or computer (0100): the browser asks the
 * person, gives a subscription, and TechMood keeps it for this device only.
 * What reaches the device follows the "Device" column below.
 */
export function DevicePush({ publicKey }: { publicKey: string | null }) {
  const t = useT();
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readPushStatus(publicKey)
      .then((next) => { if (!cancelled) setStatus(next); })
      .catch(() => { if (!cancelled) setStatus('unsupported'); });
    return () => { cancelled = true; };
  }, [publicKey]);

  async function turnOn() {
    if (!publicKey) return;
    setBusy(true);
    setError('');
    try {
      const result = await turnPushOn(publicKey);
      setStatus(result.status);
      if (result.error) setError(result.error);
    } catch {
      setError(t('تعذّر تفعيل الإشعارات على هذا الجهاز.', 'Device notifications could not be turned on.'));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus('off');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="row-between" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div>
          <strong style={{ fontSize: '0.95rem' }}>{t('إشعارات على هذا الجهاز', 'Notifications on this device')}</strong>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            {status === 'on' && t('مفعّلة — تصلك حتى والمنصة مغلقة، ومعها تذكير صباحي بيومك وترتيبك في الدوري، ومسائي بحماستك.', 'On — they reach you even with TechMood closed, with a morning reminder of your day and league place, and an evening one for your streak.')}
            {status === 'off' && t('غير مفعّلة على هذا الجهاز.', 'Off on this device.')}
            {status === 'denied' && t('المتصفح يمنعها. فعّلها من إعدادات الموقع في المتصفح ثم عد هنا.', 'The browser blocks them. Allow them in the site settings of your browser, then come back.')}
            {status === 'unsupported' && t('هذا المتصفح لا يدعمها. على iPhone: ثبّت TechMood على الشاشة الرئيسية أولاً ثم افتحه منها.', 'This browser does not support them. On iPhone: install TechMood on the home screen first, then open it from there.')}
            {status === 'loading' && '…'}
          </p>
        </div>
        {status === 'off' && (
          <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={turnOn}>
            {busy ? t('جارٍ…', 'Working…') : t('فعّل', 'Turn on')}
          </button>
        )}
        {status === 'on' && (
          <button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={turnOff}>
            {t('أوقف', 'Turn off')}
          </button>
        )}
      </div>
      {error && <p className="notice notice-danger" style={{ marginTop: 10 }}>{error}</p>}
    </div>
  );
}
