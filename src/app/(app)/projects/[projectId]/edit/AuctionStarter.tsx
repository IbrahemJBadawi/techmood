'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';
import { NumberStepper } from '@/components/NumberStepper';
import { startAuction, type AuctionState } from '../../auction-actions';

/** The seller puts a listed project up for auction: starting price, step, and how long (0153). */
export function AuctionStarter({ listingId, price, running, revalidate }: { listingId: string; price: number; running: boolean; revalidate: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(startAuction, undefined as AuctionState);
  if (running) return <p className="notice">🔨 {t('على هذا المشروع مزاد يعمل الآن — تابعه من صفحة المشروع.', 'An auction is running on this project — follow it from the project page.')}</p>;
  if (state?.ok) return <p className="notice notice-ok">{state.ok}</p>;

  return (
    <details className="auction-start">
      <summary>🔨 {t('اعرضه بالمزاد بدل السعر الثابت', 'Auction it instead of a fixed price')}</summary>
      <form action={action} className="auction-start-form">
        <input type="hidden" name="listing_id" value={listingId} />
        <input type="hidden" name="revalidate" value={revalidate} />
        <div className="field-row">
          <div className="field">
            <label htmlFor="auc-start">{t('سعر البداية $', 'Starting price $')}</label>
            <NumberStepper id="auc-start" name="start" min={1} step={1} defaultValue={Math.max(1, Math.round(price * 0.6))} />
          </div>
          <div className="field">
            <label htmlFor="auc-step">{t('أقل زيادة لكل مزايدة $', 'Smallest raise per bid $')}</label>
            <NumberStepper id="auc-step" name="step" min={1} step={1} defaultValue={Math.max(1, Math.round(price * 0.05))} />
          </div>
        </div>
        <fieldset className="choice-chips">
          <legend>{t('مدة المزاد', 'How long it runs')}</legend>
          <div className="choice-chips-row">
            {[{ h: 24, l: t('يوم', 'A day') }, { h: 72, l: t('3 أيام', '3 days') }, { h: 168, l: t('أسبوع', 'A week') }].map((o, i) => (
              <label key={o.h} className="choice-chip">
                <input type="radio" name="hours" value={o.h} defaultChecked={i === 1} /><span>{o.l}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="muted" style={{ fontSize: '0.8rem' }}>
          {t('خلال المزاد لا يُشترى المشروع بالسعر الثابت. يفوز صاحب أعلى مزايدة ويدفع خلال 48 ساعة. لا يُلغى المزاد بعد أول مزايدة.',
             'While it runs nobody buys at the fixed price. The highest bidder wins and pays within 48 hours. It cannot be cancelled after the first bid.')}
        </p>
        {state?.error && <p className="notice notice-danger">{state.error}</p>}
        <button className="btn btn-primary btn-sm" disabled={pending} aria-busy={pending}>{t('ابدأ المزاد', 'Start the auction')}</button>
      </form>
    </details>
  );
}
