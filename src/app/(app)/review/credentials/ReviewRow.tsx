'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { reviewCredential, type ReviewState } from './actions';

export function ReviewRow({ submissionId }: { submissionId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<ReviewState, FormData>(reviewCredential, undefined);

  if (state?.ok) return <p className="notice notice-ok">{state.ok}</p>;

  return (
    <form action={formAction} className="credential-review">
      <input type="hidden" name="submission_id" value={submissionId} />
      <input name="note" placeholder={t('ملاحظة — إلزامية عند الرفض', 'Note — required to refuse')} />
      <button className="btn btn-primary btn-sm" name="decision" value="verify" disabled={pending}>
        {t('وثّق', 'Verify')}
      </button>
      <button className="btn btn-ghost btn-sm" name="decision" value="reject" disabled={pending}>
        {t('ارفض', 'Refuse')}
      </button>
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
    </form>
  );
}
