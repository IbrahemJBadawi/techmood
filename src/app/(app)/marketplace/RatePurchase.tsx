'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { ratePurchaseAction, type ShowcaseState } from '../projects/showcase-actions';

/** A buyer's stars and a line, once, after the money is released (0121). */
export function RatePurchase({ saleId }: { saleId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(ratePurchaseAction, undefined as ShowcaseState);
  if (state?.ok) return <p className="notice notice-ok" style={{ margin: 0 }}>{state.ok}</p>;
  return (
    <form action={formAction} className="sc-rate">
      <input type="hidden" name="sale_id" value={saleId} />
      <select name="stars" required defaultValue="" aria-label={t('تقييمك', 'Your rating')}>
        <option value="" disabled>{t('قيّم ما اشتريته', 'Rate what you bought')}</option>
        {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{'★'.repeat(value)}</option>)}
      </select>
      <input name="comment" maxLength={1000} placeholder={t('رأيك باختصار (يظهر على صفحة المشروع)', 'A short review (shown on the page)')} />
      <button className="btn btn-primary btn-sm" disabled={pending}>{t('أرسل', 'Send')}</button>
      {state?.error && <p className="notice notice-danger" style={{ margin: 0 }}>{state.error}</p>}
    </form>
  );
}
