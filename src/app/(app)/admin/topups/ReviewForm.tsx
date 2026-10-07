'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { reviewTopup, type ReviewState } from './actions';

export function TopupReviewForm({ topupId }: { topupId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(reviewTopup, undefined as ReviewState);
  if (state?.ok) return <p className="notice notice-ok">{state.ok}</p>;
  return (
    <form action={action} className="topup-review">
      <input type="hidden" name="topup_id" value={topupId} />
      <input name="reason" placeholder={t('سبب الرفض (إلزامي عند الرفض)', 'Reason, if you turn it down')} />
      <div className="row-actions">
        <button className="btn btn-primary btn-sm" name="decision" value="approve" disabled={pending}>{t('✓ اشحن الرصيد', '✓ Credit it')}</button>
        <button className="btn btn-ghost btn-sm" name="decision" value="reject" disabled={pending}>{t('ارفض', 'Turn down')}</button>
      </div>
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
    </form>
  );
}
