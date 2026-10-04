import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDateTime, type Text } from '@/lib/i18n';
import { money } from '@/lib/booking';
import type { OfferStatus } from '@/lib/database.types';

import { BuyerAnswer, SellerAnswer } from './OfferActions';

const STATUS: Record<OfferStatus, { text: Text; pill: string }> = {
  pending:   { text: { ar: 'بانتظار ردّ البائع', en: 'Waiting for the seller' }, pill: 'status-pending' },
  countered: { text: { ar: 'عرض مقابل — بانتظار المشتري', en: 'Countered — waiting for the buyer' }, pill: 'status-pending' },
  accepted:  { text: { ar: 'متفق عليه — بانتظار الدفع', en: 'Agreed — waiting for payment' }, pill: 'status-ok' },
  rejected:  { text: { ar: 'لم يُقبل', en: 'Declined' }, pill: 'status-danger' },
  withdrawn: { text: { ar: 'مسحوب', en: 'Withdrawn' }, pill: 'status-muted' },
  expired:   { text: { ar: 'انتهت المهلة', en: 'Expired' }, pill: 'status-muted' },
  used:      { text: { ar: 'تم الشراء به', en: 'Used to buy' }, pill: 'status-ok' },
};

/** Price offers (المفاصلة, 0121): the ones on my listings, and the ones I made. */
export async function Offers() {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: rows } = await supabase.rpc('my_listing_offers');
  const offers = rows ?? [];

  if (offers.length === 0) {
    return (
      <div className="panel empty-state">
        <h3 style={{ fontSize: '0.98rem' }}>{t('لا عروض أسعار بعد', 'No price offers yet')}</h3>
        <p className="muted" style={{ fontSize: '0.86rem' }}>
          {t('على المشاريع «القابلة للتفاوض» تستطيع تقديم عرض سعر من صفحة المشروع. ', 'On “negotiable” projects you can make an offer from the project page. ')}
          <Link href="/policies#market">{t('شروط المفاصلة', 'The negotiation terms')}</Link>
        </p>
      </div>
    );
  }

  return (
    <ul className="sc-offers">
      {offers.map((offer) => {
        const status = STATUS[offer.status];
        const open = offer.expires_at && new Date(offer.expires_at) > new Date();
        return (
          <li className="panel" key={offer.id}>
            <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
              <span>
                <span className="sc-badge is-soft">{offer.role === 'seller' ? t('على مشروعك', 'On your listing') : t('عرضك', 'Your offer')}</span>{' '}
                <Link href={`/p/${offer.project_code}`}><b>{offer.project_title}</b></Link>
                <span className="muted"> · {offer.other_name}</span>
              </span>
              <span className={`status-pill ${status.pill}`}>{t(status.text)}</span>
            </div>
            <p style={{ marginTop: 8 }}>
              {t('السعر المعروض: ', 'Listed: ')}<b className="eng">{money(offer.list_price)}</b>
              {' · '}{t('العرض: ', 'Offer: ')}<b className="eng">{money(offer.amount_usd)}</b>
              {offer.counter_usd !== null && <>{' · '}{t('المقابل: ', 'Counter: ')}<b className="eng">{money(offer.counter_usd)}</b></>}
              {offer.agreed_usd !== null && <>{' · '}{t('المتفق: ', 'Agreed: ')}<b className="eng">{money(offer.agreed_usd)}</b></>}
            </p>
            {offer.message_ar && <p className="muted" style={{ fontSize: '0.86rem' }}>«{offer.message_ar}»</p>}
            {offer.seller_note_ar && <p className="muted" style={{ fontSize: '0.86rem' }}>{t('البائع: ', 'Seller: ')}«{offer.seller_note_ar}»</p>}
            {['pending', 'countered', 'accepted'].includes(offer.status) && open && (
              <p className="muted" style={{ fontSize: '0.78rem' }}>{t('المهلة حتى ', 'Until ')}{formatDateTime(locale, offer.expires_at)}</p>
            )}
            {offer.role === 'seller' && offer.status === 'pending' && (
              <SellerAnswer offerId={offer.id} amount={Number(offer.amount_usd)} listPrice={Number(offer.list_price)} />
            )}
            {offer.role === 'buyer' && ['pending', 'countered', 'accepted'].includes(offer.status) && (
              <>
                {offer.status === 'accepted' && (
                  <Link className="btn btn-primary btn-sm" href={`/p/${offer.project_code}`}>{t('ادفع بالسعر المتفق عليه', 'Pay the agreed price')}</Link>
                )}
                <BuyerAnswer offerId={offer.id} countered={offer.status === 'countered'} />
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
