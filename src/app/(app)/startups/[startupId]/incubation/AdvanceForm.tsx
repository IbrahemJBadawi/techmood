'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { advanceStage, type StageState } from './actions';

/** Moving up. Refused, with names, while anything required is unmet. */
export function AdvanceForm({ startupId, ready }: { startupId: string; ready: boolean }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(advanceStage, undefined as StageState);

  return (
    <form action={formAction} className="row-actions" style={{ marginTop: 14 }}>
      <input type="hidden" name="startup_id" value={startupId} />
      <input name="note" className="invite-message"
             placeholder={t('ما الذي أنجزتموه؟ (اختياري)', 'What did you finish? (optional)')}
             aria-label={t('ملاحظة المرحلة', 'Stage note')} />
      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ…', 'Working…') : t('انتقل للمرحلة التالية', 'Move to the next stage')}
      </button>

      {!ready && (
        <span className="muted" style={{ fontSize: '0.78rem' }}>
          {t('يمكنك المحاولة — ستخبرك المنصة بما ينقص.', 'You can try — the platform will tell you what is missing.')}
        </span>
      )}

      {state?.error && <p className="notice notice-danger" style={{ width: '100%' }}>{state.error}</p>}
      {state?.ok && <p className="notice notice-ok" style={{ width: '100%' }}>{state.ok}</p>}
    </form>
  );
}
