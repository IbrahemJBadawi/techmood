'use client';

import { useActionState, useState } from 'react';

import { createSprint, type TeamState } from '../../actions';
import { useT } from '@/lib/i18n.client';

export function NewSprintForm({
  teamId,
  defaultStart,
  defaultEnd,
}: {
  teamId: string;
  defaultStart: string;
  defaultEnd: string;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(createSprint, undefined as TeamState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="btn btn-primary btn-sm" style={{ marginBottom: 18 }} onClick={() => setOpen(true)}>
        {t('+ ابدأ سبرنت', '+ Start a sprint')}
      </button>
    );
  }

  return (
    <form action={formAction} className="panel section-block">
      <input type="hidden" name="team_id" value={teamId} />

      <div className="field">
        <label htmlFor="goal">{t('هدف السبرنت', 'Sprint goal')}</label>
        <input id="goal" name="goal" placeholder={t('مثال: إكمال نظام المصادقة', 'For example: finish the auth system')} required />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="starts_on">{t('يبدأ', 'Starts')}</label>
          <input id="starts_on" name="starts_on" type="date" defaultValue={defaultStart} required />
        </div>
        <div className="field">
          <label htmlFor="ends_on">{t('ينتهي', 'Ends')}</label>
          <input id="ends_on" name="ends_on" type="date" defaultValue={defaultEnd} required />
        </div>
      </div>

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
      {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? t('جارٍ البدء…', 'Starting…') : t('ابدأ السبرنت', 'Start the sprint')}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>{t('إغلاق', 'Close')}</button>
      </div>
    </form>
  );
}
