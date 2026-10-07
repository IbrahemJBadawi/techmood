'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { ratePurchaseAction, type ShowcaseState } from '../projects/showcase-actions';
import { StarInput } from '@/components/StarInput';

/** A buyer's stars and a line, once, after the money is released (0121). */
export function RatePurchase({ saleId }: { saleId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(ratePurchaseAction, undefined as ShowcaseState);
  if (state?.ok) return <p className="notice notice-ok" style={{ margin: 0 }}>{state.ok}</p>;
  return (
    <form action={formAction} className="sc-rate">
      <input type="hidden" name="sale_id" value={saleId} />
      <StarInput name="stars" required label={t('قيّم ما اشتريته', 'Rate what you bought')} />
      <input name="comment" maxLength={1000} placeholder={t('رأيك باختصار (يظهر على صفحة المشروع)', 'A short review (shown on the page)')} />
      <button className="btn btn-primary btn-sm" disabled={pending}>{t('أرسل', 'Send')}</button>
      {state?.error && <p className="notice notice-danger" style={{ margin: 0 }}>{state.error}</p>}
    </form>
  );
}
