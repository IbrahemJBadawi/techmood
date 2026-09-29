'use client';

import { useEffect, useState } from 'react';

import { Icon } from '@/components/Icon';
import { useT } from '@/lib/i18n.client';
import { promptInstall, startInstallCapture, useInstallState } from '@/lib/install-client';
import { readPushStatus, turnPushOff, turnPushOn, type PushStatus } from '@/lib/push-client';

/**
 * This device: TechMood on the home screen, and notifications on.
 *
 *   variant="settings" — always shown (Settings and Settings → Notifications):
 *                        both rows, their state, and the button to change it.
 *   variant="home"     — the card on the home page, shown only while one of
 *                        the two is still to do on this device, and gone once
 *                        both are done. There is no «later»: it stays until done.
 *
 * Which step comes first matters on iPhone: Safari gives notifications only
 * to an installed app, so there the card asks to install first and explains
 * that notifications follow.
 *
 * The page passes the public VAPID key (push_public_key()); the browser keeps
 * the subscription, the server keeps a copy per device (0100).
 */
export function DeviceSetup({ publicKey, variant }: { publicKey: string | null; variant: 'home' | 'settings' }) {
  const t = useT();
  const install = useInstallState();
  const [push, setPush] = useState<PushStatus>('loading');
  const [busy, setBusy] = useState<'' | 'install' | 'push'>('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    readPushStatus(publicKey)
      .then((next) => { if (!cancelled) setPush(next); })
      .catch(() => { if (!cancelled) setPush('unsupported'); });
    return () => { cancelled = true; };
  }, [publicKey, install.installed]);

  async function onInstall() {
    setBusy('install');
    try { await promptInstall(); } finally { setBusy(''); }
  }

  async function onPushOn() {
    if (!publicKey) return;
    setBusy('push');
    setError('');
    try {
      const result = await turnPushOn(publicKey);
      setPush(result.status);
      if (result.error) setError(result.error);
    } catch {
      setError(t('تعذّر تفعيل الإشعارات على هذا الجهاز.', 'Notifications could not be turned on here.'));
    } finally {
      setBusy('');
    }
  }

  async function onPushOff() {
    setBusy('push');
    setError('');
    try {
      setPush(await turnPushOff());
    } catch {
      setError(t('تعذّر إيقاف الإشعارات.', 'Notifications could not be turned off.'));
    } finally {
      setBusy('');
    }
  }

  // iPhone in Safari: notifications wait for the installed app.
  const pushNeedsInstall = install.apple && !install.installed && push === 'unsupported';
  // Something the person can actually do right now, per row.
  const installTodo = !install.installed && (install.canPrompt || install.apple);
  const pushTodo = push === 'off' || push === 'denied' || pushNeedsInstall;

  if (variant === 'home' && (push === 'loading' || (!installTodo && !pushTodo))) return null;

  const installRow = (
    <li className="device-row">
      <span className="device-icon" aria-hidden="true"><Icon name="home" size={18} /></span>
      <div className="device-text">
        <strong>{t('TechMood على الشاشة الرئيسية', 'TechMood on the home screen')}</strong>
        <span className="muted">
          {install.installed
            ? t('مثبّت على هذا الجهاز ويفتح كتطبيق.', 'Installed on this device; it opens like an app.')
            : install.canPrompt
              ? t('يفتح كتطبيق بضغطة، بلا شريط المتصفح.', 'Opens like an app in one tap, without the browser bar.')
              : install.apple
                ? t('على iPhone من Safari: اضغط زر المشاركة ⎋ ثم «إضافة إلى الشاشة الرئيسية» — يفتح كتطبيق مستقل.', 'On iPhone in Safari: tap Share ⎋, then “Add to Home Screen” — it opens as its own app.')
                // Chrome's «Add to Home screen» can make a plain shortcut; «Install app» makes the app.
                : t('من قائمة المتصفح ⋮ اختر «تثبيت التطبيق» (وليس «إنشاء اختصار»).', 'From the browser menu ⋮ choose “Install app” (not “Create shortcut”).')}
        </span>
      </div>
      {install.installed
        ? <span className="status-pill status-ok">{t('مفعّل', 'Done')}</span>
        : install.canPrompt && (
          <button className="btn btn-primary btn-sm" type="button" onClick={onInstall} disabled={busy !== ''}>
            {busy === 'install' ? t('جارٍ…', 'Working…') : t('ثبّت', 'Install')}
          </button>
        )}
    </li>
  );

  const pushRow = (
    <li className="device-row">
      <span className="device-icon" aria-hidden="true"><Icon name="bell" size={18} /></span>
      <div className="device-text">
        <strong>{t('الإشعارات على هذا الجهاز', 'Notifications on this device')}</strong>
        <span className="muted">
          {push === 'on' && t('مفعّلة: تذكير صباحي بيومك وترتيبك في الدوري، ومسائي بحماستك، وكل ما اخترته.', 'On: a morning reminder of your day and league place, an evening one for your streak, and all you chose.')}
          {push === 'off' && t('تذكير يومي بحماستك وجلسات يومك وترتيبك في دوري الأسبوع — حتى والمنصة مغلقة.', 'A daily reminder of your streak, the day’s sessions and your place in the week’s league — even with TechMood closed.')}
          {pushNeedsInstall && t('على iPhone تعمل بعد تثبيت TechMood على الشاشة الرئيسية وفتحه منها.', 'On iPhone they work once TechMood is on the home screen and opened from there.')}
          {push === 'unsupported' && !pushNeedsInstall && t('هذا المتصفح لا يدعم الإشعارات.', 'This browser does not support notifications.')}
          {push === 'denied' && t('المتصفح يمنعها: اسمح بها من إعدادات الموقع في المتصفح ثم عد هنا.', 'The browser blocks them: allow them in the browser’s site settings, then come back.')}
          {push === 'loading' && '…'}
        </span>
      </div>
      {push === 'off' && (
        <button className="btn btn-primary btn-sm" type="button" onClick={onPushOn} disabled={busy !== ''}>
          {busy === 'push' ? t('جارٍ…', 'Working…') : t('فعّل', 'Turn on')}
        </button>
      )}
      {push === 'on' && variant === 'settings' && (
        <button className="btn btn-ghost btn-sm" type="button" onClick={onPushOff} disabled={busy !== ''}>
          {t('أوقف', 'Turn off')}
        </button>
      )}
      {push === 'on' && variant === 'home' && <span className="status-pill status-ok">{t('مفعّلة', 'On')}</span>}
    </li>
  );

  return (
    <section className={`panel device-setup ${variant === 'home' ? 'section-block device-setup-home' : ''}`}
             aria-label={t('هذا الجهاز', 'This device')}>
      <h3>{variant === 'home' ? t('جهّز جهازك', 'Set up this device') : t('هذا الجهاز', 'This device')}</h3>
      <ul className="device-list">
        {installRow}
        {pushRow}
      </ul>
      {error && <p className="notice notice-danger" style={{ marginTop: 10 }}>{error}</p>}
    </section>
  );
}

/**
 * Mounted once in the app shell: registers the service worker and starts
 * listening for the browser's install offer, whatever page the person opens
 * first. Renders nothing.
 */
export function DeviceBoot() {
  useEffect(() => { startInstallCapture(); }, []);
  return null;
}
