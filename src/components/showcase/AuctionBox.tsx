'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';
import { money } from '@/lib/booking';
import { Countdown } from '@/components/Countdown';
import { NumberStepper } from '@/components/NumberStepper';
import { cancelAuction, placeBid, type AuctionState } from '@/app/(app)/projects/auction-actions';

export type AuctionView = {
  id: string; start_usd: number; step_usd: number; ends_at: string; top_usd: number | null; bids: number;
  next_min_usd: number; i_lead: boolean; is_seller: boolean;
};

/** A running auction (design lab 4: «مزاد مفتوح بموعد انتهاء»): the top bid, the time left, the last bids, a bid. */
export function AuctionBox({ auction, bids, signedIn, revalidate, loginHref }: {
  auction: AuctionView; bids: { amount_usd: number; bidder: string; created_at: string; is_me: boolean }[];
  signedIn: boolean; revalidate: string; loginHref: string;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(placeBid, undefined as AuctionState);

  return (
    <div className="auction-box">
      <p className="auction-tag">🔨 {t('مزاد مفتوح', 'Open auction')}</p>
      <div className="auction-top">
        <span className="muted">{auction.top_usd !== null ? t('أعلى مزايدة', 'Top bid') : t('يبدأ من', 'Starts at')}</span>
        <strong className="eng">{money(auction.top_usd ?? auction.start_usd)}</strong>
        <span className="muted">{t(`${auction.bids} مزايدة`, `${auction.bids} bids`)}</span>
      </div>
      <Countdown endsAt={auction.ends_at} label={t('ينتهي المزاد بعد', 'Ends in')} overLabel={t('انتهى المزاد — يُعلن الفائز خلال دقيقة', 'Ended — the winner is announced within a minute')} />

      {bids.length > 0 && (
        <ol className="auction-bids">
          {bids.slice(0, 5).map((bid, index) => (
            <li key={`${bid.created_at}-${index}`} className={bid.is_me ? 'is-me' : ''}>
              <span>{bid.is_me ? t('أنت', 'You') : bid.bidder}</span>
              <b className="eng">{money(bid.amount_usd)}</b>
            </li>
          ))}
        </ol>
      )}

      {auction.is_seller ? (
        <>
          <p className="muted" style={{ fontSize: '0.82rem' }}>{t('هذا مزادك. يصلك إشعار مع كل مزايدة جديدة وعند الانتهاء.', 'This is your auction. You are told about each new bid and when it ends.')}</p>
          {auction.bids === 0 && (
            <form action={cancelAuction}>
              <input type="hidden" name="auction_id" value={auction.id} />
              <input type="hidden" name="revalidate" value={revalidate} />
              <button className="btn btn-ghost btn-sm">{t('ألغِ المزاد', 'Cancel the auction')}</button>
            </form>
          )}
        </>
      ) : !signedIn ? (
        <Link className="btn btn-primary" href={loginHref}>{t('سجّل الدخول لتزايد', 'Sign in to bid')}</Link>
      ) : auction.i_lead && !state?.error ? (
        <p className="notice notice-ok">{t('✓ مزايدتك هي الأعلى الآن. نخبرك إن زايد أحد أعلى منك.', '✓ Yours is the top bid. We will tell you if someone outbids you.')}</p>
      ) : (
        <form action={action} className="auction-form">
          <input type="hidden" name="auction_id" value={auction.id} />
          <input type="hidden" name="revalidate" value={revalidate} />
          <NumberStepper name="amount" min={auction.next_min_usd} step={auction.step_usd} defaultValue={auction.next_min_usd}
                         aria-label={t('مبلغ المزايدة', 'Your bid')} />
          <button className="btn btn-primary" disabled={pending} aria-busy={pending}>{t('زايد', 'Bid')}</button>
          <small className="muted">{t(`أقل مزايدة ${money(auction.next_min_usd)} · الزيادة ${money(auction.step_usd)}`, `Minimum ${money(auction.next_min_usd)} · step ${money(auction.step_usd)}`)}</small>
        </form>
      )}
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      <p className="muted" style={{ fontSize: '0.74rem' }}>{t('مزايدة في آخر دقيقتين تمدّد المزاد دقيقتين. يدفع الفائز خلال 48 ساعة، بتحويل أو من رصيده.', 'A bid in the last two minutes adds two minutes. The winner pays within 48 hours, by transfer or from their balance.')}</p>
    </div>
  );
}
