import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { money } from '@/lib/booking';

/**
 * What I bought in the market (0099). The delivery link appears once TechMood
 * has confirmed the payment — before that the row says so.
 */
export async function Purchases() {
  const t = await getT();
  const supabase = await createClient();
  const { data: purchases } = await supabase.rpc('my_purchases');

  if ((purchases ?? []).length === 0) return null;

  return (
    <section className="panel section-block">
      <h3 style={{ fontSize: '0.98rem' }}>{t('مشترياتي من السوق', 'My market purchases')}</h3>
      <ul className="wallet-statement" style={{ marginTop: 10 }}>
        {(purchases ?? []).map((purchase) => (
          <li key={purchase.sale_id}>
            <span className="eng wallet-amount is-out">{money(purchase.amount_usd)}</span>
            <span className="wallet-label">
              {purchase.project_title}
              <span className="id-chip" style={{ marginInlineStart: 6 }}>{purchase.listing_code}</span>
              <span className="muted" style={{ display: 'block', fontSize: '0.76rem' }}>{purchase.seller_name}</span>
            </span>
            {purchase.delivery_url ? (
              <a className="btn btn-primary btn-sm" href={purchase.delivery_url} target="_blank" rel="noopener noreferrer">
                {t('رابط التسليم', 'Delivery link')}
              </a>
            ) : (
              <span className="status-pill status-pending">
                {purchase.escrow_status === 'cancelled' || purchase.escrow_status === 'refunded'
                  ? t('أُلغي', 'Cancelled')
                  : t('بانتظار تأكيد الدفع', 'Waiting for payment confirmation')}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="muted" style={{ fontSize: '0.76rem', marginTop: 8 }}>
        {t('بعد استلامك المشروع، أفرج عن المبلغ من صفحة المشروع — أو افتح نزاعاً إن لم يطابق العرض.',
           'Once you have the project, release the money from the project page — or open a dispute if it does not match the listing.')}
      </p>
    </section>
  );
}
