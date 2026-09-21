'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { saveProfileBasics, type ProfileState } from './actions';

/** The three things that decide what a visitor meets first. */
export function BasicsForm({
  headline,
  bio,
  isPublic,
}: {
  headline: string | null;
  bio: string | null;
  isPublic: boolean;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(saveProfileBasics, undefined as ProfileState);

  return (
    <form action={formAction} className="panel section-block">
      <h3 style={{ fontSize: '0.98rem' }}>{t('واجهتك', 'Your public face')}</h3>

      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="headline">{t('الصفة المهنية', 'Professional title')}</label>
        <input id="headline" name="headline" defaultValue={headline ?? ''} maxLength={120} />
      </div>

      <div className="field">
        <label htmlFor="bio">{t('نبذة قصيرة', 'A short about')}</label>
        <textarea id="bio" name="bio" rows={3} defaultValue={bio ?? ''} maxLength={600} />
      </div>

      <label className="radio-row" htmlFor="is_public">
        <input id="is_public" name="is_public" type="checkbox" defaultChecked={isPublic} />
        <span>{t('ملفي عام', 'My profile is public')}</span>
        <span className="muted" style={{ fontSize: '0.78rem' }}>
          {t('إطفاؤه يُخفي كل شيء مهما كانت إعدادات الأقسام.',
             'Switching it off hides everything, whatever the sections say.')}
        </span>
      </label>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}

      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ الحفظ…', 'Saving…') : t('احفظ', 'Save')}
      </button>
    </form>
  );
}
