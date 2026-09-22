'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { grantMentorAccess, type MentorAccessState } from './actions';

export function GrantForm({ startupId }: { startupId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(grantMentorAccess, undefined as MentorAccessState);

  return (
    <form action={formAction} className="panel meeting-form">
      <input type="hidden" name="startup_id" value={startupId} />

      <div className="field">
        <label htmlFor="techmood_id">{t('معرّف المنتور', 'Mentor’s TechMood ID')}</label>
        <input id="techmood_id" name="techmood_id" dir="ltr" placeholder="TM-XXXXXX" required />
      </div>
      <div className="field">
        <label htmlFor="expires_on">{t('حتى تاريخ (اختياري)', 'Until (optional)')}</label>
        <input id="expires_on" name="expires_on" type="date" />
      </div>
      <div className="field">
        <label htmlFor="note">{t('لماذا؟', 'Why?')}</label>
        <input id="note" name="note" placeholder={t('مراجعة نموذج العمل', 'To review the business model')} />
      </div>

      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ…', 'Granting…') : t('امنح الوصول', 'Grant access')}
      </button>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
    </form>
  );
}
