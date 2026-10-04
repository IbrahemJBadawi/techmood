'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';
import { PRIMARY_LINK_KINDS, PRIMARY_LINK_LABEL } from '@/lib/profile-links';

import { savePrimaryLinks, saveUsername, type ProfileState } from './actions';

/** An optional @username, reserved whenever the member wants one. */
export function UsernameForm({ username, techmoodId }: { username: string | null; techmoodId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(saveUsername, undefined as ProfileState);
  return (
    <form action={formAction} className="hm-card st-section section-block">
      <h3 style={{ fontSize: '0.98rem' }}>{t('اسم المستخدم (اختياري)', 'Username (optional)')}</h3>
      <p className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
        {t('معرّفك الثابت ', 'Your permanent ID is ')}<b className="eng">{techmoodId}</b>
        {t('. يمكنك فوقه حجز اسم مستخدم يسهل تذكّره.', '. On top of it you can reserve an easy-to-remember username.')}
      </p>
      <div className="field" style={{ marginTop: 10 }}>
        <label htmlFor="username">{t('اسم المستخدم', 'Username')}</label>
        <div className="username-field">
          <span className="username-prefix" dir="ltr">@</span>
          <input id="username" name="username" defaultValue={username ?? ''} dir="ltr" pattern="[a-z0-9_]{3,30}" placeholder="ibrahem" />
        </div>
        <small className="muted">{t('حروف إنجليزية صغيرة وأرقام و_ (3–30). اتركه فارغاً لإزالته.', 'Lowercase letters, digits and _ (3–30). Leave empty to remove it.')}</small>
      </div>
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
      <button className="btn btn-primary btn-sm" disabled={pending}>{pending ? t('جارٍ…', 'Saving…') : t('احفظ', 'Save')}</button>
    </form>
  );
}

/** The main accounts — CV, LinkedIn, GitHub, Behance, YouTube — apart from other links. */
export function PrimaryLinksForm({ current }: { current: Record<string, string> }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(savePrimaryLinks, undefined as ProfileState);
  return (
    <form action={formAction} className="hm-card st-section section-block">
      <h3 style={{ fontSize: '0.98rem' }}>⭐ {t('الحسابات الأساسية', 'Main accounts')}</h3>
      <p className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
        {t('تظهر في أعلى ملفك بأيقوناتها، منفصلة عن الروابط الأخرى.', 'Shown at the top of your profile with their icons, apart from other links.')}
      </p>
      <div className="st-primary-links">
        {PRIMARY_LINK_KINDS.map((kind) => (
          <div className="field" key={kind}>
            <label htmlFor={`link_${kind}`}>{t(PRIMARY_LINK_LABEL[kind].ar, PRIMARY_LINK_LABEL[kind].en)}</label>
            <input id={`link_${kind}`} name={`link_${kind}`} type="url" dir="ltr"
                   defaultValue={current[kind] ?? ''} placeholder={PRIMARY_LINK_LABEL[kind].placeholder} />
          </div>
        ))}
      </div>
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
      <button className="btn btn-primary btn-sm" disabled={pending}>{pending ? t('جارٍ…', 'Saving…') : t('احفظ الحسابات', 'Save accounts')}</button>
    </form>
  );
}
