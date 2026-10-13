'use client';

import { useActionState, useState } from 'react';

import { useT } from '@/lib/i18n.client';

import { applyToOpening, type JoinState } from './join-actions';

/** «اطلب هذا الدور» — opens a short note, then sends the request. */
export function ApplyOpening({ openingId, role }: { openingId: string; role: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(applyToOpening, undefined as JoinState);

  if (state?.ok) return <p className="form-ok" role="status">{state.ok}</p>;

  return open ? (
    <form action={action} className="opening-apply">
      <input type="hidden" name="opening_id" value={openingId} />
      <textarea name="message" rows={2} maxLength={500} autoFocus
                placeholder={t(`لماذا تناسب دور «${role}»؟ (اختياري)`, `Why do you fit «${role}»? (optional)`)} />
      <div className="opening-apply-row">
        <button className="btn btn-primary btn-sm" disabled={pending} aria-busy={pending}>
          {pending ? t('جارٍ…', 'Sending…') : t('أرسل الطلب', 'Send the request')}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>{t('إلغاء', 'Cancel')}</button>
      </div>
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
    </form>
  ) : (
    <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>{t('اطلب هذا الدور', 'Apply for this role')}</button>
  );
}
