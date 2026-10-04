'use client';

import { useActionState, useState } from 'react';

import { useT } from '@/lib/i18n.client';

import { answerOfferAction, respondOfferAction, type ShowcaseState } from '../projects/showcase-actions';

/** The seller's answer to a pending offer: accept, decline, or counter once (0121). */
export function SellerAnswer({ offerId, amount, listPrice }: { offerId: string; amount: number; listPrice: number }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(respondOfferAction, undefined as ShowcaseState);
  const [counter, setCounter] = useState(false);
  return (
    <form action={formAction} className="stack sc-offer-answer">
      <input type="hidden" name="offer_id" value={offerId} />
      <input name="note" maxLength={300} placeholder={t('ملاحظة للمشتري (اختياري)', 'A note to the buyer (optional)')} />
      {counter && (
        <input name="counter" type="number" min={Math.floor(amount) + 1} max={Math.ceil(listPrice) - 1} required
               placeholder={t(`سعرك المقابل (بين ${amount} و${listPrice})`, `Your counter (between ${amount} and ${listPrice})`)} />
      )}
      <div className="row-actions">
        {!counter && <button className="btn btn-primary btn-sm" name="action" value="accept" disabled={pending}>{t('اقبل', 'Accept')}</button>}
        {counter
          ? <button className="btn btn-sky btn-sm" name="action" value="counter" disabled={pending}>{t('أرسل السعر المقابل', 'Send the counter')}</button>
          : <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCounter(true)}>{t('سعر مقابل', 'Counter')}</button>}
        <button className="btn btn-ghost btn-sm" name="action" value="reject" disabled={pending} formNoValidate>{t('اعتذر', 'Decline')}</button>
      </div>
      {state?.error && <p className="notice notice-danger" style={{ margin: 0 }}>{state.error}</p>}
      {state?.ok && <p className="notice notice-ok" style={{ margin: 0 }}>{state.ok}</p>}
    </form>
  );
}

/** The buyer's answer to a counter-offer, or withdrawing their own offer. */
export function BuyerAnswer({ offerId, countered }: { offerId: string; countered: boolean }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(answerOfferAction, undefined as ShowcaseState);
  return (
    <form action={formAction} className="row-actions">
      <input type="hidden" name="offer_id" value={offerId} />
      {countered && <button className="btn btn-primary btn-sm" name="action" value="accept" disabled={pending}>{t('اقبل السعر المقابل', 'Accept the counter')}</button>}
      {countered && <button className="btn btn-ghost btn-sm" name="action" value="reject" disabled={pending}>{t('ارفض', 'Decline')}</button>}
      <button className="btn btn-ghost btn-sm" name="action" value="withdraw" disabled={pending}>{t('اسحب عرضي', 'Withdraw my offer')}</button>
      {state?.error && <p className="notice notice-danger" style={{ margin: 0 }}>{state.error}</p>}
      {state?.ok && <p className="notice notice-ok" style={{ margin: 0 }}>{state.ok}</p>}
    </form>
  );
}
