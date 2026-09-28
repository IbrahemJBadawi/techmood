import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { money } from '@/lib/booking';
import type { PaymentMethodPublic, SaleLicence } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';

import { BuyForm } from '../projects/[projectId]/Money';
import { PUBLIC_METHOD_COLUMNS } from '@/lib/database.types';

const LICENCE: Record<SaleLicence, Text> = {
  usage_rights:  { ar: 'حق استخدام',  en: 'Usage rights' },
  full_transfer: { ar: 'نقل كامل',    en: 'Full transfer' },
};

/**
 * Finished work that is for sale.
 *
 * Every listing here carries the code of its exhibition entry, so a buyer can
 * check that the work was judged before it was priced — which is the only
 * reason a market like this is worth more than a folder of zip files.
 */
export async function ListingList({ search }: { search?: string }) {
  const t = await getT();
  const supabase = await createClient();

  const [{ data: listings }, { data: methods }] = await Promise.all([
    supabase.rpc('market_listings', { p_search: search ?? null, p_limit: 24 }),
    supabase.from('payment_methods').select(PUBLIC_METHOD_COLUMNS).eq('is_enabled', true).order('sort_order'),
  ]);

  if ((listings ?? []).length === 0) {
    return (
      <div className="panel empty-state">
        <h3 style={{ fontSize: '0.98rem' }}>{t('لا مشاريع معروضة للبيع', 'Nothing on sale yet')}</h3>
        <p className="muted" style={{ fontSize: '0.86rem' }}>
          {t('يُعرض هنا العمل المكتمل الذي مرّ بالتقييم وظهر في المعرض — لا مشاريع غير منتهية.',
             'What appears here is finished work that was judged and exhibited — never an unfinished project.')}
        </p>
      </div>
    );
  }

  return (
    <div className="market-grid">
      {(listings ?? []).map((listing) => (
        <article className="panel talent-card" key={listing.id}>
          <div className="row-between">
            <span className="id-chip">{listing.listing_code}</span>
            <span style={{ display: 'flex', gap: 6 }}>
              {listing.verified && <span className="status-pill status-ok">✓ {t('تم التحقق', 'Verified')}</span>}
              <span className="badge-pill">{t(LICENCE[listing.licence])}</span>
            </span>
          </div>

          <h3 style={{ fontSize: '0.98rem', marginTop: 8 }}>{listing.project_title}</h3>
          <p className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
            {listing.team_title ?? listing.seller_name}
            {listing.seller_rating !== null && (
              <> · <span className="eng">★ {Number(listing.seller_rating).toFixed(1)}</span> {t('تقييمه كمنتور', 'as a mentor')}</>
            )}
            {' · '}
            <span className="eng">{listing.sales_count}</span> {t('مبيعات', 'sales')}
          </p>

          <p style={{ fontSize: '0.86rem', marginTop: 8 }}>{listing.summary_ar}</p>

          {listing.includes.length > 0 && (
            <div className="tags-row" style={{ marginTop: 10 }}>
              {listing.includes.map((item) => <span className="badge-pill" key={item}>{item}</span>)}
            </div>
          )}

          {listing.technologies.length > 0 && (
            <div className="tags-row" style={{ marginTop: 6 }}>
              {listing.technologies.slice(0, 5).map((tech) => (
                <span className="badge-pill eng" key={tech}>{tech}</span>
              ))}
            </div>
          )}

          <div className="row-between" style={{ marginTop: 12 }}>
            <span className="eng" style={{ fontWeight: 700, color: 'var(--royal-dark)' }}>
              {money(listing.effective_price)}
              {listing.discount_pct > 0 && (
                <>
                  {' '}<s className="muted" style={{ fontWeight: 400 }}>{money(listing.price_usd)}</s>
                  {' '}<span className="status-pill status-pending">-{listing.discount_pct}%</span>
                </>
              )}
            </span>
            {listing.demo_url && (
              <a className="btn btn-ghost btn-sm" href={listing.demo_url} target="_blank" rel="noopener noreferrer">
                {t('عرض تجريبي', 'Demo')}
              </a>
            )}
            {listing.entry_code && (
              <Link className="btn btn-ghost btn-sm" href={`/exhibition/${listing.entry_code}/verify`}>
                {t('تحقّق من العمل', 'Check the work')}
              </Link>
            )}
          </div>

          <div style={{ marginTop: 10 }}>
            <BuyForm listingId={listing.id} methods={(methods ?? []) as PaymentMethodPublic[]} />
          </div>

          <p className="muted" style={{ fontSize: '0.74rem', marginTop: 10 }}>
            {t('الشراء يفتح حجزاً مالياً — رابط التسليم يصلك بعد تأكيد الدفع، ولا ينتقل المال للبائع إلا بعد استلامك.',
               'Buying opens a hold — the delivery link reaches you once the payment is confirmed, and the seller is paid only once you have it.')}
          </p>
        </article>
      ))}
    </div>
  );
}
