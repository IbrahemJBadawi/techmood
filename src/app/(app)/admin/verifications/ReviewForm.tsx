'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { reviewVerification, revokeVerification, type ReviewState } from './actions';

export function VerificationReviewForm({ id }: { id: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(reviewVerification, undefined as ReviewState);
  if (state?.ok) return <p className="notice notice-ok">{state.ok}</p>;
  return (
    <form action={action} className="topup-review">
      <input type="hidden" name="id" value={id} />
      <input name="reason" placeholder={t('سبب الرفض (إلزامي عند الرفض)', 'Reason, if you refuse')} />
      <div className="row-actions">
        <button className="btn btn-primary btn-sm" name="decision" value="approve" disabled={pending}>{t('✓ وثّق الحساب', '✓ Verify')}</button>
        <button className="btn btn-ghost btn-sm" name="decision" value="reject" disabled={pending}>{t('ارفض', 'Refuse')}</button>
      </div>
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
    </form>
  );
}

export function RevokeForm({ profileId }: { profileId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(revokeVerification, undefined as ReviewState);
  if (state?.ok) return <span className="muted">{state.ok}</span>;
  return (
    <form action={action} className="row-actions">
      <input type="hidden" name="profile_id" value={profileId} />
      <input name="reason" placeholder={t('السبب', 'Reason')} required style={{ maxWidth: 160 }} />
      <button className="btn btn-ghost btn-sm" disabled={pending}>{t('أزل العلامة', 'Remove')}</button>
      {state?.error && <span className="notice notice-danger">{state.error}</span>}
    </form>
  );
}
